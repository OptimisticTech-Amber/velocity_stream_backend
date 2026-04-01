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
exports.downloadVideoFromMinIOUrl = exports.bucket = exports.getPresignedReadUrl = exports.getObjectKeyFromUrl = exports.uploadToStorage = exports.minioUpload = exports.minioClient = exports.s3 = void 0;
// shared/cloudinary-storage.ts
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const fs_1 = __importDefault(require("fs"));
const stream_1 = require("stream");
const minio_1 = require("minio");
const client_s3_1 = require("@aws-sdk/client-s3");
// Keep s3 only if other parts still use AWS commands
exports.s3 = new client_s3_1.S3Client({
    region: "us-east-1",
    endpoint: "http://localhost:9000",
    credentials: {
        accessKeyId: "Amber",
        secretAccessKey: "Amber@786",
    },
    forcePathStyle: true,
});
exports.minioClient = new minio_1.Client({
    endPoint: "localhost",
    port: 9000,
    useSSL: false,
    accessKey: "Amber",
    secretKey: "Amber@786",
});
const minioUpload = async (fileOrBuffer, key, size) => {
    try {
        const bucket = "videos";
        const metaData = { "Content-Type": "video/mp4" };
        if (typeof fileOrBuffer === "string" && fs_1.default.existsSync(fileOrBuffer)) {
            await exports.minioClient.fPutObject(bucket, key, fileOrBuffer, metaData);
        }
        else {
            const body = typeof fileOrBuffer === "string"
                ? Buffer.from(fileOrBuffer)
                : fileOrBuffer;
            await exports.minioClient.putObject(bucket, key, body, size ?? body.length, metaData);
        }
        return {
            message: "File uploaded successfully",
            url: `http://localhost:9000/${bucket}/${key}`,
        };
    }
    catch (error) {
        console.error("❌ MinIO upload error:", error);
        throw error;
    }
};
exports.minioUpload = minioUpload;
let bucketReady = false;
const ensureBucket = async () => {
    // Cloudinary doesn't require explicit bucket setup
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        throw new Error("CLOUDINARY_CLOUD_NAME environment variable is not set");
    }
    bucketReady = true;
};
const uploadToStorage = async (fileOrBuffer, key, size) => {
    await ensureBucket();
    return new Promise((resolve, reject) => {
        const upload_stream = cloudinary_1.default.uploader.upload_stream({
            resource_type: "auto",
            public_id: key,
            folder: "videos",
            // Video transformation settings
            ...(key.includes("processed") && {
                streaming_profile: "4k", // Auto-transcoding for HLS
                format: "m3u8", // HLS format
            }),
        }, (error, result) => {
            if (error) {
                console.error("❌ Cloudinary upload error:", error);
                reject(error);
            }
            else {
                const streamUrl = result.secure_url || result.url;
                console.log(`✅ File uploaded to Cloudinary: ${streamUrl}`);
                resolve({ url: streamUrl });
            }
        });
        // Handle both Buffer and file path
        if (typeof fileOrBuffer === "string") {
            // File path: read and stream
            const readStream = fs_1.default.createReadStream(fileOrBuffer);
            readStream.on("error", reject);
            readStream.pipe(upload_stream);
        }
        else {
            // Buffer: convert to stream and upload
            const bufferStream = stream_1.Readable.from(fileOrBuffer);
            bufferStream.pipe(upload_stream);
        }
    });
};
exports.uploadToStorage = uploadToStorage;
const getObjectKeyFromUrl = (objectUrl) => {
    // Extract the public_id from Cloudinary URL
    // Format: https://res.cloudinary.com/cloud-name/image/upload/v123/path/to/file
    try {
        const url = new URL(objectUrl);
        const parts = url.pathname.split("/");
        // Find the part after 'upload' and optional version
        const uploadIndex = parts.findIndex((p) => p === "upload");
        if (uploadIndex !== -1) {
            let path = parts.slice(uploadIndex + 1).join("/");
            // Remove version number if present (v1234567)
            path = path.replace(/^v\d+\//, "");
            // Remove file extension
            path = path.replace(/\.[^/.]+$/, "");
            return path;
        }
    }
    catch (error) {
        console.error("Error parsing Cloudinary URL:", error);
    }
    return objectUrl;
};
exports.getObjectKeyFromUrl = getObjectKeyFromUrl;
const getPresignedReadUrl = async (key, expirySeconds = 60 * 60 * 24) => {
    await ensureBucket();
    // For Cloudinary, the public URL is already accessible
    // Just return the URL with signing if needed
    // The key should be the Cloudinary public_id or full URL
    if (key.startsWith("http")) {
        // Already a full URL, return as-is
        return key;
    }
    // If it's a public_id, construct the full URL
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    return `https://res.cloudinary.com/${cloudName}/video/upload/${key}`;
};
exports.getPresignedReadUrl = getPresignedReadUrl;
exports.bucket = "cloudinary"; // For compatibility
// Download video from MinIO by URL
const downloadVideoFromMinIOUrl = async (minioUrl, outputPath) => {
    try {
        // Extract the key from MinIO URL
        // URL format: http://localhost:9000/videos/{key}
        const urlParts = minioUrl.split("/videos/");
        if (urlParts.length !== 2) {
            throw new Error(`Invalid MinIO URL format: ${minioUrl}`);
        }
        const key = urlParts[1];
        console.log(`📥 Downloading from MinIO: ${key}`);
        const { GetObjectCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-s3")));
        const getParams = {
            Bucket: "videos",
            Key: key,
        };
        const response = await exports.s3.send(new GetObjectCommand(getParams));
        if (!response.Body) {
            throw new Error("No response body from MinIO");
        }
        // Convert stream to buffer and write to file
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        fs_1.default.writeFileSync(outputPath, buffer);
        console.log(`✅ Video downloaded to: ${outputPath}`);
    }
    catch (error) {
        console.error("❌ Error downloading from MinIO:", error);
        throw error;
    }
};
exports.downloadVideoFromMinIOUrl = downloadVideoFromMinIOUrl;
