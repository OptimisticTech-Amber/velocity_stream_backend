import "dotenv/config";
import express, { Request, Response } from "express";
import multer from "multer";
import cors from "cors";
import { uploadToStorage } from "./shared/s3";
import { getPrisma, prisma } from "./config/prisma";
import { connectProducer, sendMessage } from "./kafka/producer";
import movieRoutes from "./routes/movieRoutes";
import seriesRoutes from "./routes/seriesRoutes";
import continueWatchingRoutes from "./routes/continueWatchingRoutes";

// Log environment variables on startup
console.log("🌍 Environment Configuration:");
console.log(`  NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log(
  `  DATABASE_URL: ${process.env.DATABASE_URL ? "✅ Set" : "❌ Not Set"}`,
);
console.log(
  `  KAFKA_BROKER: ${process.env.KAFKA_BROKER || "kafka:9092 (default)"}`,
);
console.log(
  `  REDIS_URL: ${process.env.REDIS_URL || "redis://localhost:6379"}`,
);

const app = express();
app.use(cors());

const upload = multer();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log incoming requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// Health check endpoint for ECS
app.get("/health", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "healthy", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/movies", movieRoutes);
app.use("/api/series", seriesRoutes);
app.use("/api/v1/continue-watching", continueWatchingRoutes);

// Test endpoint
app.post("/api/test", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }
    const data = await getPrisma().user.create({
      data: {
        email,
        password,
        name,
      },
    });
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Test endpoint error:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// Upload endpoint
app.post("/upload", upload.single("video"), async (req, res) => {
  try {
    const { title, genre } = req.body;
    const file = req.file!;

    console.log("Received upload:", file.originalname, title, genre);
    const key = `raw/${Date.now()}-${file.originalname}`;
    console.log("Uploading:", key);
    // Upload to S3
    const s3Res = (await uploadToStorage(file.buffer, key)) as { url: string };
    console.log("Uploaded to S3:", s3Res?.url);
    // Save metadata
    const video = await prisma.video.create({
      data: {
        title,
        genre,
        url: s3Res.url,
      },
    });
    console.log("Metadata saved:", video);
    // Send Kafka event
    await sendMessage("video-raw-uploaded", {
      videoId: video.id,
      url: s3Res.url,
    });

    res.json({ success: true, video });
  } catch (err) {
    console.error(err);
    res.status(500).send("Upload failed");
  }
});

// Static routes
app.use("/stream", express.static("hls"));

// Welcome endpoints
app.get("/", (req: Request, res: Response) => {
  res.send("Hello from the upload service!");
});

app.get("/velocity", (req: Request, res: Response) => {
  res.send("Hello from the velocity endpoint , watch the videos without ads!");
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  try {
    await connectProducer();
    console.log(`✅ Upload service running on port ${PORT}`);
  } catch (err) {
    console.error("Failed to connect Kafka producer:", err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
