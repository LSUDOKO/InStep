import React from 'react';
import { View } from 'react-native';
import { px } from '../theme/tokens';
import { T } from './ui';

export const AVATARS: Record<string, string> = {
  sun: '#F6D653',
  leaf: '#49DE78',
  wave: '#5FC6FF',
  rose: '#F87BAA',
  plum: '#AE97FF',
  teal: '#5BD7D3',
};

export function Avatar({ name, avatar, size }: { name: string; avatar: string; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: AVATARS[avatar] ?? '#5BD7D3',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T size="display" color="#0D0E2C" style={{ fontSize: size * 0.45, lineHeight: size * 0.55 }}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </T>
    </View>
  );
}
export const avatarSize = px(200);
