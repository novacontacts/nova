import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Image, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCategories } from '@/hooks/useCategories';
import { useAddExpense, useUpdateExpense, useExpense } from '@/hooks/useExpenses';
import { useMerchantPatterns, useRecordMerchantPattern } from '@/hooks/useMerchantPatterns';
import { useHouseholdStore } from '@/lib/store/household';
import { useAuthStore } from '@/lib/store/auth';
import { SplitSlider } from '@/components/ui/SplitSlider';
import { colors, typography, spacing, radius } from '@/constants/theme';

type SplitType = '50/50' | 'custom';

function formatDateLabel(d: Date) {
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return 'Idag';
  if (isYesterday) return 'Igår';
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatAmount(n: number) {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

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
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    if (!existingExpense) return;
    setAmountStr(existingExpense.amount.toString());
    setDescription(existingExpense.description ?? '');
    setCategoryId(existingExpense.category_id);
    setIsShared(existingExpense.is_shared);
    setSplitType(existingExpense.split_type);
    setCustomPct(Math.round(existingExpense.split_ratio * 100));
    setDate(new Date(existingExpense.date + 'T00:00:00'));
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

  // Live preview för delade utgifter
  const myShare = isShared && hasHousehold ? amount * splitRatio : amount;
  const partnerShare = isShared && hasHousehold ? amount * (1 - splitRatio) : 0;

  async function pickReceipt(source: 'camera' | 'library') {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Behörighet saknas', 'Ge appen tillgång till kamera/bibliotek i inställningar.');
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: false, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets[0]) {
      setReceiptUri(result.assets[0].uri);
    }
  }

  function chooseReceipt() {
    Alert.alert('Lägg till kvitto', undefined, [
      { text: 'Ta foto', onPress: () => pickReceipt('camera') },
      { text: 'Välj från bibliotek', onPress: () => pickReceipt('library') },
      { text: 'Avbryt', style: 'cancel' },
    ]);
  }

  async function handleSave() {
    if (amount <= 0) { setError('Ange ett belopp.'); return; }
    setError('');

    const dateStr = date.toISOString().split('T')[0];

    try {
      if (isEditing && id) {
        await updateExpense.mutateAsync({
          id,
          updates: {
            amount,
            description: description.trim() || null,
            category_id: categoryId,
            date: dateStr,
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
          date: dateStr,
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
          {/* Belopp — extra stort + datum-pill + kvitto */}
          <View style={styles.amountWrap}>
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

            {/* Live preview för delade */}
            {isShared && hasHousehold && amount > 0 && (
              <View style={styles.previewRow}>
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Du betalar</Text>
                  <Text style={[styles.previewValue, { color: colors.accentFrom }]}>
                    {formatAmount(myShare)}
                  </Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>{partner?.display_name ?? 'Sambo'}</Text>
                  <Text style={styles.previewValue}>{formatAmount(partnerShare)}</Text>
                </View>
              </View>
            )}

            {/* Meta-rad: datum + kvitto */}
            <View style={styles.metaRow}>
              <TouchableOpacity
                style={styles.metaPill}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.metaIcon}>📅</Text>
                <Text style={styles.metaText}>{formatDateLabel(date)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.metaPill}
                onPress={receiptUri ? () => setShowReceipt(true) : chooseReceipt}
                activeOpacity={0.7}
              >
                <Text style={styles.metaIcon}>{receiptUri ? '🧾' : '📎'}</Text>
                <Text style={styles.metaText}>{receiptUri ? 'Kvitto bifogat' : 'Lägg till kvitto'}</Text>
              </TouchableOpacity>
            </View>
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

      {/* Datum picker */}
      {showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide">
            <View style={styles.dateBackdrop}>
              <View style={styles.dateSheet}>
                <View style={styles.dateSheetHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.cancel}>Avbryt</Text>
                  </TouchableOpacity>
                  <Text style={styles.title}>Datum</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.save}>Klar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  themeVariant="dark"
                  maximumDate={new Date()}
                  onChange={(_, d) => d && setDate(d)}
                  locale="sv-SE"
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={date}
            mode="date"
            maximumDate={new Date()}
            onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }}
          />
        )
      )}

      {/* Kvitto-preview */}
      <Modal visible={showReceipt} transparent animationType="fade">
        <TouchableOpacity
          style={styles.receiptBackdrop}
          activeOpacity={1}
          onPress={() => setShowReceipt(false)}
        >
          {receiptUri && (
            <Image
              source={{ uri: receiptUri }}
              style={styles.receiptImg}
              resizeMode="contain"
            />
          )}
          <View style={styles.receiptActions}>
            <TouchableOpacity
              style={styles.receiptBtn}
              onPress={() => { setReceiptUri(null); setShowReceipt(false); }}
            >
              <Text style={[styles.receiptBtnText, { color: colors.negative }]}>Ta bort</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.receiptBtn}
              onPress={() => setShowReceipt(false)}
            >
              <Text style={styles.receiptBtnText}>Stäng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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

  amountWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.base,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  amountInput: {
    fontSize: 80,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -3,
    minWidth: 80,
    textAlign: 'right',
    padding: 0,
  },
  currency: { fontSize: typography['2xl'], fontWeight: '600', color: colors.textSecondary, paddingBottom: 14 },

  previewRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.base,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  previewItem: { flex: 1, alignItems: 'center', gap: 2 },
  previewDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  previewLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  previewValue: { fontSize: typography.md, fontWeight: '700', color: colors.textPrimary },

  metaRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.base },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  metaIcon: { fontSize: 14 },
  metaText: { fontSize: typography.xs, color: colors.textPrimary, fontWeight: '500' },

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

  // Date picker (iOS sheet)
  dateBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  dateSheet: { backgroundColor: colors.surface, paddingBottom: 30 },
  dateSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.border,
  },

  // Receipt preview
  receiptBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  receiptImg: { width: '90%', height: '70%' },
  receiptActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg },
  receiptBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  receiptBtnText: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
});
