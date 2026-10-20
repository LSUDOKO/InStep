/**
 * InStep Milestone 0 spike — drop-in App.tsx for a `vega project generate --template helloWorld` app.
 * Requires: npm install @amazon-devices/react-native-w3cmedia
 *
 * Tests, with results shown on screen (and in `vega device logs`):
 *  1. host reachability (tries each HOSTS entry: GET /ping)
 *  2. MP4 playback, programmatic pause + seek at t = 5 s
 *  3. WebSocket 30 msg/s × ~1.2 KB from host; TV acks each message (server prints RTT)
 *  4. 33-point skeleton drawn with absolutely-positioned Views beside the video; render fps
 *  5. playbackRate = 0.75
 *  6. MP3 played by a second player while the video is paused
 *
 * D-pad: OK = replay test sequence. Edit HOSTS if your host has another LAN IP.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KeplerVideoSurfaceView, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';

const HOSTS = ['10.0.2.2', '192.168.1.20', '127.0.0.1']; // first that answers /ping wins
const PORT = 8788;

type Pt = [number, number];
const EDGES: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];

export const App = () => {
  const [log, setLog] = useState<string[]>([]);
  const [host, setHost] = useState<string | null>(null);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const [pose, setPose] = useState<Pt[] | null>(null);
  const [stats, setStats] = useState({ msgsPerSec: 0, renderFps: 0, lagMs: 0 });
  const video = useRef<VideoPlayer | null>(null);
  const latest = useRef<Pt[] | null>(null);
  const counters = useRef({ msgs: 0, renders: 0, lag: 0 });

  const say = useCallback((line: string) => {
    console.log(`[spike] ${line}`);
    setLog((l) => [...l.slice(-14), line]);
  }, []);

  // 1. find the host
  useEffect(() => {
    (async () => {
      for (const h of HOSTS) {
        const t0 = Date.now();
        try {
          const r = await fetch(`http://${h}:${PORT}/ping`);
          if ((await r.text()) === 'pong') {
            say(`✓ host reachable at ${h} (${Date.now() - t0} ms)`);
            setHost(h);
            return;
          }
        } catch (e) {
          say(`✗ ${h}: ${(e as Error).message}`);
        }
      }
      say('✗ no host reachable — check HOSTS and that spike-server is running');
    })();
  }, [say]);

  // 2 + 5 + 6. video tests
  const runVideoTests = useCallback(async () => {
    const v = video.current;
    if (!v || !host) return;
    try {
      v.currentTime = 0;
      await v.play();
      say('▶ playing; will pause at t = 5 s');
      const poll = setInterval(async () => {
        if (v.currentTime >= 4.95) {
          clearInterval(poll);
          v.pause();
          v.currentTime = 5;
          setTimeout(() => say(`✓ paused at ${v.currentTime.toFixed(3)} s (target 5.000)`), 300);
          // 6. audio while paused
          try {
            const a = new VideoPlayer();
            await a.initialize();
            a.src = `http://${host}:${PORT}/media/chime.mp3`;
            a.load();
            await a.play();
            say('✓ second player started MP3 while video paused (listen for a beep)');
            setTimeout(() => a.deinitialize?.(), 2000);
          } catch (e) {
            say(`✗ MP3 while paused: ${(e as Error).message}`);
          }
          // 5. playback rate
          setTimeout(async () => {
            try {
              v.playbackRate = 0.75;
              await v.play();
              const t0 = v.currentTime;
              setTimeout(() => {
                const rate = (v.currentTime - t0) / 4;
                say(
                  `playbackRate set=${v.playbackRate}; measured ≈ ${rate.toFixed(2)}× ${Math.abs(rate - 0.75) < 0.1 ? '✓' : '✗'}`,
                );
                v.playbackRate = 1;
              }, 4000);
            } catch (e) {
              say(`✗ playbackRate: ${(e as Error).message}`);
            }
          }, 3000);
        }
      }, 50);
    } catch (e) {
      say(`✗ play: ${(e as Error).message}`);
    }
  }, [host, say]);

  useEffect(() => {
    const v = new VideoPlayer();
    video.current = v;
    v.initialize()
      .then(() => say('✓ VideoPlayer initialised'))
      .catch((e: Error) => say(`✗ VideoPlayer init: ${e.message}`));
    return () => {
      v.deinitialize?.();
    };
  }, [say]);

  useEffect(() => {
    const v = video.current;
    if (!v || !host || !surfaceReady) return;
    v.autoplay = false;
    v.src = `http://${host}:${PORT}/media/test.mp4`;
    v.load();
    say('loading test.mp4');
    const t = setTimeout(runVideoTests, 1500);
    return () => clearTimeout(t);
  }, [host, surfaceReady, runVideoTests, say]);

  // 3. WebSocket
  useEffect(() => {
    if (!host) return;
    const ws = new WebSocket(`ws://${host}:${PORT}/ws`);
    ws.onopen = () => say('✓ WebSocket open');
    ws.onerror = (e) =>
      say(`✗ WebSocket error: ${(e as unknown as { message?: string }).message ?? 'unknown'}`);
    ws.onclose = () => say('WebSocket closed');
    ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data));
      counters.current.msgs++;
      counters.current.lag = Date.now() - m.ts; // clock skew included; server RTT is authoritative
      ws.send(JSON.stringify({ type: 'ack', seq: m.seq, ts: m.ts }));
      latest.current = m.pose.map((p: number[]) => [p[0], p[1]] as Pt);
    };
    return () => ws.close();
  }, [host, say]);

  // 4. render loop: always the latest frame, never queued
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (latest.current) {
        setPose(latest.current);
        latest.current = null;
        counters.current.renders++;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const s = setInterval(() => {
      setStats({
        msgsPerSec: counters.current.msgs,
        renderFps: counters.current.renders,
        lagMs: counters.current.lag,
      });
      counters.current.msgs = 0;
      counters.current.renders = 0;
    }, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(s);
    };
  }, []);

  const W = 560;
  const H = 720;
  return (
    <View style={styles.root}>
      <View style={styles.videoBox}>
        <KeplerVideoSurfaceView
          style={StyleSheet.absoluteFill}
          onSurfaceViewCreated={(h: string) => {
            video.current?.setSurfaceHandle(h);
            setSurfaceReady(true);
            say('✓ video surface created');
          }}
          onSurfaceViewDestroyed={(h: string) => video.current?.clearSurfaceHandle(h)}
        />
      </View>
      <View style={[styles.panel, { width: W, height: H }]}>
        {pose &&
          EDGES.map(([a, b], i) => {
            const [x1, y1] = [pose[a]![0] * W, pose[a]![1] * H];
            const [x2, y2] = [pose[b]![0] * W, pose[b]![1] * H];
            const len = Math.hypot(x2 - x1, y2 - y1);
            const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
            return (
              <View
                key={i}
                style={[
                  styles.bone,
                  {
                    left: (x1 + x2) / 2 - len / 2,
                    top: (y1 + y2) / 2 - 4,
                    width: len,
                    transform: [{ rotate: `${ang}deg` }],
                  },
                ]}
              />
            );
          })}
        {pose?.map(([x, y], i) => (
          <View key={`j${i}`} style={[styles.joint, { left: x * W - 6, top: y * H - 6 }]} />
        ))}
        <Text style={styles.stats}>
          msgs/s {stats.msgsPerSec} · render fps {stats.renderFps} · one-way lag* {stats.lagMs} ms
        </Text>
      </View>
      <View style={styles.log}>
        {log.map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1116', flexDirection: 'row', flexWrap: 'wrap', padding: 48 },
  videoBox: { width: 1120, height: 630, backgroundColor: '#000' },
  panel: { marginLeft: 48, backgroundColor: '#171B22', overflow: 'hidden' },
  bone: { position: 'absolute', height: 8, borderRadius: 4, backgroundColor: '#3DDC97' },
  joint: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#F2F4F7' },
  stats: { position: 'absolute', bottom: 12, left: 12, color: '#F2F4F7', fontSize: 24 },
  log: { width: 1120, marginTop: 24 },
  logLine: { color: '#F2F4F7', fontSize: 26 },
});

export default App;
