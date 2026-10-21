import type { Progress as P } from '@instep/protocol';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DefaultFocus } from 'react-tv-space-navigation';
import { Button, Card, Screen, StateScreen, T, useTheme } from '../components/ui';
import { nav, services } from '../lib/app';
import { px } from '../theme/tokens';
import { useApp } from '../useStore';

export function Progress() {
  const c = useTheme();
  const profile = useApp((s) => s.profile);
  const [data, setData] = useState<P | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    if (!profile) return;
    setError(null);
    services.api.progress(profile.id, 14).then(setData, (e: Error) => setError(e.message));
  };
  useEffect(load, [profile]);

  if (error)
    return (
      <StateScreen
        icon="!"
        title="Couldn't load your progress"
        body={error}
        actions={<Button primary label="Try again" onSelect={load} />}
      />
    );
  if (!data) return <StateScreen icon="…" title="Loading your progress" />;

  const max = Math.max(1, ...data.days.map((d) => d.sessions));
  const H = px(360);
  return (
    <Screen>
      <T size="h1">My progress</T>
      <T color={c.muted}>Last 14 days</T>
      <View style={{ flexDirection: 'row', gap: px(24), marginTop: px(36) }}>
        <Card style={{ minWidth: px(300) }}>
          <T size="caption" color={c.muted}>
            Sessions
          </T>
          <T size="display">{data.totals.sessions}</T>
        </Card>
        <Card style={{ minWidth: px(300) }}>
          <T size="caption" color={c.muted}>
            Reps
          </T>
          <T size="display">{data.totals.reps}</T>
        </Card>
        <Card style={{ minWidth: px(300) }}>
          <T size="caption" color={c.muted}>
            Days in a row
          </T>
          <T size="display">{data.totals.streakDays}</T>
        </Card>
      </View>
      {data.totals.sessions === 0 ? (
        <T style={{ marginTop: px(48) }} color={c.muted}>
          No sessions yet. Your practice will show up here.
        </T>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: px(18),
            height: H + px(60),
            marginTop: px(48),
          }}
        >
          {data.days.map((d) => (
            <View key={d.date} style={{ alignItems: 'center', gap: px(10), flex: 1 }}>
              <T size="caption">{d.sessions || ''}</T>
              <View
                style={{
                  width: '70%',
                  height: Math.max(px(6), (d.sessions / max) * H),
                  backgroundColor: d.sessions ? c.brand : c.surface2,
                  borderRadius: px(8),
                }}
              />
              <T size="caption" color={c.muted}>
                {d.date.slice(8)}
              </T>
            </View>
          ))}
        </View>
      )}
      <View style={{ marginTop: px(40), flexDirection: 'row' }}>
        <DefaultFocus>
          <Button label="Back" onSelect={nav.back} />
        </DefaultFocus>
      </View>
    </Screen>
  );
}
