# FFmpeg & MinIO Quick Reference

## Three Main Features

### 1️⃣ Upload HLS to MinIO (Default)

```typescript
import { processVideoWithMinIOUpload } from "./services/VideoProcessor";

const { playlistUrl, segmentUrls, localPath } =
  await processVideoWithMinIOUpload(videoPath, videoId);
```

✅ Processes locally + uploads to MinIO  
✅ Keeps local backup  
✅ Best for reliability

---

### 2️⃣ Stream to MinIO (No Local Copy)

```typescript
import { processVideoStreamToMinIO } from "./services/VideoProcessor";

const { playlistUrl } = await processVideoStreamToMinIO(videoPath, videoId);
```

✅ Minimal disk usage  
✅ Auto cleanup  
✅ Best for large files (>500MB)

---

### 3️⃣ Manage FFmpeg Binary

```typescript
import FFmpegBinaryManager from "./services/FFmpegBinaryManager";

// Upload (one-time)
await FFmpegBinaryManager.uploadBinaryToMinIO("C:\\ffmpeg.exe");

// Get binary (auto-downloads if needed)
const path = await FFmpegBinaryManager.getBinary();
```

✅ Distribute FFmpeg via MinIO  
✅ Auto-caching  
✅ Fallback to system FFmpeg

---

## Comparison

| Task          | Use This                                    |
| ------------- | ------------------------------------------- |
| Normal videos | `processVideoWithMinIOUpload()`             |
| Large videos  | `processVideoStreamToMinIO()`               |
| Share FFmpeg  | `FFmpegBinaryManager.uploadBinaryToMinIO()` |
| Get FFmpeg    | `FFmpegBinaryManager.getBinary()`           |

---

## Complete Workflow

```typescript
// 1. Start up
const ffmpeg = await FFmpegBinaryManager.getBinary();

// 2. Process & upload
const { playlistUrl } = await processVideoWithMinIOUpload(filePath, videoId);

// 3. Use URL
console.log("Stream at:", playlistUrl);
```

---

## File Structure

```
✅ src/shared/s3.ts
   └─ uploadHLSFilesToMinIO()
   └─ uploadFFmpegBinaryToMinIO()
   └─ downloadFFmpegBinaryFromMinIO()

✅ src/services/VideoProcessor.ts
   └─ processVideo() [original]
   └─ processVideoWithMinIOUpload() [NEW]
   └─ processVideoStreamToMinIO() [NEW]

✅ src/services/FFmpegBinaryManager.ts [NEW]
   └─ uploadBinaryToMinIO()
   └─ downloadBinaryFromMinIO()
   └─ getBinary()
   └─ getCachedBinaryPath()
   └─ clearCache()

✅ src/services/FFmpegMinIOExamples.ts [NEW]
   └─ 5 usage examples

✅ FFMPEG_MINIO_INTEGRATION.md [NEW]
   └─ Full documentation

✅ FFMPEG_MINIO_QUICK_REFERENCE.md [THIS FILE]
   └─ Quick reference
```

---

## Common Patterns

### Pattern 1: Replace Existing Upload

```typescript
// Old
const result = await processVideo(file.path, videoId);

// New
const { playlistUrl } = await processVideoWithMinIOUpload(file.path, videoId);
```

### Pattern 2: By File Size

```typescript
const result =
  fileSize > 500_000_000
    ? await processVideoStreamToMinIO(path, id)
    : await processVideoWithMinIOUpload(path, id);
```

### Pattern 3: With Error Handling

```typescript
try {
  const { playlistUrl } = await processVideoWithMinIOUpload(path, id);
  await kafka.send("video.ready", { playlistUrl });
} catch (error) {
  console.error("Video processing failed:", error);
  await kafka.send("video.failed", { error: error.message });
}
```

---

## MinIO URLs

After upload, files are at:

**Upload Mode:**

```
http://localhost:9000/videos/hls/{videoId}/index.m3u8          [Playlist]
http://localhost:9000/videos/hls/{videoId}/segment_000.ts       [Segment 1]
http://localhost:9000/videos/hls/{videoId}/segment_001.ts       [Segment 2]
```

**Stream Mode:**

```
http://localhost:9000/videos/hls-stream/{videoId}/index.m3u8    [Playlist]
http://localhost:9000/videos/hls-stream/{videoId}/segment_*.ts  [Segments]
```

**Binary:**

```
http://localhost:9000/videos/binaries/ffmpeg/ffmpeg.exe
```

---

## Troubleshooting

| Problem                  | Solution                                        |
| ------------------------ | ----------------------------------------------- |
| MinIO connection refused | `docker compose up -d`                          |
| FFmpeg not found         | `FFmpegBinaryManager.uploadBinaryToMinIO(path)` |
| Disk full error          | Use `processVideoStreamToMinIO()`               |
| Cache issues             | `FFmpegBinaryManager.clearCache()`              |

---

## Examples Location

All 5 complete examples are in:

```
src/services/FFmpegMinIOExamples.ts
```

Import and run:

```typescript
import {
  example1_ProcessAndUpload,
  example2_StreamToMinIO,
  example3_UploadFFmpegBinary,
  example4_ManageBinary,
  example5_CompleteWorkflow,
} from "./services/FFmpegMinIOExamples";
```

---

## Benefits

✅ Multiple upload strategies  
✅ Distributed FFmpeg binary  
✅ Minimal disk footprint  
✅ Auto-caching  
✅ Production-ready error handling  
✅ Backward compatible (original processVideo still works)

---

## Next: Integration Steps

1. Update your routes/controllers
2. Replace `processVideo()` calls with `processVideoWithMinIOUpload()`
3. Upload FFmpeg to MinIO: `await FFmpegBinaryManager.uploadBinaryToMinIO(...)`
4. Test with examples from `FFmpegMinIOExamples.ts`
5. Deploy! 🚀
