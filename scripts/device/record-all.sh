#!/usr/bin/env bash
# Records lessons on the VVD, one fresh app launch per lesson: name|downs|rights|delay|max
S=${INSTEP_CAPTURE:-$HOME/instep-capture}
H=$(cd "$(dirname "$0")" && pwd)
cd /home/arpit
vega_sh() { distrobox enter vega -- bash -c "unset NODE_OPTIONS; source ~/vega/env; $1" 2>/dev/null | grep -v "command not found\|zprofile\|__git_prompt"; }
console_up() { docker exec -u arpit vega python3 -c "import socket; socket.create_connection(('127.0.0.1',5554),timeout=5).close()" >/dev/null 2>&1; }
ensure_device() {
  if ! console_up; then
    echo "VVD down → restarting ($(date +%H:%M:%S))"
    DISPLAY=:1 WAYLAND_DISPLAY=wayland-1 XDG_RUNTIME_DIR=/run/user/1000 vega_sh "export DISPLAY=:1 WAYLAND_DISPLAY=wayland-1 XDG_RUNTIME_DIR=/run/user/1000; vega virtual-device stop >/dev/null 2>&1; rm -rf ~/vega/sdk/vega-sdk/main/0.24.12112/vvd/instances/*/; vega virtual-device start --timeout 400 2>&1 | tail -1"
    sleep 25
  fi
}
launch_app() { vega_sh "cd ~/Desktop/hackathon_projects/InStep/apps/tv && vega run-app build/x86_64-debug/tv_x86_64.vpkg com.instep.tv.main -d VirtualDevice 2>&1 | tail -1"; sleep 9; }
for spec in "$@"; do
  IFS='|' read -r name downs rights delay max <<< "$spec"
  echo "=== $name ($(date +%H:%M:%S))"
  ensure_device; export LAUNCHED=$(date -u +%Y-%m-%dT%H:%M:%SZ); launch_app
  $H/tvkey.sh KEY_ENTER; sleep 3            # Profiles → Home (first profile)
  # Home opens with focus on the Top Shelf "Start lesson" button: one Down reaches the first lesson row
  keys=(KEY_DOWN sleep:1.5); for ((i=0;i<downs;i++)); do keys+=(KEY_DOWN sleep:1.2); done; for ((i=0;i<rights;i++)); do keys+=(KEY_RIGHT sleep:0.8); done
  $H/tvkey.sh "${keys[@]}" sleep:1 KEY_ENTER sleep:3 KEY_ENTER
  sleep 6
  $H/tvshot.sh pair-$name >/dev/null
  $H/record-lesson.sh $name $delay $max 2>&1 | tail -3
  if grep -q "lesson ended" $S/learner-$name.log; then sleep 3; $H/tvshot.sh summary-$name >/dev/null; echo "ok $name"; else echo "!! $name did not finish"; kill $(cat $S/learner-$name.pid) 2>/dev/null; fi
done
echo "=== done $(date +%H:%M:%S)"
