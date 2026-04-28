import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/constants/theme';

export default function PrivatScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <Text style={s.heading}>Privat</Text>
        <View style={s.card}>
          <Text style={s.icon}>🔒</Text>
          <Text style={s.title}>Kommer snart</Text>
          <Text style={s.sub}>
            Här kommer du kunna se din privata ekonomi, egna sparmål och bankkonton.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  wrap:    { flex: 1, paddingHorizontal: spacing.base, paddingTop: spacing.base, gap: spacing.xl },
  heading: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  card:    { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  icon:    { fontSize: 40 },
  title:   { fontSize: typography.lg, fontWeight: '700', color: colors.textPrimary },
  sub:     { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
