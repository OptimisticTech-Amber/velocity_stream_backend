import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { uploadHLSFilesToMinIO } from "../shared/s3";

// Standard video processing with local HLS output and then upload to MinIO
export function processVideo(
  filePath: string,
  videoId: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputDir = `hls/${videoId}`;
    fs.mkdirSync(outputDir, { recursive: true });

    ffmpeg(filePath)
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
      .on("error", (err: unknown) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      })
      .run();
  });
}

// Process video and automatically upload HLS files to MinIO
export async function processVideoWithMinIOUpload(
  filePath: string,
  videoId: string,
): Promise<{ localPath: string; playlistUrl: string; segmentUrls: string[] }> {
  try {
    // Process video locally first
    const outputDir = await processVideo(filePath, videoId);
    console.log(`📹 Video processed locally: ${outputDir}`);

    // Upload HLS files to MinIO
    const { playlistUrl, segmentUrls } = await uploadHLSFilesToMinIO(
      outputDir,
      videoId,
    );
    console.log(`📤 HLS files uploaded to MinIO`);

    // Optionally clean up local files after successful upload
    // fs.rmSync(outputDir, { recursive: true });

    return {
      localPath: outputDir,
      playlistUrl,
      segmentUrls,
    };
  } catch (error) {
    console.error("❌ Error in processVideoWithMinIOUpload:", error);
    throw error;
  }
}

// Stream FFmpeg output directly to MinIO without saving locally (streaming mode)
export function processVideoStreamToMinIO(
  filePath: string,
  videoId: string,
): Promise<{ playlistUrl: string }> {
  return new Promise((resolve, reject) => {
    // For streaming directly to MinIO, we still need to use HLS which generates multiple files
    // So we'll use a temporary directory and clean it up after upload
    const tempDir = `temp_hls/${videoId}`;
    const playlistFileName = "index.m3u8";
    const playlistPath = path.join(tempDir, playlistFileName);

    fs.mkdirSync(tempDir, { recursive: true });

    ffmpeg(filePath)
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
          let playlistContent = fs.readFileSync(playlistPath, "utf-8");

          // Upload files to MinIO
          const files = fs.readdirSync(tempDir);
          let playlistUrl = "";

          const { PutObjectCommand } = await import("@aws-sdk/client-s3");
          const { s3 } = await import("../shared/s3");
          const { ObjectCannedACL } = await import("@aws-sdk/client-s3");

          for (const file of files) {
            const filePath = path.join(tempDir, file);
            const fileContent = fs.readFileSync(filePath);
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
          fs.rmSync(tempDir, { recursive: true });
          console.log(`🗑️  Cleaned up temporary directory: ${tempDir}`);

          resolve({ playlistUrl });
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (err: unknown) => {
        // Clean up on error
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
        }
        reject(err instanceof Error ? err : new Error(String(err)));
      })
      .run();
  });
}
