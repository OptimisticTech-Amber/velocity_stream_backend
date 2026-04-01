"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVideo = processVideo;
exports.processVideoWithMinIOUpload = processVideoWithMinIOUpload;
exports.processVideoStreamToMinIO = processVideoStreamToMinIO;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const s3_1 = require("../shared/s3");
// Standard video processing with local HLS output and then upload to MinIO
function processVideo(filePath, videoId) {
    return new Promise((resolve, reject) => {
        const outputDir = `hls/${videoId}`;
        fs_1.default.mkdirSync(outputDir, { recursive: true });
        (0, fluent_ffmpeg_1.default)(filePath)
            .outputOptions([
            "-preset veryfast",
            "-g 48",
            "-sc_threshold 0",
            "-f hls",
            "-hls_time 6",
            "-hls_playlist_type vod",
            "-hls_segment_filename " + outputDir + "/segment_%03d.ts",
        ])
            .output(`${outputDir}/index.m3u8`)
            .on("end", () => resolve(outputDir))
            .on("error", (err) => {
            reject(err instanceof Error ? err : new Error(String(err)));
        })
            .run();
    });
}
// Process video and automatically upload HLS files to MinIO
async function processVideoWithMinIOUpload(filePath, videoId) {
    try {
        // Process video locally first
        const outputDir = await processVideo(filePath, videoId);
        console.log(`📹 Video processed locally: ${outputDir}`);
        // Upload HLS files to MinIO
        const { playlistUrl, segmentUrls } = await (0, s3_1.uploadHLSFilesToMinIO)(outputDir, videoId);
        console.log(`📤 HLS files uploaded to MinIO`);
        // Optionally clean up local files after successful upload
        // fs.rmSync(outputDir, { recursive: true });
        return {
            localPath: outputDir,
            playlistUrl,
            segmentUrls,
        };
    }
    catch (error) {
        console.error("❌ Error in processVideoWithMinIOUpload:", error);
        throw error;
    }
}
// Stream FFmpeg output directly to MinIO without saving locally (streaming mode)
function processVideoStreamToMinIO(filePath, videoId) {
    return new Promise((resolve, reject) => {
        // For streaming directly to MinIO, we still need to use HLS which generates multiple files
        // So we'll use a temporary directory and clean it up after upload
        const tempDir = `temp_hls/${videoId}`;
        const playlistFileName = "index.m3u8";
        const playlistPath = path_1.default.join(tempDir, playlistFileName);
        fs_1.default.mkdirSync(tempDir, { recursive: true });
        (0, fluent_ffmpeg_1.default)(filePath)
            .outputOptions([
            "-preset veryfast",
            "-g 48",
            "-sc_threshold 0",
            "-f hls",
            "-hls_time 6",
            "-hls_playlist_type vod",
            "-hls_segment_filename " + tempDir + "/segment_%03d.ts",
        ])
            .output(playlistPath)
            .on("end", async () => {
            try {
                // Read the playlist to update segment paths for stream delivery
                let playlistContent = fs_1.default.readFileSync(playlistPath, "utf-8");
                // Upload files to MinIO
                const files = fs_1.default.readdirSync(tempDir);
                let playlistUrl = "";
                const { PutObjectCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-s3")));
                const { s3 } = await Promise.resolve().then(() => __importStar(require("../shared/s3")));
                const { ObjectCannedACL } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-s3")));
                for (const file of files) {
                    const filePath = path_1.default.join(tempDir, file);
                    const fileContent = fs_1.default.readFileSync(filePath);
                    const contentType = file.endsWith(".m3u8")
                        ? "application/vnd.apple.mpegurl"
                        : "video/mp2t";
                    const key = `hls-stream/${videoId}/${file}`;
                    const uploadParams = {
                        Bucket: "videos",
                        Key: key,
                        Body: fileContent,
                        ContentType: contentType,
                        ACL: ObjectCannedACL.public_read,
                    };
                    await s3.send(new PutObjectCommand(uploadParams));
                    const url = `http://localhost:9000/videos/${key}`;
                    if (file.endsWith(".m3u8")) {
                        playlistUrl = url;
                    }
                    console.log(`✅ Streamed to MinIO: ${key}`);
                }
                // Clean up temporary directory
                fs_1.default.rmSync(tempDir, { recursive: true });
                console.log(`🗑️  Cleaned up temporary directory: ${tempDir}`);
                resolve({ playlistUrl });
            }
            catch (error) {
                reject(error);
            }
        })
            .on("error", (err) => {
            // Clean up on error
            if (fs_1.default.existsSync(tempDir)) {
                fs_1.default.rmSync(tempDir, { recursive: true });
            }
            reject(err instanceof Error ? err : new Error(String(err)));
        })
            .run();
    });
}
