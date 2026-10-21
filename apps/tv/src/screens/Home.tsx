import type { LessonSummary } from '@instep/protocol';
import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationScrollView } from 'react-tv-space-navigation';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { Button, Chip, Focusable, Screen, StateScreen, T, useMotion, useTheme } from '../components/ui';
import { nav, refreshCatalog, services } from '../lib/app';
import { channelColor, px } from '../theme/tokens';
import { useApp } from '../useStore';

const HERO: Record<string, { title: string; line: string }> = {
  fall_prevention: {
    title: 'Fall Prevention',
    line: 'Strength and balance at home — safety checked before every exercise.',
  },
  sign_language: {
    title: 'Sign Language for Families',
    line: 'Practise your first signs together. See exactly which finger to fix.',
  },
};

const minutes = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);

function LessonCard({ l }: { l: LessonSummary }) {
  const c = useTheme();
  const accent = channelColor[l.channel] ?? c.brand;
  return (
    <Focusable onSelect={() => nav.push({ name: 'detail', lessonId: l.id })} style={{ width: px(384) }}>
      {() => (
        <View>
          <View
            style={{
              width: '100%',
              height: px(216),
              borderRadius: px(14),
              overflow: 'hidden',
              backgroundColor: c.surface2,
            }}
          >
            {l.posterUrl ? (
              <Image
                source={{ uri: services.api.url(l.posterUrl) }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: accent, opacity: 0.25 }} />
            )}
            {l.isNew && (
              <View
                style={{
                  position: 'absolute',
                  top: px(12),
                  left: px(12),
                  backgroundColor: c.brand,
                  borderRadius: px(8),
                  paddingHorizontal: px(12),
                  paddingVertical: px(4),
                }}
              >
                <T size="caption" color="#04201D" weight="700">
                  New
                </T>
              </View>
            )}
          </View>
          <View style={{ padding: px(14), gap: px(4) }}>
            <T weight="700" lines={2}>
              {l.title}
            </T>
            <T size="caption" color={c.muted}>
              {minutes(l.durationSec)} · {l.gateCount} {l.gateCount === 1 ? 'step' : 'steps'} ·{' '}
              {'●'.repeat(l.difficulty)}
              {'○'.repeat(3 - l.difficulty)}
            </T>
          </View>
        </View>
      )}
    </Focusable>
  );
}

export function Home() {
  const c = useTheme();
  const motion = useMotion();
  const catalog = useApp((s) => s.catalog);
  const error = useApp((s) => s.catalogError);
  const profile = useApp((s) => s.profile);
  const relay = useApp((s) => s.relayStatus);
  const [hero, setHero] = useState(0);
  const rows = catalog?.channels.filter((ch) => ch.lessons.length > 0) ?? [];
  const heroes = rows.filter((r) => HERO[r.channel]);

  useEffect(() => {
    if (!motion || heroes.length < 2) return;
    const id = setInterval(() => setHero((h) => (h + 1) % heroes.length), 8000);
    return () => clearInterval(id);
  }, [motion, heroes.length]);

  if (!catalog && error)
    return (
      <StateScreen
        icon="!"
        title="Couldn't load lessons"
        body={error}
        actions={<Button primary label="Try again" onSelect={() => void refreshCatalog()} />}
      />
    );
  if (!catalog) return <StateScreen icon="…" title="Loading lessons" />;

  const h = heroes[hero % Math.max(1, heroes.length)];

  return (
    <Screen>
      <SpatialNavigationNode orientation="horizontal">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: px(24), marginBottom: px(28) }}>
          <Logo size={px(64)} />
          <T size="h2" style={{ flex: 1 }}>
            InStep
          </T>
          {relay !== 'online' && (
            <Chip tone="near" label={relay === 'connecting' ? 'Connecting…' : 'Server offline — retrying'} />
          )}
          <Button label="My progress" onSelect={() => nav.push({ name: 'progress' })} />
          <Button label="Settings" icon="⚙" onSelect={() => nav.push({ name: 'settings' })} />
          {profile && (
            <Focusable
              onSelect={() => nav.reset({ name: 'profiles' })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: px(14),
                paddingHorizontal: px(16),
                height: px(84),
              }}
            >
              {() => (
                <>
                  <Avatar name={profile.name} avatar={profile.avatar} size={px(56)} />
                  <T>{profile.name}</T>
                </>
              )}
            </Focusable>
          )}
        </View>
      </SpatialNavigationNode>

      {rows.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', gap: px(20), maxWidth: px(1200) }}>
          <T size="h1">No lessons yet</T>
          <T color={c.muted}>
            Lessons appear here as soon as their demonstration video has been recorded and published.
          </T>
        </View>
      ) : (
        <SpatialNavigationScrollView offsetFromStart={px(140)}>
          {h && (
            <View
              style={{
                height: px(260),
                borderRadius: px(28),
                backgroundColor: c.surface,
                padding: px(48),
                justifyContent: 'center',
                marginBottom: px(40),
                borderLeftWidth: px(12),
                borderLeftColor: channelColor[h.channel],
              }}
            >
              <T size="h1">{HERO[h.channel]!.title}</T>
              <T color={c.muted} style={{ marginTop: px(12) }}>
                {HERO[h.channel]!.line}
              </T>
            </View>
          )}
          {rows.map((row, ri) => (
            <View key={row.channel} style={{ marginBottom: px(36) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: px(14), marginBottom: px(16) }}>
                <View
                  style={{
                    width: px(14),
                    height: px(40),
                    borderRadius: px(7),
                    backgroundColor: channelColor[row.channel],
                  }}
                />
                <T size="h2">{row.title}</T>
              </View>
              <SpatialNavigationNode orientation="horizontal">
                <View style={{ flexDirection: 'row', gap: px(28) }}>
                  {row.lessons.map((l, i) =>
                    ri === 0 && i === 0 ? (
                      <DefaultFocus key={l.id}>
                        <LessonCard l={l} />
                      </DefaultFocus>
                    ) : (
                      <LessonCard key={l.id} l={l} />
                    ),
                  )}
                </View>
              </SpatialNavigationNode>
            </View>
          ))}
        </SpatialNavigationScrollView>
      )}
    </Screen>
  );
}
