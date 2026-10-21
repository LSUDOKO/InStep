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

  return (
    <Screen style={{ justifyContent: 'center' }}>
      <T size="h1" style={{ marginBottom: px(64) }}>
        Who's practising?
      </T>
      <SpatialNavigationNode orientation="horizontal">
        <View style={{ flexDirection: 'row', gap: px(48) }}>
          {profiles.map((p, i) => {
            const tile = (
              <Focusable
                key={p.id}
                onSelect={() => choose(p)}
                style={{ padding: px(24), alignItems: 'center', gap: px(20), width: px(280) }}
              >
                {() => (
                  <>
                    <Avatar name={p.name} avatar={p.avatar} size={avatarSize} />
                    <T size="h2" lines={1}>
                      {p.name}
                    </T>
                  </>
                )}
              </Focusable>
            );
            return i === 0 ? <DefaultFocus key={p.id}>{tile}</DefaultFocus> : tile;
          })}
          {profiles.length < 6 && (
            <Focusable
              onSelect={() => nav.push({ name: 'addProfile' })}
              style={{ padding: px(24), alignItems: 'center', gap: px(20), width: px(280) }}
            >
              {() => (
                <>
                  <View
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: avatarSize / 2,
                      borderWidth: px(4),
                      borderColor: c.muted,
                      borderStyle: 'dashed',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <T size="display" color={c.muted}>
                      +
                    </T>
                  </View>
                  <T size="h2" color={c.muted}>
                    Add profile
                  </T>
                </>
              )}
            </Focusable>
          )}
        </View>
      </SpatialNavigationNode>
    </Screen>
  );
}
