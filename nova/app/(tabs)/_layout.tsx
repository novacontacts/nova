import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, typography } from '@/constants/theme';

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ExpensesIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M8 10h8M8 14h6" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function SwipeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={6} width={11} height={14} rx={2} stroke={color} strokeWidth={1.6} />
      <Rect x={9} y={4} width={11} height={14} rx={2} stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

function StatsIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20V10M10 20V4M16 20v-8M22 20H2"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accentFrom,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Översikt',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Utgifter',
          tabBarIcon: ({ color }) => <ExpensesIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="swipe"
        options={{
          title: 'Sortera',
          tabBarIcon: ({ color }) => <SwipeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Statistik',
          tabBarIcon: ({ color }) => <StatsIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
