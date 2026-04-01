import { sendMessage } from "../kafka/producer";
import { minioUpload, uploadToStorage } from "../shared/s3";
import fs from "fs";
import path from "path";

export const uploadVideo = async (file: any, metadata: any) => {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    if (!file.path) {
      throw new Error("File path is missing");
    }

    console.log(`📤 Uploading file to Cloudinary: ${file.originalname}`);

    const key = `${metadata.type}/${metadata.movieId || metadata.episodeId || Date.now()}-${file.originalname}`;

    // let result = (await uploadToStorage(file.path, key, file.size)) as {
    //   url: string;
    // };
    let minioResult = await minioUpload(file.path, key, file.size);

    console.log(`✅ File uploaded to MinIO: ${minioResult?.url}`);

    // console.log(`✅ File uploaded to Cloudinary: ${result.url}`);

    // Send message to Kafka with the Cloudinary URL
    // This URL is already HLS-ready from Cloudinary
    // const videoUrl = result.url;
    const minioVideoUrl = minioResult?.url;

    // await sendMessage("video.upload", {
    //   ...metadata,
    //   url: videoUrl,
    //   videoUrl: videoUrl, // Cloudinary URL is immediately playable
    //   videoId: metadata.movieId || metadata.episodeId || key.split("/")[1],
    //   fileSize: file.size,
    // });

    // Send to consumer2 with MinIO URL instead of file path
    // Consumer will download from MinIO for transcoding
    await sendMessage("video.upload3", {
      ...metadata,
      minioUrl: minioVideoUrl, // Use MinIO URL for consumer processing
      originalFileName: file.originalname,
      fileSize: file.size,
      videoId: metadata.movieId || metadata.episodeId || key.split("/")[1],
      key: key,
      uploadedAt: new Date().toISOString(),
    });

    console.log(
      `✅ Video upload metadata sent to Kafka for: ${metadata.title}`,
    );

    // Clean up the temporary file after messages are sent
    // Use setTimeout to ensure consumer processes before deletion, or just keep for safety
    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting temp file:", err);
      else console.log(`🗑️  Temp file cleaned: ${file.path}`);
    });

    return {
      message: "Processing started",
      minioUrl: minioVideoUrl,
    };
  } catch (error) {
    console.error("❌ Error in uploadVideo:", error);
    throw error;
  }
};
