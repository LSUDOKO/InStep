#!/usr/bin/env bash
# usage: tvkey.sh KEY_ENTER KEY_DOWN KEY_UP KEY_LEFT KEY_RIGHT KEY_BACK sleep:1 ...  (on-device inputd-cli; no window focus needed)
cmd=""
for k in "$@"; do
  if [[ $k == sleep:* ]]; then cmd+="sleep ${k#sleep:}; "; else cmd+="inputd-cli button_press $k >/dev/null 2>&1; sleep 0.5; "; fi
done
cd /home/arpit && distrobox enter vega -- bash -c "unset NODE_OPTIONS; source ~/vega/env; vega device run-cmd -d VirtualDevice --command '$cmd' >/dev/null 2>&1" 2>/dev/null
