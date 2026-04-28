import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { AppState } from 'react-native';
import { colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { usePushToken } from '@/hooks/usePushToken';

try { SplashScreen.preventAutoHideAsync(); } catch (_) {}

const queryClient = new QueryClient();

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { session, initialized, setSession, fetchProfile, signOut } = useAuthStore();
  const { household, fetchHousehold, reset } = useHouseholdStore();
  const { authenticate, isEnabled } = useLocalAuth();
  usePushToken(session?.user?.id ?? null);
  const appStateRef = useRef(AppState.currentState);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_completed').then((val) => {
      setOnboardingDone(val === 'true');
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        supabase.auth.signOut();
        setSession(null);
        return;
      }
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchHousehold(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchHousehold(session.user.id);
      } else {
        reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isEnabled) return;
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev.match(/inactive|background/) && nextState === 'active' && session) {
        const ok = await authenticate();
        if (!ok) signOut();
      }
    });
    return () => sub.remove();
  }, [isEnabled, session]);

  useEffect(() => {
    if (!onboardingChecked || !initialized) return;

    try { SplashScreen.hideAsync(); } catch (_) {}

    const inOnboarding = segments[0] === 'onboarding';
    const inAuthGroup  = segments[0] === '(auth)';
    const inSetupGroup = segments[0] === '(setup)';

    if (!onboardingDone) {
      if (!inOnboarding) router.replace('/onboarding');
      return;
    }

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    if (household === undefined) return;

    if (!household && !inSetupGroup) {
      router.replace('/(setup)');
    } else if (household && (inAuthGroup || inSetupGroup)) {
      router.replace('/(tabs)');
    } else if (inAuthGroup) {
      router.replace('/(setup)');
    }
  }, [session, initialized, household, segments, onboardingChecked, onboardingDone]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AuthGate />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(setup)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-expense" options={{ presentation: 'modal' }} />
          <Stack.Screen name="add-category" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="import-csv" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settle" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settlements" options={{ presentation: 'modal' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
