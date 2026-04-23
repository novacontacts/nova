import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors, typography } from '@/constants/theme';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accentFrom,
        tabBarInactiveTintColor: colors.textDisabled,
        tabBarLabelStyle: {
          fontSize: typography.xs,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Översikt',
          tabBarIcon: ({ focused }) => <TabIcon emoji="◎" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Utgifter',
          tabBarIcon: ({ focused }) => <TabIcon emoji="↕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="swipe"
        options={{
          title: 'Sortera',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⇄" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Statistik',
          tabBarIcon: ({ focused }) => <TabIcon emoji="◈" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
