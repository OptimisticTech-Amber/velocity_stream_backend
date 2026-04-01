"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptimalChunkSize = exports.shouldUseChunkedUpload = exports.chunkedUpload = void 0;
const fs_1 = __importDefault(require("fs"));
const s3_1 = require("../shared/s3");
const CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks
const MAX_CONCURRENT_CHUNKS = 4; // Upload 4 chunks at once
/**
 * Upload large files to Cloudinary
 * Cloudinary handles chunking and streaming internally, so we just forward the file
 */
const chunkedUpload = async (filePath, objectKey, onProgress) => {
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const fileSize = fs_1.default.statSync(filePath).size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
    console.log(`📤 Starting upload to Cloudinary: ${objectKey} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
    try {
        // Use uploadToStorage which now handles Cloudinary
        const result = (await (0, s3_1.uploadToStorage)(filePath, objectKey, fileSize));
        console.log(`✅ Upload completed successfully: ${objectKey}`);
        // Report final progress
        if (onProgress) {
            onProgress({
                totalChunks,
                uploadedChunks: totalChunks,
                percentage: 100,
            });
        }
        return objectKey;
    }
    catch (error) {
        console.error("❌ Failed to upload file:", error);
        throw error;
    }
};
exports.chunkedUpload = chunkedUpload;
/**
 * Calculate if file should use chunked upload
 * Cloudinary handles all sizes efficiently, but we can still use this for batching
 */
const shouldUseChunkedUpload = (fileSize) => {
    // Cloudinary is efficient for all sizes, but you can still batch large files if needed
    return false; // Disabled - regular upload handles all sizes
};
exports.shouldUseChunkedUpload = shouldUseChunkedUpload;
/**
 * Get optimal chunk size based on file size
 */
const getOptimalChunkSize = (fileSize) => {
    if (fileSize > 5 * 1024 * 1024 * 1024) {
        return 200 * 1024 * 1024; // 200MB for very large files
    }
    return CHUNK_SIZE;
};
exports.getOptimalChunkSize = getOptimalChunkSize;
