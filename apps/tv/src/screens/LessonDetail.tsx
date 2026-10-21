import React from 'react';
import { Image, View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode } from 'react-tv-space-navigation';
import { Button, Card, Screen, StateScreen, T, useTheme } from '../components/ui';
import { nav, services } from '../lib/app';
import { useLesson } from '../lib/useLesson';
import { channelColor, px } from '../theme/tokens';

const VIEW_HINT: Record<string, string> = {
  front: 'Phone or laptop in front of you, about 2–3 m away, at hip height.',
  side: 'Phone at your side, about 1.5 m away, so it sees your arms and shoulders.',
  hands: 'Phone in front of you at chest height, about 1 m away. Good light on your hands.',
};

export function LessonDetail({ lessonId }: { lessonId: string }) {
  const c = useTheme();
  const { lesson, error, retry } = useLesson(lessonId);
  if (error)
    return (
      <StateScreen
        icon="!"
        title="Couldn't open this lesson"
        body={error}
        actions={
          <>
            <Button primary label="Try again" onSelect={retry} />
            <Button label="Back" onSelect={nav.back} />
          </>
        }
      />
    );
  if (!lesson) return <StateScreen icon="…" title="Opening lesson" />;
  const { detail: d, track } = lesson;
  const accent = channelColor[d.channel] ?? c.brand;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: px(64), flex: 1 }}>
        <View style={{ width: px(760), gap: px(24) }}>
          <View
            style={{ height: px(428), borderRadius: px(24), overflow: 'hidden', backgroundColor: c.surface2 }}
          >
            {d.posterUrl ? (
              <Image
                source={{ uri: services.api.url(d.posterUrl) }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: accent, opacity: 0.25 }} />
            )}
          </View>
          <Card style={{ gap: px(12) }}>
            <T size="caption" color={c.muted} weight="700">
              CAMERA PLACEMENT
            </T>
            <T>{VIEW_HINT[track.camera.view]}</T>
            <T color={c.muted}>{track.camera.hint}</T>
          </Card>
        </View>
        <View style={{ flex: 1, gap: px(24) }}>
          <T size="h1">{d.title}</T>
          <T color={c.muted}>By {d.creator}</T>
          {d.needs.length > 0 && <T>You'll need: {d.needs.join(' · ')}</T>}
          <View style={{ gap: px(10) }}>
            {track.gates.map((g, i) => (
              <T key={g.id} color={c.muted}>
                {i + 1}. {g.label}
                {g.type === 'safety_prerequisite' ? '  (safety check)' : ''}
              </T>
            ))}
          </View>
          {d.disclaimer && (
            <Card style={{ borderLeftWidth: px(8), borderLeftColor: c.near }}>
              <T>{d.disclaimer}</T>
            </Card>
          )}
          <SpatialNavigationNode orientation="horizontal">
            <View style={{ flexDirection: 'row', gap: px(24), marginTop: px(12) }}>
              <DefaultFocus>
                <Button
                  primary
                  label="Start"
                  icon="▶"
                  onSelect={() => nav.push({ name: 'pair', lessonId, together: false })}
                />
              </DefaultFocus>
              <Button
                label="Practice with family (Together)"
                onSelect={() => nav.push({ name: 'pair', lessonId, together: true })}
              />
              <Button label="Back" onSelect={nav.back} />
            </View>
          </SpatialNavigationNode>
        </View>
      </View>
    </Screen>
  );
}
