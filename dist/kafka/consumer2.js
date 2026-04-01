"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const kafka_1 = require("../config/kafka");
const prisma_1 = require("../config/prisma");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const s3_1 = require("../shared/s3");
const promises_1 = require("stream/promises");
const child_process_1 = require("child_process");
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const kafka = (0, kafka_1.getKafka)("video-consumer");
const consumer = kafka.consumer({ groupId: "video-consumer-group" });
const connectWithRetry = async (maxRetries = 15, baseDelay = 2000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await consumer.connect();
            console.log("✅ Consumer connected successfully");
            return;
        }
        catch (error) {
            lastError = error;
            const delay = baseDelay * Math.pow(2, attempt - 1);
            const delaySeconds = Math.round(delay / 1000);
            console.warn(`⚠️  Connection attempt ${attempt}/${maxRetries} failed. Retrying in ${delaySeconds}s...`);
            console.warn(`   Error: ${error?.message || error}`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error(`Failed to connect to Kafka after ${maxRetries} attempts: ${lastError?.message || lastError}`);
};
const normalizeKey = (rawKey) => {
    let k = decodeURIComponent(rawKey).trim();
    if (k.startsWith("/"))
        k = k.slice(1);
    if (k.startsWith("videos/"))
        k = k.slice("videos/".length);
    return k;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function downloadVideo(rawKey, filePath) {
    const key = normalizeKey(rawKey);
    fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
    let lastError;
    for (let i = 1; i <= 5; i++) {
        try {
            const objectStream = await s3_1.minioClient.getObject("videos", key);
            const fileStream = fs_1.default.createWriteStream(filePath);
            await (0, promises_1.pipeline)(objectStream, fileStream);
            console.log(`✅ Download completed: videos/${key}`);
            return filePath;
        }
        catch (err) {
            lastError = err;
            console.warn(`⚠️ Download retry ${i}/5 for key: ${key}`);
            await sleep(1200 * i);
        }
    }
    throw lastError;
}
const run = async () => {
    try {
        await connectWithRetry();
        console.log("✅ Consumer started successfully");
        console.log("FFmpeg Path:", ffmpeg_static_1.default);
        if (!ffmpeg_static_1.default) {
            throw new Error("ffmpeg-static returned null. Reinstall package: npm uninstall ffmpeg-static && npm install ffmpeg-static");
        }
        await consumer.subscribe({
            topic: "video.upload3",
            fromBeginning: false,
        });
        console.log("✅ Subscribed to topic: video.upload3");
        await consumer.run({
            eachMessage: async ({ message, topic }) => {
                try {
                    console.log("🔥 Message received");
                    console.log("Topic:", topic);
                    console.log("Message:", message.value?.toString());
                    const data = JSON.parse(message.value.toString());
                    console.log("Parsed data:", data);
                    const key = data.key;
                    const filePath = `./downloads/${key.split("/").pop()}`;
                    const downloadedFilePath = await downloadVideo(key, filePath);
                    const db = (0, prisma_1.getPrisma)();
                    // After downloading, you can proceed with transcoding or other processing
                    const videoId = (0, uuid_1.v4)();
                    // Define output folder structure (NEW)
                    const outputFolderRootPath = `./Hslstored/${videoId}`;
                    const outputFolderSubDirectoryPath = {
                        "360p": `${outputFolderRootPath}/360p`,
                        "480p": `${outputFolderRootPath}/480p`,
                        "720p": `${outputFolderRootPath}/720p`,
                        "1080p": `${outputFolderRootPath}/1080p`,
                    };
                    // Create directories if they don't exist, for storing output video (NEW)
                    if (!fs_1.default.existsSync(outputFolderRootPath)) {
                        // ./hls-output/video-id/360p/
                        fs_1.default.mkdirSync(outputFolderSubDirectoryPath["360p"], {
                            recursive: true,
                        });
                        // ./hls-output/video-id/480p/
                        fs_1.default.mkdirSync(outputFolderSubDirectoryPath["480p"], {
                            recursive: true,
                        });
                        // ./hls-output/video-id/720p/
                        fs_1.default.mkdirSync(outputFolderSubDirectoryPath["720p"], {
                            recursive: true,
                        });
                        // ./hls-output/video-id/1080p/
                        fs_1.default.mkdirSync(outputFolderSubDirectoryPath["1080p"], {
                            recursive: true,
                        });
                    }
                    // replace ffmpeg command-string section with args + spawn
                    if (!ffmpeg_static_1.default) {
                        throw new Error("FFmpeg binary not found. Install ffmpeg-static.");
                    }
                    console.log("Using ffmpeg binary:", ffmpeg_static_1.default);
                    const ffmpegArgs = [
                        "-i",
                        downloadedFilePath,
                        "-filter_complex",
                        "[0:v]split=4[v1080][v720][v480][v360];" +
                            "[v1080]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1080o];" +
                            "[v720]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720o];" +
                            "[v480]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v480o];" +
                            "[v360]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v360o]",
                        "-map",
                        "[v1080o]",
                        "-map",
                        "0:a:0",
                        "-c:v:0",
                        "libx264",
                        "-b:v:0",
                        "5000k",
                        "-maxrate:v:0",
                        "5350k",
                        "-bufsize:v:0",
                        "7500k",
                        "-c:a:0",
                        "aac",
                        "-b:a:0",
                        "128k",
                        "-map",
                        "[v720o]",
                        "-map",
                        "0:a:0",
                        "-c:v:1",
                        "libx264",
                        "-b:v:1",
                        "2800k",
                        "-maxrate:v:1",
                        "3000k",
                        "-bufsize:v:1",
                        "4200k",
                        "-c:a:1",
                        "aac",
                        "-b:a:1",
                        "128k",
                        "-map",
                        "[v480o]",
                        "-map",
                        "0:a:0",
                        "-c:v:2",
                        "libx264",
                        "-b:v:2",
                        "1400k",
                        "-maxrate:v:2",
                        "1498k",
                        "-bufsize:v:2",
                        "2100k",
                        "-c:a:2",
                        "aac",
                        "-b:a:2",
                        "96k",
                        "-map",
                        "[v360o]",
                        "-map",
                        "0:a:0",
                        "-c:v:3",
                        "libx264",
                        "-b:v:3",
                        "800k",
                        "-maxrate:v:3",
                        "856k",
                        "-bufsize:v:3",
                        "1200k",
                        "-c:a:3",
                        "aac",
                        "-b:a:3",
                        "96k",
                        "-f",
                        "hls",
                        "-hls_time",
                        "15",
                        "-hls_playlist_type",
                        "vod",
                        "-hls_flags",
                        "independent_segments",
                        "-master_pl_name",
                        "index.m3u8",
                        "-var_stream_map",
                        "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p",
                        "-hls_segment_filename",
                        `${outputFolderRootPath}/%v/segment%03d.ts`,
                        "-start_number",
                        "0",
                        `${outputFolderRootPath}/%v/index.m3u8`,
                    ];
                    await new Promise((resolve, reject) => {
                        const process = (0, child_process_1.spawn)(ffmpeg_static_1.default, ffmpegArgs, {
                            stdio: "inherit",
                        });
                        process.on("close", (code) => {
                            if (code === 0)
                                resolve();
                            else
                                reject(new Error(`FFmpeg exited with code ${code}`));
                        });
                        process.on("error", reject);
                    });
                    // Upload generated HLS files to MinIO
                    await ensureBucket(HLS_BUCKET, true);
                    await uploadDirectoryToMinio(HLS_BUCKET, outputFolderRootPath, videoId);
                    // Public URLs for HLS are required because master playlists reference child playlists/segments.
                    const videoUrls = {
                        master: getPublicObjectUrl(HLS_BUCKET, `${videoId}/index.m3u8`),
                        "360p": getPublicObjectUrl(HLS_BUCKET, `${videoId}/360p/index.m3u8`),
                        "480p": getPublicObjectUrl(HLS_BUCKET, `${videoId}/480p/index.m3u8`),
                        "720p": getPublicObjectUrl(HLS_BUCKET, `${videoId}/720p/index.m3u8`),
                        "1080p": getPublicObjectUrl(HLS_BUCKET, `${videoId}/1080p/index.m3u8`),
                    };
                    if (data.type === "movie") {
                        await db.movie.update({
                            where: { id: data.movieId },
                            data: {
                                videoUrl: videoUrls.master,
                                streamUrl: videoUrls["1080p"],
                                status: "READY",
                            },
                        });
                        console.log(`✅ Movie ${data.movieId} marked as READY`);
                    }
                    else if (data.type === "episode") {
                        await db.episode.update({
                            where: { id: data.episodeId },
                            data: {
                                videoUrl: videoUrls.master,
                                streamUrl: videoUrls["1080p"],
                                status: "READY",
                            },
                        });
                        console.log(`✅ Episode ${data.episodeId} marked as READY`);
                    }
                    console.log("✅ HLS uploaded to MinIO", videoUrls);
                }
                catch (error) {
                    console.error("❌ Error processing message:", error);
                    console.error("Stack trace:", error.stack);
                }
            },
        });
    }
    catch (error) {
        console.error("❌ Fatal error in consumer:", error);
        process.exit(1);
    }
};
run().catch((error) => {
    console.error("❌ Consumer crashed:", error);
    process.exit(1);
});
async function ensureBucket(bucketName, makePublicRead = false) {
    const exists = await s3_1.minioClient.bucketExists(bucketName);
    if (!exists) {
        await s3_1.minioClient.makeBucket(bucketName, "us-east-1");
    }
    if (makePublicRead) {
        const policy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: { AWS: ["*"] },
                    Action: ["s3:GetBucketLocation", "s3:ListBucket"],
                    Resource: [`arn:aws:s3:::${bucketName}`],
                },
                {
                    Effect: "Allow",
                    Principal: { AWS: ["*"] },
                    Action: ["s3:GetObject"],
                    Resource: [`arn:aws:s3:::${bucketName}/*`],
                },
            ],
        };
        await s3_1.minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    }
}
function getPublicObjectUrl(bucketName, objectKey) {
    const base = (process.env.MINIO_PUBLIC_URL || "http://localhost:9000").replace(/\/$/, "");
    return `${base}/${bucketName}/${objectKey.replace(/^\//, "")}`;
}
async function uploadDirectoryToMinio(bucketName, localPath, remotePrefix) {
    const entries = await fs_1.default.promises.readdir(localPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path_1.default.join(localPath, entry.name);
        if (entry.isDirectory()) {
            await uploadDirectoryToMinio(bucketName, fullPath, `${remotePrefix}/${entry.name}`.replace(/\\/g, "/"));
            continue;
        }
        const key = `${remotePrefix}/${entry.name}`.replace(/\\/g, "/");
        const metaData = {
            "Content-Type": key.endsWith(".m3u8")
                ? "application/vnd.apple.mpegurl"
                : key.endsWith(".ts")
                    ? "video/mp2t"
                    : "application/octet-stream",
        };
        await s3_1.minioClient.fPutObject(bucketName, key, fullPath, metaData);
    }
}
const HLS_BUCKET = "hls-videos";
