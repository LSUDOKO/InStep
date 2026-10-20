#!/usr/bin/env bash
# Regenerates the spike test video (H.264 MP4, 20 s, 720p30) and a short chime (MP3).
set -euo pipefail
cd "$(dirname "$0")/media"
ffmpeg -loglevel error -y -f lavfi -i testsrc2=size=1280x720:rate=30 -f lavfi -i sine=frequency=440:sample_rate=48000 \
  -t 20 -c:v libx264 -pix_fmt yuv420p -profile:v high -c:a aac -movflags +faststart test.mp4
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=880:duration=0.6" -c:a libmp3lame -b:a 128k chime.mp3
echo "wrote spike/media/test.mp4 and chime.mp3"
