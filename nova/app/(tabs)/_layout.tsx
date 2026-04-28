import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

function HouseholdIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M9 22V12h6v10" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

function PrivatIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
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
        name="household"
        options={{
          title: 'Hushåll',
          tabBarIcon: ({ color }) => <HouseholdIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="privat"
        options={{
          title: 'Privat',
          tabBarIcon: ({ color }) => <PrivatIcon color={color} />,
        }}
      />
      <Tabs.Screen name="stats" options={{ href: null }} />
    </Tabs>
  );
}
