#!/usr/bin/env bash
# Renders "The Forest Walk" — original illustrated title cards (no people, no third-party assets) for the
# Kids' Active Storytime demo lesson. Scene times match content/lessons/kids-forest-walk-v1/track.istep gates.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=content/lessons/kids-forest-walk-v1
FONT=${FONT:-/usr/share/fonts/noto/NotoSans-Bold.ttf}
[ -f "$FONT" ] || { echo "Font not found: $FONT (set FONT=/path/to/bold.ttf)"; exit 1; }

txt() { # text, size, y, start, end, colour
  echo "drawtext=fontfile=$FONT:text='$1':fontsize=$2:fontcolor=${6:-white}:x=(w-text_w)/2:y=$3:enable='between(t,$4,$5)'"
}
bg() { echo "drawbox=x=0:y=0:w=iw:h=ih:color=$1:t=fill:enable='between(t,$2,$3)'"; }

F=(
  "$(bg 0x1E5631 0 11)" "$(bg 0x2F4858 11 19)" "$(bg 0xF4A259 19 28)" "$(bg 0x5B8E7D 28 40)"
  # ground
  "drawbox=x=0:y=ih-180:w=iw:h=180:color=0x3B2F2F:t=fill"
  # scene 1 + tree (trunk + three canopy layers)
  "$(txt 'The Forest Walk' 130 160 0 4)"
  "$(txt 'Let us walk into the forest together!' 64 340 0 4 0xFFE8A3)"
  "drawbox=x=(iw/2)-40:y=ih-480:w=80:h=300:color=0x6B4226:t=fill:enable='between(t,3.5,11)'"
  "drawbox=x=(iw/2)-260:y=ih-650:w=520:h=200:color=0x2E8B57:t=fill:enable='between(t,3.5,11)'"
  "drawbox=x=(iw/2)-190:y=ih-790:w=380:h=160:color=0x3CB371:t=fill:enable='between(t,3.5,11)'"
  "drawbox=x=(iw/2)-110:y=ih-900:w=220:h=130:color=0x66CDAA:t=fill:enable='between(t,3.5,11)'"
  "$(txt 'Stretch tall like a tree!' 110 60 3.5 11)"
  # scene 2 mouse (body + ears)
  "drawbox=x=(iw/2)-160:y=ih-330:w=320:h=150:color=0xB0B0B0:t=fill:enable='between(t,11,19)'"
  "drawbox=x=(iw/2)+120:y=ih-380:w=90:h=90:color=0xC8C8C8:t=fill:enable='between(t,11,19)'"
  "drawbox=x=(iw/2)-420:y=ih-240:w=260:h=16:color=0xC8C8C8:t=fill:enable='between(t,11,19)'"
  "$(txt 'Crouch small like a mouse!' 110 120 11 19)"
  "$(txt 'Squeak squeak!' 72 300 13 19 0xFFE8A3)"
  # scene 3 flamingo (body + one leg)
  "drawbox=x=(iw/2)-150:y=ih-640:w=300:h=170:color=0xFF6F91:t=fill:enable='between(t,19,28)'"
  "drawbox=x=(iw/2)-10:y=ih-470:w=20:h=290:color=0xFF6F91:t=fill:enable='between(t,19,28)'"
  "drawbox=x=(iw/2)+120:y=ih-860:w=24:h=230:color=0xFF6F91:t=fill:enable='between(t,19,28)'"
  "$(txt 'Stand on one foot like a flamingo!' 96 100 19 28 0x2B2B2B)"
  "$(txt 'Can you hold it?' 72 260 21 28 0x2B2B2B)"
  # scene 4 wave
  "$(txt 'Wave goodbye to the forest!' 110 160 28 37)"
  "$(txt 'Bye bye, trees!' 80 360 30 37 0xFFE8A3)"
  "$(txt 'The End' 160 400 37 40)"
)
FILTER=$(IFS=,; echo "${F[*]}")
ffmpeg -loglevel error -y -f lavfi -i color=c=black:s=1920x1080:r=30:d=40 -f lavfi -i anullsrc=r=48000:cl=stereo \
  -vf "$FILTER" -t 40 -c:v libx264 -preset medium -pix_fmt yuv420p -profile:v high -c:a aac -shortest -movflags +faststart "$OUT/video.mp4"
ffmpeg -loglevel error -y -ss 7 -i "$OUT/video.mp4" -frames:v 1 -vf scale=1280:720 "$OUT/poster.jpg"
echo "wrote $OUT/video.mp4 and poster.jpg"
