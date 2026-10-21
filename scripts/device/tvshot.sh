#!/usr/bin/env bash
# usage: tvshot.sh <name> -> scratchpad/<name>.png  (emulator console screenshot, reads the renderer)
S=${INSTEP_CAPTURE:-$HOME/instep-capture}
rm -f /home/arpit/emushots/*.png; docker exec -u arpit vega python3 /home/arpit/emushots/emu-shot.py /home/arpit/emushots >/dev/null; sleep 1.5
f=$(ls -t /home/arpit/emushots/*.png 2>/dev/null | head -1); cp "$f" "$S/$1.png" && echo "$S/$1.png"
