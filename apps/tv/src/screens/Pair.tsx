import React, { useEffect } from 'react';
import { View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode } from 'react-tv-space-navigation';
import { QrCode } from '../components/QrCode';
import { Button, Screen, T, useTheme } from '../components/ui';
import { nav } from '../lib/app';
import { px } from '../theme/tokens';
import { useApp } from '../useStore';

export function Pair({ lessonId, together }: { lessonId: string; together: boolean }) {
  const c = useTheme();
  const room = useApp((s) => s.room);
  const joinUrl = useApp((s) => s.joinUrl);
  const peers = useApp((s) => s.peers);
  const status = useApp((s) => s.relayStatus);
  const host = peers.find((p) => p.role === 'host');
  const guests = peers.filter((p) => p.role === 'guest');
  const ready = !!host && (!together || guests.length > 0);

  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => nav.replace({ name: 'cameraCheck', lessonId }), 800);
      return () => clearTimeout(t);
    }
  }, [ready, lessonId]);

  const guestUrl = joinUrl ? `${joinUrl}&role=guest` : '';
  const site = joinUrl ? joinUrl.replace(/\?.*/, '').replace(/^https?:\/\//, '') : 'the InStep page';
  return (
    <Screen style={{ flexDirection: 'row', alignItems: 'center', gap: px(150) }}>
      {/* dialogue column */}
      <View style={{ width: px(960), gap: px(32) }}>
        <T size="h1">{together ? 'Practise together' : 'Use your phone as the camera'}</T>
        <T color={c.muted}>
          Scan the code with your phone&apos;s camera, or open the address on the right in any browser and
          enter the room code. Then stand the phone where it can see you.
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: px(16) }}>
          <View style={{ width: px(10), height: px(10), borderRadius: px(5), backgroundColor: c.ok }} />
          <T color={c.text}>Your camera stays on your phone. Only body points are shared.</T>
        </View>
        <View style={{ gap: px(14) }}>
          <Status ok={!!host} label={host ? 'Camera connected' : 'Waiting for the camera'} />
          {together && (
            <Status
              ok={guests.length > 0}
              label={
                guests.length
                  ? `${guests.map((g) => g.name ?? 'Family member').join(', ')} joined`
                  : 'Waiting for a family member'
              }
            />
          )}
          {status !== 'online' && <Status ok={false} label="Reconnecting to the server" />}
        </View>
        <SpatialNavigationNode orientation="vertical">
          <View style={{ gap: px(16), marginTop: px(16), width: px(500) }}>
            {together && host && !guests.length && (
              <Button
                label="Start without a family member"
                width={500}
                onSelect={() => nav.replace({ name: 'cameraCheck', lessonId })}
              />
            )}
            <DefaultFocus>
              <Button label="Back" width={500} onSelect={nav.back} />
            </DefaultFocus>
          </View>
        </SpatialNavigationNode>
      </View>

      {/* code platter */}
      <View style={{ gap: px(28) }}>
        <View
          style={{
            width: px(530),
            borderRadius: px(50),
            backgroundColor: c.surface,
            borderWidth: px(1),
            borderColor: c.hairline,
            paddingVertical: px(44),
            alignItems: 'center',
            gap: px(26),
          }}
        >
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: px(24), padding: px(20) }}>
            {joinUrl ? (
              <QrCode value={joinUrl} size={px(360)} />
            ) : (
              <View
                style={{ width: px(360), height: px(360), alignItems: 'center', justifyContent: 'center' }}
              >
                <T color={c.onFocus}>Creating a room…</T>
              </View>
            )}
          </View>
          <View style={{ alignItems: 'center', gap: px(2) }}>
            <T color={c.muted}>{site}</T>
            <T color={c.muted}>Room code</T>
            <T size="display" style={{ letterSpacing: px(18) }}>
              {room || '····'}
            </T>
          </View>
        </View>
        {together && guestUrl ? (
          <View
            style={{
              width: px(530),
              borderRadius: px(32),
              backgroundColor: c.surface,
              borderWidth: px(1),
              borderColor: c.hairline,
              padding: px(24),
              flexDirection: 'row',
              alignItems: 'center',
              gap: px(24),
            }}
          >
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: px(14), padding: px(10) }}>
              <QrCode value={guestUrl} size={px(150)} />
            </View>
            <View style={{ flex: 1, gap: px(4) }}>
              <T weight="700">Family member</T>
              <T size="caption" color={c.muted}>
                Scan on a second phone, at home or anywhere.
              </T>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: px(16) }}>
      <T color={ok ? c.ok : c.faint} weight="700" style={{ width: px(32) }}>
        {ok ? '✓' : '•'}
      </T>
      <T color={ok ? c.text : c.muted}>{label}</T>
    </View>
  );
}
