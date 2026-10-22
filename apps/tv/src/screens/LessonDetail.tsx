import React from 'react';
import { View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode } from 'react-tv-space-navigation';
import { Backdrop, Button, Screen, StateScreen, T, useTheme } from '../components/ui';
import { nav, services } from '../lib/app';
import { useLesson } from '../lib/useLesson';
import { channelColor, px, SAFE } from '../theme/tokens';

const CHANNEL_TITLE: Record<string, string> = {
  fall_prevention: 'Fall Prevention',
  sign_language: 'Sign Language for Families',
  stroke_rehab: 'Stroke Hand Rehab',
  cpr: 'CPR Practice',
  kids: "Kids' Active Storytime",
};
const VIEW_HINT: Record<string, string> = {
  front: 'In front of you, 2–3 m away, at hip height.',
  side: 'At your side, about 1.5 m away, seeing your arms and shoulders.',
  hands: 'In front of you at chest height, about 1 m away, with good light on your hands.',
};
const LEVEL = ['', 'Gentle', 'Steady', 'Challenging'];
const duration = (s: number) => (s < 60 ? `${Math.round(s)} sec` : `${Math.round(s / 60)} min`);

function Topic({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: px(4) }}>
      <T color={c.muted}>{label}</T>
      <T>{value}</T>
    </View>
  );
}

/** tvOS Product page: art backdrop, title top-left, action column, description column, metadata column. */
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

  return (
    <Screen bleed>
      <Backdrop source={d.posterUrl ? { uri: services.api.url(d.posterUrl) } : null} dim={0.3} />

      {/* title area */}
      <View
        style={{ position: 'absolute', left: px(SAFE.h), top: px(SAFE.v + 20), width: px(1100), gap: px(12) }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: px(14) }}>
          <View
            style={{
              width: px(12),
              height: px(12),
              borderRadius: px(6),
              backgroundColor: channelColor[d.channel],
            }}
          />
          <T size="caption" weight="600" color={c.muted}>
            {CHANNEL_TITLE[d.channel] ?? d.channel}
          </T>
        </View>
        <T size="display" lines={2}>
          {d.title}
        </T>
        <T color={c.muted}>
          {duration(d.durationSec)}, {track.gates.length} {track.gates.length === 1 ? 'step' : 'steps'},{' '}
          {LEVEL[d.difficulty]?.toLowerCase()}. By {d.creator}.
        </T>
      </View>

      {/* action area */}
      <View
        style={{
          position: 'absolute',
          left: px(SAFE.h),
          right: px(SAFE.h),
          bottom: px(SAFE.v),
          flexDirection: 'row',
          gap: px(50),
        }}
      >
        <SpatialNavigationNode orientation="vertical">
          <View style={{ width: px(384), gap: px(16), justifyContent: 'flex-end' }}>
            <DefaultFocus>
              <Button
                primary
                icon="▶"
                label="Start"
                width={384}
                onSelect={() => nav.push({ name: 'pair', lessonId, together: false })}
              />
            </DefaultFocus>
            <Button
              label="Practise together"
              width={384}
              onSelect={() => nav.push({ name: 'pair', lessonId, together: true })}
            />
            <Button label="Back" width={384} onSelect={nav.back} />
          </View>
        </SpatialNavigationNode>

        <View style={{ flex: 1, gap: px(14), justifyContent: 'flex-end' }}>
          <T color={c.muted}>What you'll do</T>
          {track.gates.map((g, i) => (
            <View key={g.id} style={{ flexDirection: 'row', gap: px(16) }}>
              <T color={c.faint} style={{ width: px(36) }}>
                {i + 1}
              </T>
              <T style={{ flex: 1 }} lines={1}>
                {g.label}
                {g.type === 'safety_prerequisite' ? '' : ''}
              </T>
              {g.type === 'safety_prerequisite' && (
                <T size="caption" color={c.near}>
                  Safety check
                </T>
              )}
            </View>
          ))}
          {d.disclaimer && (
            <View
              style={{
                marginTop: px(12),
                paddingLeft: px(20),
                borderLeftWidth: px(4),
                borderLeftColor: c.near,
              }}
            >
              <T size="caption" color={c.text}>
                {d.disclaimer}
              </T>
            </View>
          )}
        </View>

        <View style={{ width: px(410), gap: px(26), justifyContent: 'flex-end' }}>
          {d.needs.length > 0 && <Topic label="You'll need" value={d.needs.join(', ')} />}
          <Topic label="Camera" value={VIEW_HINT[track.camera.view] ?? track.camera.hint} />
          {d.level ? <Topic label="Level" value={d.level} /> : null}
        </View>
      </View>
    </Screen>
  );
}
