import React from 'react';
import { DefaultFocus } from 'react-tv-space-navigation';
import { Button, StateScreen, T, useTheme } from '../components/ui';
import { nav } from '../lib/app';
import { useApp } from '../useStore';
import { connectAndCheck } from './Splash';

export function ServerError({ message }: { message: string }) {
  const c = useTheme();
  const url = useApp((s) => s.settings.serverUrl);
  return (
    <StateScreen
      icon="!"
      title="Can't reach the InStep server"
      body={
        <>
          <T color={c.muted}>{message}</T>
          <T color={c.muted}>Server address: {url}</T>
          <T color={c.muted}>
            Make sure the InStep server is running on your computer and both are on the same network.
          </T>
        </>
      }
      actions={
        <>
          <DefaultFocus>
            <Button primary label="Try again" icon="↻" onSelect={() => void connectAndCheck()} />
          </DefaultFocus>
          <Button label="Open Settings" icon="⚙" onSelect={() => nav.push({ name: 'settings' })} />
        </>
      }
    />
  );
}
