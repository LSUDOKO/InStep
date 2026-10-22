import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';
import React, { useState } from 'react';
import { View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationScrollView } from 'react-tv-space-navigation';
import { Keyboard } from '../components/Keyboard';
import { Button, Card, Focusable, Screen, T, useTheme } from '../components/ui';
import { nav, store } from '../lib/app';
import { LANGUAGES, type Settings as S } from '../lib/settings';
import { TabBar } from '../components/TabBar';
import { px } from '../theme/tokens';
import { useApp } from '../useStore';
import { connectAndCheck, SETTINGS_KEY } from './Splash';

function save(patch: Partial<S>) {
  const settings = { ...store.get().settings, ...patch };
  store.set({ settings });
  void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => undefined);
}

function Options<V extends string | number | boolean>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: V;
  options: { id: V; label: string }[];
  onPick: (v: V) => void;
}) {
  const c = useTheme();
  return (
    <View style={{ gap: px(12) }}>
      <T size="h2">{label}</T>
      <SpatialNavigationNode orientation="horizontal">
        <View style={{ flexDirection: 'row', gap: px(14) }}>
          {options.map((o) => (
            <Focusable
              key={String(o.id)}
              onSelect={() => onPick(o.id)}
              style={{
                paddingHorizontal: px(28),
                height: px(72),
                justifyContent: 'center',
                backgroundColor: o.id === value ? c.brand : c.surface2,
              }}
            >
              {() => (
                <T color={o.id === value ? '#04201D' : c.text}>{o.id === value ? `✓ ${o.label}` : o.label}</T>
              )}
            </Focusable>
          ))}
        </View>
      </SpatialNavigationNode>
    </View>
  );
}

const onOff = [
  { id: true, label: 'On' },
  { id: false, label: 'Off' },
];

export function Settings() {
  const c = useTheme();
  const s = useApp((st) => st.settings);
  const mockAi = useApp((st) => st.mockAi);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(s.serverUrl);

  if (editing)
    return (
      <Screen>
        <T size="h1">Server address</T>
        <Card style={{ marginVertical: px(28) }}>
          <T size="h2">{url || ' '}</T>
        </Card>
        <DefaultFocus>
          <Keyboard value={url} onChange={setUrl} layout="url" max={60} />
        </DefaultFocus>
        <SpatialNavigationNode orientation="horizontal">
          <View style={{ flexDirection: 'row', gap: px(20), marginTop: px(28) }}>
            <Button
              primary
              label="Save and reconnect"
              onSelect={() => {
                save({ serverUrl: url.trim() });
                setEditing(false);
                nav.reset({ name: 'splash' });
                void connectAndCheck();
              }}
            />
            <Button label="Cancel" onSelect={() => setEditing(false)} />
          </View>
        </SpatialNavigationNode>
      </Screen>
    );

  return (
    <Screen>
      <TabBar current="settings" />
      <T size="h1" style={{ marginTop: px(40) }}>
        Settings
      </T>
      <SpatialNavigationScrollView offsetFromStart={px(120)}>
        <View style={{ gap: px(36), marginTop: px(28), paddingBottom: px(80) }}>
          <View style={{ gap: px(12) }}>
            <T size="h2">Server</T>
            <T color={c.muted}>{s.serverUrl}</T>
            <DefaultFocus>
              <Button label="Change server address" onSelect={() => setEditing(true)} />
            </DefaultFocus>
          </View>
          <Options
            label="Coach language"
            value={s.language}
            options={LANGUAGES}
            onPick={(language) => save({ language })}
          />
          <Options
            label="Caption size"
            value={s.captionScale}
            options={[
              { id: 1, label: 'M' },
              { id: 1.25, label: 'L' },
              { id: 1.5, label: 'XL' },
            ]}
            onPick={(captionScale) => save({ captionScale: captionScale as S['captionScale'] })}
          />
          <Options label="Spoken tips" value={s.voice} options={onOff} onPick={(voice) => save({ voice })} />
          <Options
            label="Skeleton view"
            value={s.overlayMode}
            options={[
              { id: 'side_by_side', label: 'Next to the video' },
              { id: 'overlay', label: 'Over the video' },
            ]}
            onPick={(overlayMode) => save({ overlayMode })}
          />
          <Options
            label="High contrast"
            value={s.highContrast}
            options={onOff}
            onPick={(highContrast) => save({ highContrast })}
          />
          <Options
            label="Reduce motion"
            value={s.reduceMotion}
            options={onOff}
            onPick={(reduceMotion) => save({ reduceMotion })}
          />
          <Card style={{ gap: px(10) }}>
            <T size="h2">About</T>
            <T color={c.muted}>InStep — the video that waits for you. Open source under the MIT licence.</T>
            <T color={c.muted}>
              Camera: an external phone or laptop. Only body points (numbers) are shared — never video.
            </T>
            <T color={c.muted}>
              Coach tips: {mockAi ? 'built-in templates (AI off)' : 'Amazon Bedrock'}. InStep gives practice
              tips, not medical advice.
            </T>
            <T color={c.muted}>
              Open-source components: React Native, react-tv-space-navigation, MediaPipe (on the camera
              device), zod, qrcode.
            </T>
          </Card>
          <View style={{ flexDirection: 'row' }}>
            <Button label="Back" onSelect={nav.back} />
          </View>
        </View>
      </SpatialNavigationScrollView>
    </Screen>
  );
}
