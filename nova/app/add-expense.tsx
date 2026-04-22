import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories } from '@/hooks/useCategories';
import { useAddExpense } from '@/hooks/useExpenses';
import { useHouseholdStore } from '@/lib/store/household';
import { colors, typography, spacing, radius } from '@/constants/theme';

type SplitType = '50/50' | 'custom';

export default function AddExpenseScreen() {
  const router = useRouter();
  const { quick } = useLocalSearchParams<{ quick?: string }>();
  const isQuick = quick === 'true';
  const { household } = useHouseholdStore();
  const { data: categories = [] } = useCategories();
  const addExpense = useAddExpense();

  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(!!household);
  const [splitType, setSplitType] = useState<SplitType>('50/50');
  const [customPct, setCustomPct] = useState('50');
  const [error, setError] = useState('');

  const amount = parseFloat(amountStr.replace(',', '.')) || 0;
  const splitRatio = splitType === '50/50' ? 0.5 : Math.min(100, Math.max(0, parseFloat(customPct) || 50)) / 100;
  const hasHousehold = !!household;

  async function handleSave() {
    if (amount <= 0) { setError('Ange ett belopp.'); return; }
    setError('');

    await addExpense.mutateAsync({
      amount,
      description: description.trim() || null,
      category_id: categoryId,
      date: new Date().toISOString().split('T')[0],
      is_shared: isQuick ? false : isShared,
      split_type: splitType,
      split_ratio: splitRatio,
      is_recurring: false,
      recurring_id: null,
      reviewed: !isQuick, // quick-add → hamnar i swipe-kön
    });

    router.back();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancel}>Avbryt</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isQuick ? 'Snabb-lägg till' : 'Ny utgift'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={addExpense.isPending}>
            {addExpense.isPending
              ? <ActivityIndicator color={colors.accentFrom} size="small" />
              : <Text style={styles.save}>Spara</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Belopp */}
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="0"
              placeholderTextColor={colors.textDisabled}
              keyboardType="decimal-pad"
              autoFocus
              selectionColor={colors.accentFrom}
            />
            <Text style={styles.currency}>kr</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Beskrivning */}
          <TextInput
            style={styles.descInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Beskrivning (valfritt)"
            placeholderTextColor={colors.textDisabled}
            selectionColor={colors.accentFrom}
          />

          {/* Kategorier */}
          <Text style={styles.label}>Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            <View style={styles.catRow}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catChip, categoryId === cat.id && styles.catChipActive]}
                  onPress={() => setCategoryId(cat.id === categoryId ? null : cat.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={[styles.catName, categoryId === cat.id && styles.catNameActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.catChip}
                onPress={() => router.push('/add-category')}
                activeOpacity={0.7}
              >
                <Text style={styles.catIcon}>＋</Text>
                <Text style={styles.catName}>Ny</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Privat / Delad */}
          {hasHousehold && (
            <>
              <Text style={styles.label}>Typ</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !isShared && styles.toggleActive]}
                  onPress={() => setIsShared(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleText, !isShared && styles.toggleTextActive]}>🔒 Privat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, isShared && styles.toggleActive]}
                  onPress={() => setIsShared(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleText, isShared && styles.toggleTextActive]}>🤝 Delad</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Fördelning */}
          {isShared && hasHousehold && (
            <>
              <Text style={styles.label}>Fördelning</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, splitType === '50/50' && styles.toggleActive]}
                  onPress={() => setSplitType('50/50')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleText, splitType === '50/50' && styles.toggleTextActive]}>50 / 50</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, splitType === 'custom' && styles.toggleActive]}
                  onPress={() => setSplitType('custom')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.toggleText, splitType === 'custom' && styles.toggleTextActive]}>Anpassad</Text>
                </TouchableOpacity>
              </View>

              {splitType === 'custom' && (
                <View style={styles.customSplitRow}>
                  <Text style={styles.splitLabel}>Din andel:</Text>
                  <View style={styles.pctInputRow}>
                    <TextInput
                      style={styles.pctInput}
                      value={customPct}
                      onChangeText={setCustomPct}
                      keyboardType="number-pad"
                      selectionColor={colors.accentFrom}
                      maxLength={3}
                    />
                    <Text style={styles.pctSymbol}>%</Text>
                  </View>
                  <Text style={styles.splitLabel}>
                    = {amount > 0 ? `${(amount * (parseFloat(customPct) / 100 || 0)).toFixed(0)} kr` : '—'}
                  </Text>
                </View>
              )}
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: { fontSize: typography.base, color: colors.textSecondary },
  title: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  save: { fontSize: typography.base, fontWeight: '600', color: colors.accentFrom },

  content: { padding: spacing.base, gap: spacing.lg },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  amountInput: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -2,
    minWidth: 80,
    textAlign: 'right',
  },
  currency: { fontSize: typography['2xl'], fontWeight: '600', color: colors.textSecondary, paddingBottom: 10 },
  error: { fontSize: typography.sm, color: colors.negative, textAlign: 'center', marginTop: -spacing.md },

  descInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 52,
    fontSize: typography.base,
    color: colors.textPrimary,
  },

  label: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  catScroll: { marginHorizontal: -spacing.base },
  catRow: { flexDirection: 'row', paddingHorizontal: spacing.base, gap: spacing.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: { borderColor: colors.accentFrom, backgroundColor: colors.surfaceRaised },
  catIcon: { fontSize: 16 },
  catName: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },
  catNameActive: { color: colors.accentFrom },

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm - 2 },
  toggleActive: { backgroundColor: colors.surfaceRaised },
  toggleText: { fontSize: typography.base, color: colors.textSecondary, fontWeight: '500' },
  toggleTextActive: { color: colors.textPrimary, fontWeight: '600' },

  customSplitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  splitLabel: { fontSize: typography.base, color: colors.textSecondary },
  pctInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accentFrom, paddingHorizontal: spacing.md },
  pctInput: { fontSize: typography.xl, fontWeight: '700', color: colors.accentFrom, width: 56, textAlign: 'center' },
  pctSymbol: { fontSize: typography.base, color: colors.accentFrom, fontWeight: '600' },
});
