import React, { useMemo } from 'react';
import { View } from 'react-native';
import { qrMatrix } from '../lib/qr';

/** QR code drawn with Views (one row of runs per line) — works without canvas. */
export function QrCode({ value, size }: { value: string; size: number }) {
  const m = useMemo(() => qrMatrix(value), [value]);
  const quiet = 2;
  const n = m.length + quiet * 2;
  const cell = size / n;
  return (
    <View
      accessibilityLabel={`QR code for ${value}`}
      style={{ width: size, height: size, backgroundColor: '#FFFFFF', padding: cell * quiet }}
    >
      {m.map((row, y) => {
        // merge consecutive dark modules into one View to keep the view count low
        const runs: { x: number; w: number }[] = [];
        row.forEach((on, x) => {
          if (!on) return;
          const last = runs.at(-1);
          if (last && last.x + last.w === x) last.w++;
          else runs.push({ x, w: 1 });
        });
        return (
          <View key={y} style={{ height: cell, flexDirection: 'row' }}>
            {runs.map((r) => (
              <View
                key={r.x}
                style={{
                  position: 'absolute',
                  left: r.x * cell,
                  width: r.w * cell + 0.5,
                  height: cell + 0.5,
                  backgroundColor: '#000000',
                }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}
