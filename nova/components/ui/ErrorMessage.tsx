import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message = 'Något gick fel. Försök igen.', onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.btnText}>Försök igen</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
    paddingHorizontal: spacing['2xl'],
  },
  icon: { fontSize: 40 },
  message: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  btn: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: { fontSize: typography.sm, fontWeight: '600', color: colors.textPrimary },
});
