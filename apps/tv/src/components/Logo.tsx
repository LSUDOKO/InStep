import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** Footprint whose toe forms a play triangle (docs/09 §1). */
export function Logo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width={64} height={64} rx={16} fill="#171B22" />
      <Path d="M22 14c-5 0-8 6-8 14 0 9 3 16 7 20 2 2 6 1 6-3V18c0-2-2-4-5-4z" fill="#4FD1C5" />
      <Path d="M34 22v24l16-12z" fill="#F2F4F7" />
    </Svg>
  );
}
