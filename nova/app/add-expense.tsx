import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories } from '@/hooks/useCategories';
import { useAddExpense, useUpdateExpense, useExpense } from '@/hooks/useExpenses';
import { useMerchantPatterns, useRecordMerchantPattern } from '@/hooks/useMerchantPatterns';
import { useHouseholdStore } from '@/lib/store/household';
import { useAuthStore } from '@/lib/store/auth';
import { SplitSlider } from '@/components/ui/SplitSlider';
import { colors, typography, spacing, radius } from '@/constants/theme';

type SplitType = '50/50' | 'custom';

export default function AddExpenseScreen() {
  const router = useRouter();
  const { quick, id } = useLocalSearchParams<{ quick?: string; id?: string }>();
  const isQuick = quick === 'true';
  const isEditing = !!id;

  const { household } = useHouseholdStore();
  const { user } = useAuthStore();
  const { data: categories = [] } = useCategories();
  const addExpense = useAddExpense();
  const updateExpense = useUpdateExpense();
  const { data: existingExpense } = useExpense(id ?? null);
  const { data: patterns = [] } = useMerchantPatterns();
  const recordPattern = useRecordMerchantPattern();

  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(!!household);
  const [splitType, setSplitType] = useState<SplitType>('50/50');
  const [customPct, setCustomPct] = useState(50);
  const [error, setError] = useState('');
  const [manualCategory, setManualCategory] = useState(false);

  useEffect(() => {
    if (!existingExpense) return;
    setAmountStr(existingExpense.amount.toString());
    setDescription(existingExpense.description ?? '');
    setCategoryId(existingExpense.category_id);
    setIsShared(existingExpense.is_shared);
    setSplitType(existingExpense.split_type);
    setCustomPct(Math.round(existingExpense.split_ratio * 100));
  }, [existingExpense]);

  const suggestion = useMemo(() => {
    if (!description.trim() || patterns.length === 0 || manualCategory) return null;
    const words = description.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2);
    return patterns
      .filter(p => words.some(w => p.pattern.includes(w) || w.includes(p.pattern)))
      .sort((a, b) => b.hit_count - a.hit_count)[0] ?? null;
  }, [description, patterns, manualCategory]);

  useEffect(() => {
    if (suggestion && !isEditing) setCategoryId(suggestion.category_id);
  }, [suggestion?.category_id]);

  const amount = parseFloat(amountStr.replace(',', '.')) || 0;
  const splitRatio = splitType === '50/50' ? 0.5 : customPct / 100;
  const hasHousehold = !!household;

  const partner = useHouseholdStore((s) =>
    s.members.find((m) => m.user_id !== user?.id)?.profile
  );

  const isPending = addExpense.isPending || updateExpense.isPending;

  async function handleSave() {
    if (amount <= 0) { setError('Ange ett belopp.'); return; }
    setError('');

    try {
      if (isEditing && id) {
        await updateExpense.mutateAsync({
          id,
          updates: {
            amount,
            description: description.trim() || null,
            category_id: categoryId,
            is_shared: isShared,
            split_type: splitType,
            split_ratio: splitRatio,
            household_id: isShared ? (household?.id ?? null) : null,
            updated_by: user?.id,
            updated_at: new Date().toISOString(),
          },
        });
      } else {
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
          reviewed: !isQuick,
          currency: 'SEK',
        });
      }
      if (description.trim() && categoryId) {
        recordPattern.mutate({ pattern: description.trim(), category_id: categoryId });
      }
      router.back();
    } catch {
      Alert.alert('Fel', 'Kunde inte spara utgiften. Försök igen.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancel}>Avbryt</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEditing ? 'Redigera utgift' : isQuick ? 'Snabb-lägg till' : 'Ny utgift'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isPending}>
            {isPending
              ? <ActivityIndicator color={colors.accentFrom} size="small" />
              : <Text style={styles.save}>Spara</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Belopp */}
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="0"
              placeholderTextColor={colors.textDisabled}
              keyboardType="decimal-pad"
              autoFocus={!isEditing}
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
            returnKeyType="done"
          />

          {/* Kategorier */}
          <Text style={styles.label}>Kategori</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            <View style={styles.catRow}>
              {categories.map((cat) => {
                const isActive = categoryId === cat.id;
                const isSuggested = suggestion?.category_id === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, isActive && styles.catChipActive]}
                    onPress={() => { setCategoryId(cat.id === categoryId ? null : cat.id); setManualCategory(true); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.catIcon}>{cat.icon}</Text>
                    <Text style={[styles.catName, isActive && styles.catNameActive]}>
                      {cat.name}
                    </Text>
                    {isSuggested && !manualCategory && (
                      <Text style={styles.suggestionDot}>⚡</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
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
          {hasHousehold && !isQuick && (
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
                <SplitSlider
                  value={customPct}
                  onChange={setCustomPct}
                  amount={amount}
                  myName="Du"
                  partnerName={partner?.display_name ?? 'Partner'}
                />
              )}
            </>
          )}

          <View style={{ height: 40 }} />
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
  suggestionDot: { fontSize: 10 },

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
});
