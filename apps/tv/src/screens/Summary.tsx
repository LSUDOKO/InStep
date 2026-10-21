import type { SessionSummary } from '@instep/gated-player';
import React, { useState } from 'react';
import { View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode } from 'react-tv-space-navigation';
import { QrCode } from '../components/QrCode';
import { Button, Card, Screen, T, useTheme } from '../components/ui';
import { nav, services } from '../lib/app';
import { useLesson } from '../lib/useLesson';
import { px } from '../theme/tokens';
import { useApp } from '../useStore';

function Stat({ label, value }: { label: string; value: string }) {
  const c = useTheme();
  return (
    <Card style={{ minWidth: px(300), gap: px(8) }}>
      <T size="caption" color={c.muted}>
        {label}
      </T>
      <T size="h1">{value}</T>
    </Card>
  );
}

const encouragement = (s: SessionSummary) =>
  s.gatesPassed === s.gatesTotal
    ? 'Every step done. Well done!'
    : s.gatesPassed > 0
      ? 'Good work today — every practice counts.'
      : 'Thanks for practising. Try again whenever you are ready.';

export function Summary({ lessonId, summary: s }: { lessonId: string; summary: SessionSummary }) {
  const c = useTheme();
  const { lesson } = useLesson(lessonId);
  const profile = useApp((st) => st.profile);
  const [report, setReport] = useState<{ url?: string; error?: string } | null>(null);
  const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));

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
    <Screen>
      <T size="h1">{encouragement(s)}</T>
      <T color={c.muted} style={{ marginTop: px(8) }}>
        {lesson?.detail.title ?? ''}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: px(24), marginTop: px(40) }}>
        <Stat label="Time" value={`${mins} min`} />
        <Stat label="Steps passed" value={`${s.gatesPassed} / ${s.gatesTotal}`} />
        {s.reps > 0 && <Stat label="Reps" value={String(s.reps)} />}
        {s.bestHoldSec > 0 && <Stat label="Best hold" value={`${s.bestHoldSec.toFixed(1)} s`} />}
        {s.avgBpm !== null && <Stat label="Average rhythm" value={`${s.avgBpm} /min`} />}
        {s.swayStops > 0 && <Stat label="Rest breaks" value={String(s.swayStops)} />}
      </View>
      {s.easierMode && (
        <T color={c.info} style={{ marginTop: px(24) }}>
          Easier mode helped on some steps today.
        </T>
      )}
      {lesson?.detail.disclaimer && (
        <T size="caption" color={c.muted} style={{ marginTop: px(24) }}>
          {lesson.detail.disclaimer}
        </T>
      )}
      <View style={{ flexDirection: 'row', gap: px(40), marginTop: px(40), alignItems: 'center' }}>
        <SpatialNavigationNode orientation="horizontal">
          <View style={{ flexDirection: 'row', gap: px(24) }}>
            <DefaultFocus>
              <Button primary label="Done" onSelect={() => nav.reset({ name: 'home' })} />
            </DefaultFocus>
            <Button label="Share with my physio or family" onSelect={() => void share()} />
          </View>
        </SpatialNavigationNode>
        {report?.url && (
          <Card style={{ flexDirection: 'row', gap: px(24), alignItems: 'center' }}>
            <QrCode value={report.url} size={px(220)} />
            <T style={{ maxWidth: px(420) }}>
              Scan to open the progress report. It shows body-point numbers only — never video.
            </T>
          </Card>
        )}
        {report && !report.url && !report.error && <T color={c.muted}>Creating link…</T>}
        {report?.error && <T color={c.far}>{report.error}</T>}
      </View>
    </Screen>
  );
}
