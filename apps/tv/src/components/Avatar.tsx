import React from 'react';
import { View } from 'react-native';
import { px } from '../theme/tokens';
import { T } from './ui';

export const AVATARS: Record<string, string> = {
  sun: '#FFB547',
  leaf: '#3DDC97',
  wave: '#7AA7FF',
  rose: '#FF6B6B',
  plum: '#C08BFF',
  teal: '#4FD1C5',
};

export function Avatar({ name, avatar, size }: { name: string; avatar: string; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: AVATARS[avatar] ?? '#4FD1C5',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <T size="display" color="#0E1116" style={{ fontSize: size * 0.45, lineHeight: size * 0.55 }}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </T>
    </View>
  );
}
export const avatarSize = px(200);
