// import express, { Request, Response } from "express";
// import multer from "multer";
// import cors from "cors";
// import { v4 as uuidv4 } from "uuid";
// import { sendVideoJob } from "./kafka/producer";

// const app = express();
// app.use(cors());

// const upload = multer({ dest: "uploads/" });

// type UploadRequest = Request & {
//   file?: {
//     path: string;
//   };
// };

// app.post(
//   "/upload",
//   upload.single("video"),
//   async (req: UploadRequest, res: Response) => {
//     try {
//       if (!req.file) {
//         res.status(400).json({ error: "No file uploaded" });
//         return;
//       }

//       const videoId = uuidv4();

//       await sendVideoJob({
//         videoId,
//         filePath: req.file.path,
//       });

//       res.json({
//         message: "Upload successful. Processing started.",
//         videoId,
//       });
//     } catch {
//       res.status(500).json({ error: "Upload failed" });
//     }
//   },
// );

// app.use("/stream", express.static("hls"));

// app.listen(5000, () => {
//   console.log("Server running on port 5000");
// });

// upload-service/index.ts
import "dotenv/config";
import express, { Request, Response } from "express";
import multer from "multer";
import { uploadToStorage } from "./shared/s3";
import { getPrisma, prisma } from "./config/prisma";
import { connectProducer, sendMessage } from "./kafka/producer";
import movieRoutes from "./routes/movieRoutes";
import seriesRoutes from "./routes/seriesRoutes";
import continueWatchingRoutes from "./routes/continueWatchingRoutes";
import cors from "cors";
import { searchMovies } from "./Controller/SearchController";

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

app.use("/api/movies", movieRoutes);
app.use("/api/series", seriesRoutes);
app.use("/api/v1/continue-watching", continueWatchingRoutes);
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
app.get("/", (req: Request, res: Response) => {
  res.send("Hello from the upload service!");
});
app.get("/velocity", (req: Request, res: Response) => {
  res.send("Hello from the velocity endpoint , watch the videos without ads!");
});
app.listen(5000, async () => {
  await connectProducer();
  console.log("Upload service running on port 5000");
});
