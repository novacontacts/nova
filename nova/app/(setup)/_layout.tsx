import { Stack } from 'expo-router';
import { colors } from '@/constants/theme';

export default function SetupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
