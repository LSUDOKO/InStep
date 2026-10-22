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

/**
 * tvOS settings row: label on the left, current value on the right. Select steps to the next value, so every
 * setting is one remote button away (no nested pickers to get lost in).
 */
function Row<V extends string | number | boolean>({
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
  const i = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  );
  return (
    <Focusable
      onSelect={() => onPick(options[(i + 1) % options.length]!.id)}
      style={{
        height: px(84),
        paddingHorizontal: px(32),
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
      }}
      scale={1.03}
    >
      {() => (
        <>
          <T weight="600" style={{ flex: 1 }}>
            {label}
          </T>
          <T color={c.muted}>{options[i]?.label}</T>
          <T color={c.faint} style={{ marginLeft: px(16) }}>
            ›
          </T>
        </>
      )}
    </Focusable>
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
      <View style={{ flexDirection: 'row', gap: px(80), marginTop: px(40), flex: 1 }}>
        <View style={{ width: px(1060) }}>
          <T size="h1" style={{ marginBottom: px(28) }}>
            Settings
          </T>
          <SpatialNavigationScrollView offsetFromStart={px(120)}>
            <SpatialNavigationNode orientation="vertical">
              <View style={{ gap: px(12), paddingBottom: px(60) }}>
                <DefaultFocus>
                  <Focusable
                    onSelect={() => setEditing(true)}
                    style={{
                      height: px(84),
                      paddingHorizontal: px(32),
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: c.surface,
                    }}
                    scale={1.03}
                  >
                    {() => (
                      <>
                        <T weight="600" style={{ flex: 1 }}>
                          Server address
                        </T>
                        <T color={c.muted} lines={1} style={{ maxWidth: px(560) }}>
                          {s.serverUrl.replace(/^https?:\/\//, '')}
                        </T>
                        <T color={c.faint} style={{ marginLeft: px(16) }}>
                          ›
                        </T>
                      </>
                    )}
                  </Focusable>
                </DefaultFocus>
                <Row
                  label="Coach language"
                  value={s.language}
                  options={LANGUAGES}
                  onPick={(language) => save({ language })}
                />
                <Row
                  label="Caption size"
                  value={s.captionScale}
                  options={[
                    { id: 1, label: 'Medium' },
                    { id: 1.25, label: 'Large' },
                    { id: 1.5, label: 'Extra large' },
                  ]}
                  onPick={(captionScale) => save({ captionScale: captionScale as S['captionScale'] })}
                />
                <Row
                  label="Spoken tips"
                  value={s.voice}
                  options={onOff}
                  onPick={(voice) => save({ voice })}
                />
                <Row
                  label="Body panel"
                  value={s.overlayMode}
                  options={[
                    { id: 'side_by_side', label: 'Next to the video' },
                    { id: 'overlay', label: 'Over the video' },
                  ]}
                  onPick={(overlayMode) => save({ overlayMode })}
                />
                <Row
                  label="High contrast"
                  value={s.highContrast}
                  options={onOff}
                  onPick={(highContrast) => save({ highContrast })}
                />
                <Row
                  label="Reduce motion"
                  value={s.reduceMotion}
                  options={onOff}
                  onPick={(reduceMotion) => save({ reduceMotion })}
                />
              </View>
            </SpatialNavigationNode>
          </SpatialNavigationScrollView>
        </View>

        {/* about column (tvOS settings show context beside the list) */}
        <View style={{ flex: 1, gap: px(18), paddingTop: px(96) }}>
          <T size="headline">About InStep</T>
          <T color={c.muted}>The video that waits for you. Open source under the MIT licence.</T>
          <T color={c.muted}>
            The camera is your phone or laptop. Only body points, as numbers, are shared. Never video.
          </T>
          <T color={c.muted}>
            Coach tips come from {mockAi ? 'built-in templates (AI is off)' : 'Amazon Bedrock'}. They are
            practice tips, not medical advice.
          </T>
          <T size="caption" color={c.faint}>
            Built with React Native for Vega, react-tv-space-navigation, MediaPipe on the camera device, zod
            and qrcode.
          </T>
        </View>
      </View>
    </Screen>
  );
}
