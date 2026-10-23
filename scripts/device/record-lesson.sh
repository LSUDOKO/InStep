#!/usr/bin/env bash
# usage: record-lesson.sh <name> <delaySec> <maxSec>   (TV must be on the Pair screen with a fresh room)
S=${INSTEP_CAPTURE:-$HOME/instep-capture}
name=$1; delay=${2:-6}; max=${3:-240}
cd /home/arpit/Desktop/hackathon_projects/InStep
# the TV's newest room: only log lines after this lesson's app launch (LAUNCHED, set by record-all.sh) count,
# and Render's log stream lags, so poll until it shows up
since=${LAUNCHED:-$(date -u -d '-2 min' +%Y-%m-%dT%H:%M:%SZ)}
for i in $(seq 1 20); do
  room=$(timeout 30 render logs -r srv-dbcadjui0phs73ataj4g --start "$since" --limit 100 -o text 2>/dev/null | grep "tv in room" | tail -1 | grep -oE '"room":"[0-9]+"' | grep -oE '[0-9]+')
  [ -n "$room" ] && break; sleep 3
done
echo "room=$room"
if [ -z "$REC_T0" ]; then   # record-all.sh starts the recording earlier, from the lesson page
  rm -f /home/arpit/emushots/$name.webm
  docker exec -u arpit vega python3 /home/arpit/emushots/rec.py start /home/arpit/emushots/$name.webm; REC_T0=$(date +%s)
fi
echo "$name: learner starts at +$(( $(date +%s) - REC_T0 ))s into the recording" | tee -a $S/offsets.log
(timeout $max pnpm -s demo-learner --room $room --server https://instep-wfcr.onrender.com --delay $delay > $S/learner-$name.log 2>&1 & echo $! > $S/learner-$name.pid)
for i in $(seq 1 $max); do sleep 1; grep -q "lesson ended" $S/learner-$name.log && break; done
sleep 4
docker exec -u arpit vega python3 /home/arpit/emushots/rec.py stop
sleep 2; cat $S/learner-$name.log | tail -20; ls -la /home/arpit/emushots/$name.webm | awk '{print $5}'
