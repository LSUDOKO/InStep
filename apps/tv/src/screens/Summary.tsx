import type { SessionSummary } from '@instep/gated-player';
import React, { useState } from 'react';
import { View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode } from 'react-tv-space-navigation';
import { QrCode } from '../components/QrCode';
import { Backdrop, Button, Screen, T, useTheme } from '../components/ui';
import { nav, services } from '../lib/app';
import { useLesson } from '../lib/useLesson';
import { px, SAFE } from '../theme/tokens';
import { useApp } from '../useStore';

function Stat({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: px(2), minWidth: px(220) }}>
      <T size="h1">{value}</T>
      <T size="caption" color={c.muted}>
        {label}
      </T>
    </View>
  );
}

const encouragement = (s: SessionSummary) =>
  s.gatesPassed === s.gatesTotal
    ? 'Every step done. Well done!'
    : s.gatesPassed > 0
      ? 'Good work today. Every practice counts.'
      : 'Thanks for practising. Try again whenever you are ready.';

/** tvOS Post Play: lesson art dimmed behind, result and actions bottom-left, share code on a glass platter. */
export function Summary({ lessonId, summary: s }: { lessonId: string; summary: SessionSummary }) {
  const c = useTheme();
  const { lesson } = useLesson(lessonId);
  const profile = useApp((st) => st.profile);
  const [report, setReport] = useState<{ url?: string; error?: string } | null>(null);
  const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
  const poster = lesson?.detail.posterUrl;

  const share = async () => {
    if (!profile) return;
    setReport({});
    try {
      setReport({ url: (await services.api.createReport(profile.id)).url });
    } catch (e) {
      setReport({ error: (e as Error).message });
    }
  };

  return (
    <Screen bleed>
      <Backdrop source={poster ? { uri: services.api.url(poster) } : null} dim={0.55} />
      <View
        style={{
          position: 'absolute',
          left: px(SAFE.h),
          bottom: px(SAFE.v),
          width: px(1100),
          gap: px(18),
        }}
      >
        <T size="caption" weight="600" color={c.muted}>
          {lesson?.detail.title ?? ''}
        </T>
        <T size="display">{encouragement(s)}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: px(56), marginTop: px(12) }}>
          <Stat label="Time" value={`${mins} min`} />
          <Stat label="Steps passed" value={`${s.gatesPassed} of ${s.gatesTotal}`} />
          {s.reps > 0 && <Stat label="Reps" value={String(s.reps)} />}
          {s.bestHoldSec > 0 && <Stat label="Best hold" value={`${s.bestHoldSec.toFixed(1)} s`} />}
          {s.avgBpm !== null && <Stat label="Average rhythm" value={`${s.avgBpm} per min`} />}
          {s.swayStops > 0 && <Stat label="Rest breaks" value={String(s.swayStops)} />}
        </View>
        {s.easierMode && <T color={c.info}>Easier mode helped on some steps today.</T>}
        {lesson?.detail.disclaimer && (
          <T size="caption" color={c.muted}>
            {lesson.detail.disclaimer}
          </T>
        )}
        <SpatialNavigationNode orientation="horizontal">
          <View style={{ flexDirection: 'row', gap: px(24), marginTop: px(16) }}>
            <DefaultFocus>
              <Button primary label="Done" width={240} onSelect={() => nav.reset({ name: 'home' })} />
            </DefaultFocus>
            <Button label="Share with my physio or family" onSelect={() => void share()} />
          </View>
        </SpatialNavigationNode>
      </View>

      {report && (
        <View
          style={{
            position: 'absolute',
            right: px(SAFE.h + 40),
            top: px(212),
            width: px(530),
            borderRadius: px(50),
            backgroundColor: c.surface,
            borderWidth: px(1),
            borderColor: c.hairline,
            padding: px(44),
            alignItems: 'center',
            gap: px(24),
          }}
        >
          {report.url ? (
            <>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: px(24), padding: px(20) }}>
                <QrCode value={report.url} size={px(360)} />
              </View>
              <T weight="700" style={{ textAlign: 'center' }}>
                Scan to open the progress report
              </T>
              <T size="caption" color={c.muted} style={{ textAlign: 'center' }}>
                It shows body-point numbers only, never video.
              </T>
            </>
          ) : report.error ? (
            <T color={c.far}>{report.error}</T>
          ) : (
            <T color={c.muted}>Creating link…</T>
          )}
        </View>
      )}
    </Screen>
  );
}
