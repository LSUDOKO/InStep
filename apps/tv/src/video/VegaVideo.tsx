import { KeplerVideoSurfaceView, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import type { MediaAdapter } from '@instep/gated-player';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * W3C media player on a Kepler video surface (pattern from AmazonAppDev/react-native-multi-tv-app-sample),
 * exposed to the gated-player controller as a MediaAdapter.
 */
export function VegaVideo({
  uri,
  style,
  onReady,
  onEnded,
  onError,
}: {
  uri: string;
  style?: ViewStyle;
  onReady: (media: MediaAdapter) => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
}) {
  const player = useRef<VideoPlayer | null>(null);
  const surface = useRef<string | null>(null);
  const initialised = useRef(false);

  useEffect(() => {
    const v = new VideoPlayer();
    player.current = v;
    let cancelled = false;
    v.initialize()
      .then(() => {
        if (cancelled) return;
        initialised.current = true;
        v.autoplay = false;
        v.addEventListener('ended', () => onEnded?.());
        v.addEventListener('error', () => onError?.('The video could not be played.'));
        if (surface.current) v.setSurfaceHandle(surface.current);
        v.src = uri;
        v.load();
        onReady(adapter(v));
      })
      .catch((e: Error) => onError?.(`Video player failed to start: ${e.message}`));
    return () => {
      cancelled = true;
      void v.deinitialize().catch(() => undefined);
      player.current = null;
    };
  }, [uri]);

  return (
    <View style={[styles.box, style]}>
      <KeplerVideoSurfaceView
        style={StyleSheet.absoluteFill}
        onSurfaceViewCreated={(h: string) => {
          surface.current = h;
          if (initialised.current) player.current?.setSurfaceHandle(h);
        }}
        onSurfaceViewDestroyed={(h: string) => {
          player.current?.clearSurfaceHandle(h);
          surface.current = null;
        }}
      />
    </View>
  );
}

function adapter(v: VideoPlayer): MediaAdapter {
  return {
    play: () => void v.play(),
    pause: () => v.pause(),
    seek: (s) => {
      v.currentTime = s;
    },
    currentTime: () => v.currentTime,
    setRate: (r) => {
      try {
        v.playbackRate = r;
        return Math.abs(v.playbackRate - r) < 0.01;
      } catch {
        return false;
      }
    },
    setMuted: (m) => {
      v.muted = m;
    },
  };
}

/** Plays a short audio clip (coach voice / chime) with a second player; false if unavailable. */
export function playAudioUrl(url: string): boolean {
  try {
    const a = new VideoPlayer();
    void a
      .initialize()
      .then(() => {
        a.src = url;
        a.load();
        return a.play();
      })
      .then(() => a.addEventListener('ended', () => void a.deinitialize()))
      .catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({ box: { backgroundColor: '#000', overflow: 'hidden' } });
