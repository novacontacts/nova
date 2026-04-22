import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
  style?: ViewStyle;
};

export function Button({ label, onPress, loading, disabled, variant = 'primary', style }: Props) {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[styles.base, isPrimary ? styles.primary : styles.ghost, (disabled || loading) && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.bg : colors.accentFrom} size="small" />
      ) : (
        <Text style={[styles.label, !isPrimary && styles.labelGhost]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  primary: {
    backgroundColor: colors.accentFrom,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: typography.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  labelGhost: {
    color: colors.accentFrom,
  },
});
