# FFmpeg & MinIO Integration Guide

## Overview

This guide explains the three implemented features for FFmpeg and MinIO integration:

1. **Upload HLS files to MinIO** after processing
2. **Stream FFmpeg output directly to MinIO** without local storage
3. **Store FFmpeg binary in MinIO** for distributed access

---

## Feature 1: Upload HLS Files to MinIO

### What It Does

Processes video locally with FFmpeg to HLS format, then uploads all segments and playlist to MinIO.

### Use Cases

- Need local backup while also storing in MinIO
- Want to verify video output before permanent storage
- Need both local and cloud storage for redundancy

### Implementation

```typescript
import { processVideoWithMinIOUpload } from "./services/VideoProcessor";

const result = await processVideoWithMinIOUpload(videoPath, videoId);
// Returns:
// {
//   localPath: "hls/video123",
//   playlistUrl: "http://localhost:9000/videos/hls/video123/index.m3u8",
//   segmentUrls: ["http://localhost:9000/videos/hls/video123/segment_000.ts", ...]
// }
```

### API Reference

**Function:** `processVideoWithMinIOUpload(filePath: string, videoId: string)`

| Parameter | Type   | Description              |
| --------- | ------ | ------------------------ |
| filePath  | string | Path to input video file |
| videoId   | string | Unique video identifier  |

**Returns:** Promise with playlistUrl and segmentUrls

### Configuration

No additional configuration needed. The function uses existing MinIO setup from `src/shared/s3.ts`:

- Bucket: `videos`
- Endpoint: `http://localhost:9000`
- Folder structure: `/hls/{videoId}/`

---

## Feature 2: Stream FFmpeg Output to MinIO

### What It Does

Streams FFmpeg output directly to MinIO without keeping files on local disk (except temporarily during processing).

### Use Cases

- Minimize local disk space usage
- Process large videos without disk bottleneck
- Faster uploads for distributed systems
- Serverless/container deployments with limited storage

### Implementation

```typescript
import { processVideoStreamToMinIO } from "./services/VideoProcessor";

const result = await processVideoStreamToMinIO(videoPath, videoId);
// Returns:
// {
//   playlistUrl: "http://localhost:9000/videos/hls-stream/video123/index.m3u8"
// }
```

### How It Works

1. Creates temporary directory for HLS segments
2. Runs FFmpeg and outputs to temp folder
3. As soon as FFmpeg finishes, uploads files to MinIO
4. Immediately deletes temporary directory
5. Returns MinIO URLs

### API Reference

**Function:** `processVideoStreamToMinIO(filePath: string, videoId: string)`

| Parameter | Type   | Description              |
| --------- | ------ | ------------------------ |
| filePath  | string | Path to input video file |
| videoId   | string | Unique video identifier  |

**Returns:** Promise with playlistUrl only

### Configuration

Streaming directly to MinIO requires:

- MinIO running and accessible
- S3Client properly configured in `src/shared/s3.ts` ✅ (Already set up)
- Bucket permissions allowing write access ✅ (Already set up)

---

## Feature 3: FFmpeg Binary Management

### What It Does

Store FFmpeg executable in MinIO and automatically download/cache for use.

### Use Cases

- Distribute FFmpeg across multiple servers
- Consistent FFmpeg version across deployments
- Reduce deployment package size
- Update FFmpeg without redeploying containers

### Implementation

```typescript
import FFmpegBinaryManager from "./services/FFmpegBinaryManager";

// Upload FFmpeg to MinIO (one-time)
const url = await FFmpegBinaryManager.uploadBinaryToMinIO("path/to/ffmpeg.exe");

// Download and cache (automatic)
const binaryPath = await FFmpegBinaryManager.getBinary();
// Returns local path, downloads from MinIO if needed

// Check cache
const cachedPath = FFmpegBinaryManager.getCachedBinaryPath();

// Clear cache
FFmpegBinaryManager.clearCache();
```

### API Reference

**Class:** `FFmpegBinaryManager`

#### Methods

| Method                      | Returns           | Description                         |
| --------------------------- | ----------------- | ----------------------------------- |
| `uploadBinaryToMinIO(path)` | Promise\<string\> | Upload FFmpeg exe to MinIO          |
| `downloadBinaryFromMinIO()` | Promise\<string\> | Download and cache FFmpeg           |
| `getBinary()`               | Promise\<string\> | Get binary (system > cache > MinIO) |
| `getCachedBinaryPath()`     | string \| null    | Get cached binary path if exists    |
| `clearCache()`              | void              | Delete cached binary                |
| `listBinariesInMinIO()`     | Promise\<array\>  | List binaries in MinIO              |

### Cache Location

FFmpeg binary is cached at:

```
./.ffmpeg_cache/ffmpeg.exe
```

### Binary Priority

When calling `getBinary()`, it checks in this order:

1. System PATH (`ffmpeg` or `ffmpeg.exe`)
2. Local cache (`.ffmpeg_cache/ffmpeg.exe`)
3. MinIO (downloads if not found locally)

### First-Time Setup

```typescript
// Step 1: Upload FFmpeg to MinIO (one-time per deployment)
const ffmpegPath = "C:\\path\\to\\ffmpeg.exe";
const minioUrl = await FFmpegBinaryManager.uploadBinaryToMinIO(ffmpegPath);
console.log("FFmpeg available at:", minioUrl);

// Step 2: On app startup, it auto-downloads if needed
const binaryPath = await FFmpegBinaryManager.getBinary();
// Use binaryPath for video processing
```

---

## Integration Examples

### Example 1: Basic Upload HLS to MinIO

```typescript
import { processVideoWithMinIOUpload } from "./services/VideoProcessor";

app.post("/upload-video", async (req, res) => {
  const { filePath, videoId } = req.body;

  try {
    const result = await processVideoWithMinIOUpload(filePath, videoId);
    res.json({
      success: true,
      playlistUrl: result.playlistUrl,
      message: "HLS files uploaded to MinIO",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Example 2: Streaming Upload (Low Disk)

```typescript
import { processVideoStreamToMinIO } from "./services/VideoProcessor";

app.post("/upload-stream", async (req, res) => {
  const { filePath, videoId } = req.body;

  try {
    const result = await processVideoStreamToMinIO(filePath, videoId);
    res.json({
      success: true,
      playlistUrl: result.playlistUrl,
      message: "Video streamed to MinIO (no local copy)",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Example 3: Complete Workflow

```typescript
import FFmpegBinaryManager from "./services/FFmpegBinaryManager";
import { processVideoWithMinIOUpload } from "./services/VideoProcessor";

async function completeWorkflow(videoPath, videoId) {
  // Ensure FFmpeg is available
  const ffmpegPath = await FFmpegBinaryManager.getBinary();
  console.log("Using FFmpeg:", ffmpegPath);

  // Process video
  const result = await processVideoWithMinIOUpload(videoPath, videoId);

  return {
    ffmpeg: ffmpegPath,
    playlistUrl: result.playlistUrl,
    segments: result.segmentUrls.length,
  };
}
```

### Example 4: Update Existing Upload Service

In `src/services/UploadServices.ts`, replace the current video processing with:

```typescript
import { processVideoWithMinIOUpload } from "./VideoProcessor";

export const uploadVideo = async (file: any, metadata: any) => {
  try {
    // ... existing validation code ...

    // New: Process video and upload HLS to MinIO
    const processResult = await processVideoWithMinIOUpload(
      file.path,
      metadata.movieId || metadata.episodeId,
    );

    // Send Kafka message with MinIO URL instead of Cloudinary
    await sendMessage("video.upload", {
      ...metadata,
      url: processResult.playlistUrl,
      videoUrl: processResult.playlistUrl,
      videoId: metadata.movieId || metadata.episodeId,
      fileSize: file.size,
      hlsSegments: processResult.segmentUrls,
    });

    return {
      message: "Processing started",
      playlistUrl: processResult.playlistUrl,
      hlsUrl: processResult.playlistUrl,
    };
  } catch (error) {
    console.error("❌ Error in uploadVideo:", error);
    throw error;
  }
};
```

---

## Comparison Table

| Feature           | Local Only | Upload to MinIO | Stream to MinIO |
| ----------------- | ---------- | --------------- | --------------- |
| Disk Space Used   | High       | High (then del) | Minimal         |
| Local Backup      | Yes        | Yes             | No              |
| Upload Speed      | N/A        | Normal          | Normal          |
| Use Case          | Testing    | Production      | Large Videos    |
| Redundancy        | None       | Yes             | Cloud only      |
| Clean-up Required | Manual     | Auto            | Auto            |

---

## MinIO Folder Structure

After implementation, your MinIO `videos` bucket will look like:

```
videos/
├── hls/
│   ├── video123/
│   │   ├── index.m3u8
│   │   ├── segment_000.ts
│   │   ├── segment_001.ts
│   │   └── ...
│   └── video456/
│       └── ...
├── hls-stream/
│   ├── video789/
│   │   └── index.m3u8
│   └── ...
└── binaries/
    └── ffmpeg/
        └── ffmpeg.exe
```

---

## Error Handling

### Common Errors

**MinIO Connection Failed**

```typescript
try {
  const result = await processVideoWithMinIOUpload(path, id);
} catch (error) {
  if (error.message.includes("ECONNREFUSED")) {
    console.error("MinIO is not running. Start with: docker compose up -d");
  }
}
```

**FFmpeg Not Found**

```typescript
try {
  const binary = await FFmpegBinaryManager.getBinary();
} catch (error) {
  if (error.message.includes("FFmpeg binary not found")) {
    console.error("Upload FFmpeg to MinIO first");
  }
}
```

**Insufficient Disk Space (Streaming Mode)**

```typescript
// Use streaming mode to avoid temp file issues
const result = await processVideoStreamToMinIO(path, id);
```

---

## Performance Considerations

### Streaming vs. Upload

**Stream Mode (Recommended for large files):**

- No local disk copy retained
- Faster for videos > 500MB
- Better for serverless deployments
- Less disk I/O

**Upload Mode:**

- Keep local copy for verification
- Safer (backup available)
- Good for smaller videos
- Allows local reprocessing

### Suggested Thresholds

```typescript
const VIDEO_SIZE_THRESHOLD = 500 * 1024 * 1024; // 500MB

if (fileSize > VIDEO_SIZE_THRESHOLD) {
  result = await processVideoStreamToMinIO(path, id); // Stream
} else {
  result = await processVideoWithMinIOUpload(path, id); // Upload
}
```

---

## Environment Variables

No additional environment variables needed. Uses existing MinIO config:

```env
# MinIO is configured in src/shared/s3.ts with hardcoded values:
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=Amber
MINIO_SECRET_KEY=Amber@786
MINIO_BUCKET=videos
```

To customize, update `src/shared/s3.ts`:

```typescript
endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
credentials: {
  accessKeyId: process.env.MINIO_ACCESS_KEY || "Amber",
  secretAccessKey: process.env.MINIO_SECRET_KEY || "Amber@786",
},
```

---

## Troubleshooting

### "Cannot read HLS files from temp directory"

**Solution:** Ensure write permissions on temp directory:

```bash
# Windows
attrib -R -H temp_hls\*.*
# Linux
chmod -R 755 temp_hls/
```

### "MinIO bucket does not exist"

**Solution:** MinIO bucket auto-creation is not enabled. Create manually:

```bash
# Using MinIO Console or CLI
aws s3 mb s3://videos --endpoint-url http://localhost:9000
```

### "FFmpeg binary download failed"

**Solution:** First upload binary to MinIO:

```typescript
await FFmpegBinaryManager.uploadBinaryToMinIO("path/to/ffmpeg.exe");
```

---

## Next Steps

1. ✅ Features implemented in `src/services/VideoProcessor.ts`
2. ✅ MinIO functions added in `src/shared/s3.ts`
3. ✅ Binary manager created in `src/services/FFmpegBinaryManager.ts`
4. 📋 Integration: Update your routes/controllers to use new functions
5. 📋 Testing: Run examples from `src/services/FFmpegMinIOExamples.ts`
6. 📋 Monitoring: Add logging to track upload success/failures

---

## Support

For issues or questions:

- Check error logs in console output
- Verify MinIO is running: `docker compose ps`
- Verify FFmpeg is installed and can be executed
- Check MinIO storage capacity: `docker compose exec minio df -h`
