#!/usr/bin/env bash
# Final clean capture run: TV must be on the Pair screen with a fresh room on the (redeployed) server.
S=${INSTEP_CAPTURE:-$HOME/instep-capture}
cd /home/arpit/Desktop/hackathon_projects/InStep
$S/tvshot.sh tv-f-00 >/dev/null
room=$(timeout 60 render logs -r srv-dbcadjui0phs73ataj4g --limit 30 -o text 2>/dev/null | grep "tv in room" | tail -1 | grep -oE '"room":"[0-9]+"' | grep -oE '[0-9]+')
echo "room=$room"
(timeout 300 pnpm -s demo-learner --room $room --server https://instep-wfcr.onrender.com --delay 12 > $S/learner-f.log 2>&1 & echo $! > $S/learner-f.pid)
for i in $(seq -w 1 22); do sleep 4; $S/tvshot.sh tv-f-$i >/dev/null; done
cat $S/learner-f.log
