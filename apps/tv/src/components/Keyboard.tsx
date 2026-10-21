import React from 'react';
import { View } from 'react-native';
import { SpatialNavigationNode } from 'react-tv-space-navigation';
import { px } from '../theme/tokens';
import { Focusable, T, useTheme } from './ui';

const ROWS = {
  text: ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ-. '],
  url: ['1234567890', 'abcdefghij', 'klmnopqrst', 'uvwxyz:/.-_'],
};

/** D-pad on-screen keyboard (names, server URL). */
export function Keyboard({
  value,
  onChange,
  layout = 'text',
  max = 40,
}: {
  value: string;
  onChange: (v: string) => void;
  layout?: keyof typeof ROWS;
  max?: number;
}) {
  const c = useTheme();
  const key = (label: string, onSelect: () => void, wide = false) => (
    <Focusable
      key={label}
      onSelect={onSelect}
      style={{
        width: px(wide ? 200 : 88),
        height: px(80),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface,
      }}
    >
      {() => <T weight="700">{label === ' ' ? '␣' : label}</T>}
    </Focusable>
  );
  return (
    <SpatialNavigationNode orientation="vertical">
      <View style={{ gap: px(10) }}>
        {ROWS[layout].map((row) => (
          <SpatialNavigationNode key={row} orientation="horizontal">
            <View style={{ flexDirection: 'row', gap: px(10) }}>
              {[...row].map((ch) => key(ch, () => value.length < max && onChange(value + ch)))}
            </View>
          </SpatialNavigationNode>
        ))}
        <SpatialNavigationNode orientation="horizontal">
          <View style={{ flexDirection: 'row', gap: px(10) }}>
            {key('⌫ Delete', () => onChange(value.slice(0, -1)), true)}
            {key('Clear', () => onChange(''), true)}
          </View>
        </SpatialNavigationNode>
      </View>
    </SpatialNavigationNode>
  );
}
