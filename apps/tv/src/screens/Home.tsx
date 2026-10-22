import type { LessonSummary } from '@instep/protocol';
import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode, SpatialNavigationScrollView } from 'react-tv-space-navigation';
import { TabBar } from '../components/TabBar';
import { Backdrop, Button, Focusable, Screen, StateScreen, T, useMotion, useTheme } from '../components/ui';
import { nav, refreshCatalog, services } from '../lib/app';
import { channelColor, LOCKUP, px, RADIUS, SAFE } from '../theme/tokens';
import { useApp } from '../useStore';

/** What each channel is for, in one line (Top Shelf copy). */
const CHANNEL_LINE: Record<string, string> = {
  fall_prevention: 'Strength and balance at home. A safety check comes before every exercise.',
  sign_language: 'Your first signs, practised together. See exactly which finger to fix.',
  stroke_rehab: 'Hand exercises that only count a rep when it reaches the full range.',
  cpr: 'Rhythm and straight arms for hands-only CPR. A practice aid, not certification.',
  kids: 'Story time you move along with. Every pose you hold moves the story on.',
};
/** Channels that lead the Top Shelf, in order. */
const FEATURED = ['fall_prevention', 'sign_language'];

const duration = (s: number) => (s < 60 ? `${Math.round(s)} sec` : `${Math.round(s / 60)} min`);
const steps = (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`;
const LEVEL = ['', 'Gentle', 'Steady', 'Challenging'];

function Lockup({ l }: { l: LessonSummary }) {
  const c = useTheme();
  const accent = channelColor[l.channel] ?? c.brand;
  return (
    <View style={{ width: px(LOCKUP.w) }}>
      <Focusable
        variant="lift"
        onSelect={() => nav.push({ name: 'detail', lessonId: l.id })}
        style={{ borderRadius: px(LOCKUP.radius + 3) }}
      >
        {() => (
          <View
            style={{
              width: px(LOCKUP.w) - px(6),
              height: px(LOCKUP.h),
              borderRadius: px(LOCKUP.radius),
              overflow: 'hidden',
              backgroundColor: c.solid,
            }}
          >
            {l.posterUrl ? (
              <Image
                source={{ uri: services.api.url(l.posterUrl) }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: accent, opacity: 0.35 }} />
            )}
            {l.isNew && (
              <View
                style={{
                  position: 'absolute',
                  top: px(14),
                  left: px(14),
                  backgroundColor: c.focus,
                  borderRadius: px(8),
                  paddingHorizontal: px(12),
                  height: px(36),
                  justifyContent: 'center',
                }}
              >
                <T size="caption" color={c.onFocus} weight="700" style={{ lineHeight: px(30) }}>
                  New
                </T>
              </View>
            )}
          </View>
        )}
      </Focusable>
      <View style={{ paddingTop: px(16), paddingHorizontal: px(4), gap: px(2) }}>
        <T weight="600" lines={1}>
          {l.title}
        </T>
        <T size="caption" color={c.muted} lines={1}>
          {duration(l.durationSec)}, {steps(l.gateCount)}, {LEVEL[l.difficulty]?.toLowerCase()}
        </T>
      </View>
    </View>
  );
}

/** Top Shelf: the featured lesson over its own artwork, with the screen's one primary action. */
function TopShelf({ l, channelTitle }: { l: LessonSummary; channelTitle: string }) {
  const c = useTheme();
  return (
    <View style={{ height: px(700) }}>
      <Backdrop source={l.posterUrl ? { uri: services.api.url(l.posterUrl) } : null} dim={0.25} />
      <View style={{ paddingHorizontal: px(SAFE.h), paddingTop: px(SAFE.v) }}>
        <TabBar current="home" />
      </View>
      <View style={{ position: 'absolute', left: px(SAFE.h), bottom: px(64), width: px(900), gap: px(18) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: px(14) }}>
          <View
            style={{
              width: px(12),
              height: px(12),
              borderRadius: px(6),
              backgroundColor: channelColor[l.channel],
            }}
          />
          <T size="caption" weight="600" color={c.muted}>
            {channelTitle}
          </T>
        </View>
        <T size="display" lines={2}>
          {l.title}
        </T>
        <T color={c.muted} lines={2} style={{ width: px(820) }}>
          {CHANNEL_LINE[l.channel] ?? ''}
        </T>
        <T size="caption" color={c.faint}>
          {duration(l.durationSec)}, {steps(l.gateCount)}, {LEVEL[l.difficulty]}
        </T>
        <SpatialNavigationNode orientation="horizontal">
          <View style={{ flexDirection: 'row', gap: px(24), marginTop: px(14) }}>
            <DefaultFocus>
              <Button
                primary
                icon="▶"
                label="Start lesson"
                width={300}
                onSelect={() => nav.push({ name: 'pair', lessonId: l.id, together: false })}
              />
            </DefaultFocus>
            <Button
              label="Details"
              width={220}
              onSelect={() => nav.push({ name: 'detail', lessonId: l.id })}
            />
          </View>
        </SpatialNavigationNode>
      </View>
    </View>
  );
}

export function Home() {
  const c = useTheme();
  const motion = useMotion();
  const catalog = useApp((s) => s.catalog);
  const error = useApp((s) => s.catalogError);
  const [hero, setHero] = useState(0);
  const rows = catalog?.channels.filter((ch) => ch.lessons.length > 0) ?? [];
  const featured = FEATURED.map((f) => rows.find((r) => r.channel === f)).filter(
    (r): r is NonNullable<typeof r> => !!r,
  );

  // the Top Shelf rotates between featured channels, slowly, unless motion is reduced
  useEffect(() => {
    if (!motion || featured.length < 2) return;
    const id = setInterval(() => setHero((h) => (h + 1) % featured.length), 12000);
    return () => clearInterval(id);
  }, [motion, featured.length]);

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

  if (rows.length === 0)
    return (
      <Screen>
        <TabBar current="home" />
        <View style={{ flex: 1, justifyContent: 'center', gap: px(20), width: px(1100) }}>
          <T size="h1">No lessons yet</T>
          <T color={c.muted}>
            Lessons appear here when their demonstration video has been recorded and published in Creator
            Studio.
          </T>
        </View>
      </Screen>
    );

  const shelf = featured[hero % Math.max(1, featured.length)] ?? rows[0]!;

  return (
    <Screen bleed>
      <SpatialNavigationScrollView offsetFromStart={px(120)}>
        <TopShelf l={shelf.lessons[0]!} channelTitle={shelf.title} />
        <View style={{ paddingHorizontal: px(SAFE.h), paddingBottom: px(SAFE.v), gap: px(56) }}>
          {rows.map((row) => (
            <View key={row.channel}>
              <T size="headline" style={{ marginBottom: px(22) }}>
                {row.title}
              </T>
              <SpatialNavigationNode orientation="horizontal">
                <View style={{ flexDirection: 'row', gap: px(LOCKUP.gap) }}>
                  {row.lessons.map((l) => (
                    <Lockup key={l.id} l={l} />
                  ))}
                </View>
              </SpatialNavigationNode>
            </View>
          ))}
          <View style={{ height: px(RADIUS.panel) }} />
        </View>
      </SpatialNavigationScrollView>
    </Screen>
  );
}
