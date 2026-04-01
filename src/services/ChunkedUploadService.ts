import fs from "fs";
import path from "path";
import { uploadToStorage } from "../shared/s3";

const CHUNK_SIZE = 100 * 1024 * 1024; // 100MB chunks
const MAX_CONCURRENT_CHUNKS = 4; // Upload 4 chunks at once

interface ChunkUploadProgress {
  totalChunks: number;
  uploadedChunks: number;
  percentage: number;
}

/**
 * Upload large files to Cloudinary
 * Cloudinary handles chunking and streaming internally, so we just forward the file
 */
export const chunkedUpload = async (
  filePath: string,
  objectKey: string,
  onProgress?: (progress: ChunkUploadProgress) => void,
): Promise<string> => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileSize = fs.statSync(filePath).size;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

  console.log(
    `📤 Starting upload to Cloudinary: ${objectKey} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
  );

  try {
    // Use uploadToStorage which now handles Cloudinary
    const result = (await uploadToStorage(filePath, objectKey, fileSize)) as {
      url: string;
    };

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
  } catch (error) {
    console.error("❌ Failed to upload file:", error);
    throw error;
  }
};

/**
 * Calculate if file should use chunked upload
 * Cloudinary handles all sizes efficiently, but we can still use this for batching
 */
export const shouldUseChunkedUpload = (fileSize: number): boolean => {
  // Cloudinary is efficient for all sizes, but you can still batch large files if needed
  return false; // Disabled - regular upload handles all sizes
};

/**
 * Get optimal chunk size based on file size
 */
export const getOptimalChunkSize = (fileSize: number): number => {
  if (fileSize > 5 * 1024 * 1024 * 1024) {
    return 200 * 1024 * 1024; // 200MB for very large files
  }
  return CHUNK_SIZE;
};
