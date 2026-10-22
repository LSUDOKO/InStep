import React, { useState } from 'react';
import { View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode } from 'react-tv-space-navigation';
import { Avatar, AVATARS } from '../components/Avatar';
import { Keyboard } from '../components/Keyboard';
import { Button, Card, Focusable, Screen, T, useTheme } from '../components/ui';
import { nav, refreshCatalog, services, store } from '../lib/app';
import { px } from '../theme/tokens';

const HANDS = [
  { id: 'none', label: 'Not needed' },
  { id: 'left', label: 'Left hand' },
  { id: 'right', label: 'Right hand' },
] as const;

export function AddProfile() {
  const c = useTheme();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('sun');
  const [hand, setHand] = useState<'none' | 'left' | 'right'>('none');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = name.trim();
    if (!n) return setError('Type a name first.');
    setSaving(true);
    try {
      const p = await services.api.createProfile({
        name: n[0]!.toUpperCase() + n.slice(1).toLowerCase(),
        avatar,
        affectedHand: hand,
      });
      store.set({ profile: p });
      void refreshCatalog();
      nav.reset({ name: 'home' });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Screen>
      <T size="h1">New profile</T>
      {/* horizontal node so Left/Right crosses between the keyboard and the right-hand column */}
      <SpatialNavigationNode orientation="horizontal">
        <View style={{ flexDirection: 'row', gap: px(64), marginTop: px(40) }}>
          <View style={{ gap: px(24) }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: px(24), minWidth: px(900) }}>
              <Avatar name={name || '?'} avatar={avatar} size={px(96)} />
              <T size="h1">{name || ' '}</T>
              <View style={{ width: px(4), height: px(56), backgroundColor: c.brand }} />
            </Card>
            <DefaultFocus>
              <Keyboard value={name} onChange={setName} max={20} />
            </DefaultFocus>
          </View>
          <SpatialNavigationNode orientation="vertical">
            <View style={{ gap: px(28) }}>
              <T size="h2">Colour</T>
              <SpatialNavigationNode orientation="horizontal">
                <View style={{ flexDirection: 'row', gap: px(14) }}>
                  {Object.keys(AVATARS).map((a) => (
                    <Focusable
                      key={a}
                      onSelect={() => setAvatar(a)}
                      variant="lift"
                      scale={1.12}
                      style={{
                        padding: px(5),
                        borderRadius: px(48),
                        borderColor: a === avatar ? c.text : 'transparent',
                      }}
                    >
                      {() => <Avatar name={name || '?'} avatar={a} size={px(72)} />}
                    </Focusable>
                  ))}
                </View>
              </SpatialNavigationNode>
              <T size="h2">Hand for rehab exercises</T>
              <SpatialNavigationNode orientation="horizontal">
                <View style={{ flexDirection: 'row', gap: px(14) }}>
                  {HANDS.map((h) => (
                    <Focusable
                      key={h.id}
                      onSelect={() => setHand(h.id)}
                      style={{
                        paddingHorizontal: px(24),
                        height: px(72),
                        justifyContent: 'center',
                        backgroundColor: h.id === hand ? c.brand : c.surface2,
                      }}
                    >
                      {() => <T color={h.id === hand ? '#04201D' : c.text}>{h.label}</T>}
                    </Focusable>
                  ))}
                </View>
              </SpatialNavigationNode>
              {error && <T color={c.far}>{error}</T>}
              <SpatialNavigationNode orientation="horizontal">
                <View style={{ flexDirection: 'row', gap: px(20) }}>
                  <Button
                    primary
                    label={saving ? 'Saving…' : 'Save profile'}
                    disabled={saving}
                    onSelect={() => void save()}
                  />
                  <Button label="Cancel" onSelect={nav.back} />
                </View>
              </SpatialNavigationNode>
            </View>
          </SpatialNavigationNode>
        </View>
      </SpatialNavigationNode>
    </Screen>
  );
}
