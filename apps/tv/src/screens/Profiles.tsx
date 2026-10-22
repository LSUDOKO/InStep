import type { Profile } from '@instep/protocol';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { DefaultFocus, SpatialNavigationNode } from 'react-tv-space-navigation';
import { Avatar, avatarSize } from '../components/Avatar';
import { Button, Focusable, Screen, StateScreen, T, useTheme } from '../components/ui';
import { nav, refreshCatalog, services, store } from '../lib/app';
import { px } from '../theme/tokens';

export function Profiles() {
  const c = useTheme();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    services.api.profiles().then(setProfiles, (e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const choose = (p: Profile) => {
    store.set({ profile: p });
    void refreshCatalog();
    nav.reset({ name: 'home' });
  };

  if (error)
    return (
      <StateScreen
        icon="!"
        title="Couldn't load profiles"
        body={error}
        actions={<Button primary label="Try again" onSelect={load} />}
      />
    );
  if (!profiles) return <StateScreen icon="…" title="Loading profiles" />;
  if (profiles.length === 0)
    return (
      <StateScreen
        icon="+"
        title="Welcome to InStep"
        body="Videos that wait for you. Create a profile so your progress is saved."
        actions={
          <DefaultFocus>
            <Button primary label="Create a profile" onSelect={() => nav.push({ name: 'addProfile' })} />
          </DefaultFocus>
        }
      />
    );

  // tvOS user selection: large round portraits, centred; focus lifts the portrait
  const tileW = avatarSize + px(40);
  return (
    <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
      <T size="h1" style={{ marginBottom: px(80), textAlign: 'center' }}>
        Who's practising?
      </T>
      <SpatialNavigationNode orientation="horizontal">
        <View style={{ flexDirection: 'row', gap: px(64), alignItems: 'flex-start' }}>
          {profiles.map((p, i) => {
            const tile = (
              <View key={p.id} style={{ width: tileW, alignItems: 'center', gap: px(28) }}>
                <Focusable
                  variant="lift"
                  scale={1.12}
                  onSelect={() => choose(p)}
                  style={{ borderRadius: avatarSize, padding: px(6) }}
                >
                  {() => <Avatar name={p.name} avatar={p.avatar} size={avatarSize} />}
                </Focusable>
                <T size="headline" lines={1}>
                  {p.name}
                </T>
              </View>
            );
            return i === 0 ? <DefaultFocus key={p.id}>{tile}</DefaultFocus> : tile;
          })}
          {profiles.length < 6 && (
            <View style={{ width: tileW, alignItems: 'center', gap: px(28) }}>
              <Focusable
                variant="lift"
                scale={1.12}
                onSelect={() => nav.push({ name: 'addProfile' })}
                style={{ borderRadius: avatarSize, padding: px(6) }}
              >
                {() => (
                  <View
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: avatarSize / 2,
                      backgroundColor: c.surface,
                      borderWidth: px(1),
                      borderColor: c.hairline,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T size="display" color={c.muted}>
                      +
                    </T>
                  </View>
                )}
              </Focusable>
              <T size="headline" color={c.muted}>
                Add profile
              </T>
            </View>
          )}
        </View>
      </SpatialNavigationNode>
    </Screen>
  );
}
