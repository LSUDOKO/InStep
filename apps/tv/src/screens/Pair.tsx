import React, { useEffect } from 'react';
import { View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode } from 'react-tv-space-navigation';
import { QrCode } from '../components/QrCode';
import { Button, Card, Chip, Screen, T, useTheme } from '../components/ui';
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
  return (
    <Screen>
      <T size="h1">{together ? 'Practise together' : 'Pair your camera'}</T>
      <View style={{ flexDirection: 'row', gap: px(80), marginTop: px(40), flex: 1 }}>
        <Card style={{ alignItems: 'center', gap: px(20), padding: px(40) }}>
          {joinUrl ? (
            <QrCode value={joinUrl} size={px(420)} />
          ) : (
            <View style={{ width: px(420), height: px(420), alignItems: 'center', justifyContent: 'center' }}>
              <T color={c.muted}>Creating a room…</T>
            </View>
          )}
          <T size="caption" color={c.muted}>
            ROOM CODE
          </T>
          <T size="display" style={{ letterSpacing: px(16) }}>
            {room || '····'}
          </T>
        </Card>
        <View style={{ flex: 1, gap: px(28), justifyContent: 'center' }}>
          <T size="h2">Open this on your phone or laptop</T>
          <T color={c.muted}>
            Scan the QR code, or go to {joinUrl ? joinUrl.replace(/\?.*/, '') : 'the InStep page'} and type
            the room code.
          </T>
          <Card style={{ flexDirection: 'row', gap: px(18), alignItems: 'center' }}>
            <T color={c.ok}>🔒</T>
            <T style={{ flex: 1 }}>Your camera stays on your device — only body points are shared.</T>
          </Card>
          {together && guestUrl ? (
            <Card style={{ flexDirection: 'row', gap: px(28), alignItems: 'center' }}>
              <QrCode value={guestUrl} size={px(200)} />
              <View style={{ flex: 1, gap: px(8) }}>
                <T weight="700">Family member</T>
                <T color={c.muted}>Scan this code on a second phone — at home or anywhere.</T>
              </View>
            </Card>
          ) : null}
          <View style={{ flexDirection: 'row', gap: px(16) }}>
            <Chip tone={host ? 'ok' : 'info'} label={host ? 'Camera ✓' : 'Waiting for camera…'} />
            {together && (
              <Chip
                tone={guests.length ? 'ok' : 'info'}
                label={
                  guests.length
                    ? `${guests.map((g) => g.name ?? 'Guest').join(', ')} ✓`
                    : 'Waiting for family member…'
                }
              />
            )}
            {status !== 'online' && <Chip tone="near" label="Reconnecting to server…" />}
          </View>
          <SpatialNavigationNode orientation="horizontal">
            <View style={{ flexDirection: 'row', gap: px(20) }}>
              {together && host && !guests.length && (
                <Button
                  label="Start without a family member"
                  onSelect={() => nav.replace({ name: 'cameraCheck', lessonId })}
                />
              )}
              <DefaultFocus>
                <Button label="Back" onSelect={nav.back} />
              </DefaultFocus>
            </View>
          </SpatialNavigationNode>
        </View>
      </View>
    </Screen>
  );
}
