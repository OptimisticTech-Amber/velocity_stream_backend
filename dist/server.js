"use strict";
// import express, { Request, Response } from "express";
// import multer from "multer";
// import cors from "cors";
// import { v4 as uuidv4 } from "uuid";
// import { sendVideoJob } from "./kafka/producer";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const s3_1 = require("./shared/s3");
const prisma_1 = require("./config/prisma");
const producer_1 = require("./kafka/producer");
const movieRoutes_1 = __importDefault(require("./routes/movieRoutes"));
const seriesRoutes_1 = __importDefault(require("./routes/seriesRoutes"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const upload = (0, multer_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Log incoming requests
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path}`);
    next();
});
app.use("/api/movies", movieRoutes_1.default);
app.use("/api/series", seriesRoutes_1.default);
app.post("/api/test", async (req, res) => {
    try {
        const { email, password, name } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: "Missing email or password" });
        }
        const data = await (0, prisma_1.getPrisma)().user.create({
            data: {
                email,
                password,
                name,
            },
        });
        res.json({ success: true, data });
    }
    catch (error) {
        console.error("Test endpoint error:", error);
        res.status(500).json({ error: error?.message || "Internal server error" });
    }
});
app.post("/upload", upload.single("video"), async (req, res) => {
    try {
        const { title, genre } = req.body;
        const file = req.file;
        console.log("Received upload:", file.originalname, title, genre);
        const key = `raw/${Date.now()}-${file.originalname}`;
        console.log("Uploading:", key);
        // Upload to S3
        const s3Res = (await (0, s3_1.uploadToStorage)(file.buffer, key));
        console.log("Uploaded to S3:", s3Res?.url);
        // Save metadata
        const video = await prisma_1.prisma.video.create({
            data: {
                title,
                genre,
                url: s3Res.url,
            },
        });
        console.log("Metadata saved:", video);
        // Send Kafka event
        await (0, producer_1.sendMessage)("video-raw-uploaded", {
            videoId: video.id,
            url: s3Res.url,
        });
        res.json({ success: true, video });
    }
    catch (err) {
        console.error(err);
        res.status(500).send("Upload failed");
    }
});
app.listen(5000, async () => {
    await (0, producer_1.connectProducer)();
    console.log("Upload service running on port 5000");
});
