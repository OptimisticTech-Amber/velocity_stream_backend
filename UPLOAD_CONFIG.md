# Video Upload & Transcoding Configuration

## Chunked Upload Settings

```env
# Enable/disable chunked upload (auto-enabled for files > 500MB)
ENABLE_CHUNKED_UPLOAD=true

# Chunk size in MB (default: 100MB)
CHUNK_SIZE_MB=100

# Maximum concurrent chunks to upload (default: 4)
MAX_CONCURRENT_CHUNKS=4

# Minimum file size to use chunked upload (default: 500MB)
MIN_CHUNKED_UPLOAD_SIZE=524288000
```

## Transcoding Settings

```env
# FFmpeg threads (0 = auto-detect)
FFMPEG_THREADS=4

# HLS segment time in seconds
HLS_SEGMENT_TIME=6

# GPU Encoding (auto-detected, but can be forced)
# Options: libx264 (software), h264_nvenc (NVIDIA), h264_qsv (Intel)
FFMPEG_ENCODER=auto

# Video quality renditions
# Format: "width:height:bitrate;width:height:bitrate;..."
VIDEO_RENDITIONS="640:360:600k;842:480:1000k;1280:720:2000k;1920:1080:4000k"
```

## MinIO/S3 Settings

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=Amber@786
MINIO_BUCKET=videos
```

## Performance Tuning

### For Large Files (2-5GB)

- Chunk Size: 100-200MB
- Concurrent Chunks: 4-8 (depends on bandwidth)
- Video Bitrates: 600k/1000k/2000k/4000k

### For Max Speed (with GPU)

- Use NVIDIA GPU encoding (h264_nvenc) if available
- Increase concurrent chunks: 8-16
- Use ultrafast encoding preset

### For Bandwidth Optimization

- Reduce concurrent chunks: 2-3
- Increase chunk size: 200MB
- Use lower bitrates for lower quality tiers

## Monitoring Upload Progress

The chunked upload now provides real-time progress updates:

- Total chunks processed
- Upload percentage
- Per-chunk status
- Automatic retries on failure

## Resumable Uploads

Coming soon: Support for resuming interrupted uploads by tracking uploaded chunks.
