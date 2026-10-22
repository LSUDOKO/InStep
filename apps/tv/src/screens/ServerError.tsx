import React from 'react';
import { DefaultFocus } from 'react-tv-space-navigation';
import { Button, StateScreen, T, useTheme } from '../components/ui';
import { nav } from '../lib/app';
import { useApp } from '../useStore';
import { connectAndCheck } from './Splash';

export function ServerError({ message: _message }: { message: string }) {
  const c = useTheme();
  const url = useApp((s) => s.settings.serverUrl);
  return (
    <StateScreen
      icon="!"
      title="Can't reach the InStep server"
      body={
        <>
          <T color={c.muted} style={{ textAlign: 'center' }}>
            {url}
          </T>
          <T color={c.muted} style={{ textAlign: 'center' }}>
            {/^https:/.test(url)
              ? 'The hosted server may be waking up, which can take up to a minute. Try again shortly.'
              : 'Make sure the InStep server is running on your computer and the TV is on the same network.'}
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
