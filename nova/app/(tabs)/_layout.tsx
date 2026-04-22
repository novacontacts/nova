import { Tabs } from 'expo-router';
import { colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accentFrom,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Översikt' }} />
      <Tabs.Screen name="expenses" options={{ title: 'Utgifter' }} />
      <Tabs.Screen name="swipe" options={{ title: 'Sortera' }} />
      <Tabs.Screen name="stats" options={{ title: 'Statistik' }} />
    </Tabs>
  );
}
