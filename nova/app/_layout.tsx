import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const { session, initialized, setSession, fetchProfile } = useAuthStore();
  const { household, fetchHousehold, reset } = useHouseholdStore();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_completed').then((val) => {
      setOnboardingDone(val === 'true');
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
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
    if (!onboardingChecked || !initialized) return;

    // Dölj splash screen när appen är klar att visa
    SplashScreen.hideAsync();

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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
        </Stack>
      </QueryClientProvider>
    </View>
  );
}
