import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Logo } from '../components/Logo';
import { Screen, T, useTheme } from '../components/ui';
import { nav, services, store } from '../lib/app';
import { parseSettings } from '../lib/settings';
import { px } from '../theme/tokens';

export const SETTINGS_KEY = 'instep.settings';

export async function connectAndCheck() {
  const { settings } = store.get();
  services.connect(settings.serverUrl);
  try {
    const h = await services.api.health();
    store.set({ mockAi: h.mockAi });
    nav.reset({ name: 'profiles' });
  } catch (e) {
    nav.reset({ name: 'serverError', message: (e as Error).message });
  }
}

export function Splash() {
  const c = useTheme();
  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY).catch(() => null);
      store.set({ settings: parseSettings(raw) });
      await connectAndCheck();
    })();
  }, []);
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: px(24) }}>
        <Logo size={px(160)} />
        <T size="display">InStep</T>
        <T size="h2" color={c.muted} weight="400">
          The video that waits for you.
        </T>
      </View>
    </Screen>
  );
}
