import React from 'react';
import { View } from 'react-native';
import { SpatialNavigationNode } from 'react-tv-space-navigation';
import { nav } from '../lib/app';
import { px, RADIUS } from '../theme/tokens';
import { useApp } from '../useStore';
import { Avatar } from './Avatar';
import { Chip, Focusable, T, useTheme } from './ui';

type Tab = 'home' | 'progress' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'progress', label: 'My progress' },
  { id: 'settings', label: 'Settings' },
];

/**
 * tvOS tab bar: a glass pill centred at the top of the safe area. The current tab sits on a dimmer platter;
 * focus lifts a tab to white. Only real destinations appear here (no placeholder tabs).
 */
export function TabBar({ current }: { current: Tab }) {
  const c = useTheme();
  const profile = useApp((s) => s.profile);
  const relay = useApp((s) => s.relayStatus);
  const go = (t: Tab) => {
    if (t === current) return;
    if (t === 'home') nav.reset({ name: 'home' });
    else if (current === 'home') nav.push({ name: t });
    else nav.replace({ name: t });
  };
  return (
    <SpatialNavigationNode orientation="horizontal">
      <View style={{ flexDirection: 'row', alignItems: 'center', height: px(84) }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {relay !== 'online' && (
            <Chip tone="near" label={relay === 'connecting' ? 'Connecting…' : 'Server offline, retrying'} />
          )}
        </View>
        <View
          style={{
            flexDirection: 'row',
            padding: px(6),
            gap: px(4),
            borderRadius: px(RADIUS.pill),
            backgroundColor: 'rgba(30,30,30,0.6)',
            borderWidth: px(1),
            borderColor: c.hairline,
          }}
        >
          {TABS.map((t) => (
            <Focusable
              key={t.id}
              onSelect={() => go(t.id)}
              style={{
                height: px(60),
                paddingHorizontal: px(36),
                borderRadius: px(RADIUS.pill),
                justifyContent: 'center',
                backgroundColor: t.id === current ? 'rgba(208,209,211,0.28)' : 'transparent',
              }}
              scale={1.08}
            >
              {() => (
                <T weight="700" color={t.id === current ? c.text : c.muted}>
                  {t.label}
                </T>
              )}
            </Focusable>
          ))}
        </View>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
          {profile && (
            <Focusable
              onSelect={() => nav.reset({ name: 'profiles' })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: px(14),
                height: px(64),
                paddingLeft: px(8),
                paddingRight: px(24),
                borderRadius: px(RADIUS.pill),
              }}
            >
              {() => (
                <>
                  <Avatar name={profile.name} avatar={profile.avatar} size={px(48)} />
                  <T weight="600">{profile.name}</T>
                </>
              )}
            </Focusable>
          )}
        </View>
      </View>
    </SpatialNavigationNode>
  );
}
