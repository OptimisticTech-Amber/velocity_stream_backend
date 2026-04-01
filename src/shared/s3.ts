// shared/cloudinary-storage.ts
import cloudinary from "../config/cloudinary";
import fs from "fs";
import { Readable } from "stream";
import path from "path";
import { Client as MinioClient } from "minio";

import {
  PutObjectCommand,
  S3Client,
  ObjectCannedACL,
} from "@aws-sdk/client-s3";

// Keep s3 only if other parts still use AWS commands
export const s3 = new S3Client({
  region: "us-east-1",
  endpoint: "http://localhost:9000",
  credentials: {
    accessKeyId: "Amber",
    secretAccessKey: "Amber@786",
  },
  forcePathStyle: true,
});

export const minioClient = new MinioClient({
  endPoint: "localhost",
  port: 9000,
  useSSL: false,
  accessKey: "Amber",
  secretKey: "Amber@786",
});

export const minioUpload = async (
  fileOrBuffer: Buffer | string,
  key: string,
  size?: number,
) => {
  try {
    const bucket = "videos";
    const metaData = { "Content-Type": "video/mp4" };

    if (typeof fileOrBuffer === "string" && fs.existsSync(fileOrBuffer)) {
      await minioClient.fPutObject(bucket, key, fileOrBuffer, metaData);
    } else {
      const body =
        typeof fileOrBuffer === "string"
          ? Buffer.from(fileOrBuffer)
          : fileOrBuffer;

      await minioClient.putObject(
        bucket,
        key,
        body,
        size ?? body.length,
        metaData,
      );
    }

    return {
      message: "File uploaded successfully",
      url: `http://localhost:9000/${bucket}/${key}`,
    };
  } catch (error) {
    console.error("❌ MinIO upload error:", error);
    throw error;
  }
};

let bucketReady = false;

const ensureBucket = async () => {
  // Cloudinary doesn't require explicit bucket setup
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("CLOUDINARY_CLOUD_NAME environment variable is not set");
  }
  bucketReady = true;
};

export const uploadToStorage = async (
  fileOrBuffer: Buffer | string,
  key: string,
  size?: number,
) => {
  await ensureBucket();

  return new Promise((resolve, reject) => {
    const upload_stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        public_id: key,
        folder: "videos",
        // Video transformation settings
        ...(key.includes("processed") && {
          streaming_profile: "4k", // Auto-transcoding for HLS
          format: "m3u8", // HLS format
        }),
      },
      (error: any, result: any) => {
        if (error) {
          console.error("❌ Cloudinary upload error:", error);
          reject(error);
        } else {
          const streamUrl = result.secure_url || result.url;
          console.log(`✅ File uploaded to Cloudinary: ${streamUrl}`);
          resolve({ url: streamUrl });
        }
      },
    );

    // Handle both Buffer and file path
    if (typeof fileOrBuffer === "string") {
      // File path: read and stream
      const readStream = fs.createReadStream(fileOrBuffer);
      readStream.on("error", reject);
      readStream.pipe(upload_stream);
    } else {
      // Buffer: convert to stream and upload
      const bufferStream = Readable.from(fileOrBuffer);
      bufferStream.pipe(upload_stream);
    }
  });
};

export const getObjectKeyFromUrl = (objectUrl: string): string => {
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
  } catch (error) {
    console.error("Error parsing Cloudinary URL:", error);
  }
  return objectUrl;
};

export const getPresignedReadUrl = async (
  key: string,
  expirySeconds = 60 * 60 * 24,
) => {
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

export const bucket = "cloudinary"; // For compatibility

// Download video from MinIO by URL
export const downloadVideoFromMinIOUrl = async (
  minioUrl: string,
  outputPath: string,
): Promise<void> => {
  try {
    // Extract the key from MinIO URL
    // URL format: http://localhost:9000/videos/{key}
    const urlParts = minioUrl.split("/videos/");
    if (urlParts.length !== 2) {
      throw new Error(`Invalid MinIO URL format: ${minioUrl}`);
    }

    const key = urlParts[1];
    console.log(`📥 Downloading from MinIO: ${key}`);

    const { GetObjectCommand } = await import("@aws-sdk/client-s3");

    const getParams = {
      Bucket: "videos",
      Key: key,
    };

    const response = await s3.send(new GetObjectCommand(getParams));

    if (!response.Body) {
      throw new Error("No response body from MinIO");
    }

    // Convert stream to buffer and write to file
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Video downloaded to: ${outputPath}`);
  } catch (error) {
    console.error("❌ Error downloading from MinIO:", error);
    throw error;
  }
};
