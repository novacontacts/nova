import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Graceful degradation when expo-local-authentication isn't installed yet
let LocalAuth: typeof import('expo-local-authentication') | null = null;
try { LocalAuth = require('expo-local-authentication'); } catch (_) {}

const KEY = 'biometric_enabled';

export function useLocalAuth() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      let supported = false;
      if (LocalAuth) {
        const [hw, enrolled] = await Promise.all([
          LocalAuth.hasHardwareAsync(),
          LocalAuth.isEnrolledAsync(),
        ]);
        supported = !!(hw && enrolled);
      }
      const saved = await AsyncStorage.getItem(KEY);
      setIsSupported(supported);
      setIsEnabled(saved === 'true' && supported);
      setIsLoaded(true);
    })();
  }, []);

  async function toggle() {
    const next = !isEnabled;
    setIsEnabled(next);
    await AsyncStorage.setItem(KEY, String(next));
    return next;
  }

  async function authenticate(): Promise<boolean> {
    if (!isEnabled || !isSupported || !LocalAuth) return true;
    const result = await LocalAuth.authenticateAsync({
      promptMessage: 'Lås upp Nova',
      fallbackLabel: 'Använd lösenord',
      cancelLabel: 'Avbryt',
    });
    return result.success;
  }

  return { isSupported, isEnabled, isLoaded, toggle, authenticate };
}
