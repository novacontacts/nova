import { useState } from 'react';
import { TextInput, Text, View, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  secureToggle?: boolean;
};

export function Input({ label, error, secureToggle, secureTextEntry, style, ...props }: Props) {
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.row, error ? styles.inputError : styles.inputNormal]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textDisabled}
          selectionColor={colors.accentFrom}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {secureToggle && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} style={styles.toggle}>
            <Text style={styles.toggleText}>{hidden ? 'Visa' : 'Dölj'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputNormal: { borderColor: colors.border },
  inputError:  { borderColor: colors.negative },
  input: {
    flex: 1,
    height: 52,
    fontSize: typography.base,
    color: colors.textPrimary,
  },
  toggle: { paddingLeft: spacing.sm },
  toggleText: { fontSize: typography.sm, color: colors.accentFrom, fontWeight: '500' },
  error: { fontSize: typography.xs, color: colors.negative },
});
