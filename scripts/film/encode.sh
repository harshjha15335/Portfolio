#!/bin/sh
# Encode the composited frames and the score into the web film. Usage: encode.sh <comp-frames-dir> <score.wav> <out-dir>
set -e
frames=$1; score=$2; out=$3
ffmpeg -y -loglevel error -framerate 24 -i "$frames/%04d.png" -i "$score" -c:v libx264 -preset slow -profile:v main -level 3.1 -pix_fmt yuv420p \
  -b:v 1500k -maxrate 2200k -bufsize 3000k -pass 1 -an -f mp4 /dev/null
ffmpeg -y -loglevel error -framerate 24 -i "$frames/%04d.png" -i "$score" -c:v libx264 -preset slow -profile:v main -level 3.1 -pix_fmt yuv420p \
  -b:v 1500k -maxrate 2200k -bufsize 3000k -pass 2 -c:a aac -b:a 128k -movflags +faststart -shortest "$out/talkies-film.mp4"
ffmpeg -y -loglevel error -framerate 24 -i "$frames/%04d.png" -i "$score" -c:v libvpx-vp9 -b:v 1300k -row-mt 1 -deadline good -cpu-used 2 -pass 1 -an -f webm /dev/null
ffmpeg -y -loglevel error -framerate 24 -i "$frames/%04d.png" -i "$score" -c:v libvpx-vp9 -b:v 1300k -row-mt 1 -deadline good -cpu-used 2 -pass 2 -c:a libopus -b:a 112k -shortest "$out/talkies-film.webm"
# Poster: the title frame at 35.9 s.
ffmpeg -y -loglevel error -i "$frames/0862.png" -q:v 3 "$out/talkies-film.jpg"
rm -f ffmpeg2pass-0.log ffmpeg2pass-0.log.mbtree
