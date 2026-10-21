#!/usr/bin/env bash
# usage: record-lesson.sh <name> <delaySec> <maxSec>   (TV must be on the Pair screen with a fresh room)
S=${INSTEP_CAPTURE:-$HOME/instep-capture}
name=$1; delay=${2:-6}; max=${3:-150}
cd /home/arpit/Desktop/hackathon_projects/InStep
room=$(timeout 60 render logs -r srv-dbcadjui0phs73ataj4g --limit 40 -o text 2>/dev/null | grep "tv in room" | tail -1 | grep -oE '"room":"[0-9]+"' | grep -oE '[0-9]+')
echo "room=$room"
rm -f /home/arpit/emushots/$name.webm
docker exec -u arpit vega python3 /home/arpit/emushots/rec.py start /home/arpit/emushots/$name.webm
(timeout $max pnpm -s demo-learner --room $room --server https://instep-wfcr.onrender.com --delay $delay > $S/learner-$name.log 2>&1 & echo $! > $S/learner-$name.pid)
for i in $(seq 1 $max); do sleep 1; grep -q "lesson ended" $S/learner-$name.log && break; done
sleep 4
docker exec -u arpit vega python3 /home/arpit/emushots/rec.py stop
sleep 2; cat $S/learner-$name.log | tail -20; ls -la /home/arpit/emushots/$name.webm | awk '{print $5}'
