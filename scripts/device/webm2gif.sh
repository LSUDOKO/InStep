#!/usr/bin/env bash
# usage: webm2gif.sh in.webm out.gif [speed=2] [width=720] [fps=8] [startSec=0]  — real recording, played faster, palette-optimised
in=$1; out=$2; speed=${3:-2}; w=${4:-720}; fps=${5:-8}; ss=${6:-0}
ffmpeg -loglevel error -y -ss "$ss" -i "$in" -vf "setpts=PTS/$speed,fps=$fps,scale=$w:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" "$out"
printf "%s %s KB\n" "$out" $(( $(stat -c %s "$out") / 1024 ))
