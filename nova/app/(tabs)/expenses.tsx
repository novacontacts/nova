import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Animated, Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useExpenses, useDeleteExpense } from '@/hooks/useExpenses';
import { useAuthStore } from '@/lib/store/auth';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Toast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { Expense } from '@/types';
import { colors, typography, spacing, radius } from '@/constants/theme';

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatAmount(amount: number) {
  return amount.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

function groupByMonth(expenses: Expense[]) {
  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    const d = new Date(e.date + 'T00:00:00');
    const raw = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(e);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

function ExpenseRow({ expense, myId }: { expense: Expense; myId: string }) {
  const isPaidByMe = expense.paid_by === myId;
  const myShare = expense.is_shared
    ? expense.amount * (isPaidByMe ? expense.split_ratio : 1 - expense.split_ratio)
    : expense.amount;

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{expense.category?.icon ?? '📦'}</Text>
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {expense.description || expense.category?.name || 'Utgift'}
        </Text>
        <View style={styles.rowMeta}>
          {expense.is_shared && (
            <View style={styles.sharedBadge}>
              <Text style={styles.sharedText}>Delad</Text>
            </View>
          )}
          {expense.updated_at && (
            <View style={styles.editedBadge}>
              <Text style={styles.editedText}>Ändrad</Text>
            </View>
          )}
          <Text style={styles.rowDate}>{formatDate(expense.date)}</Text>
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, !isPaidByMe && styles.rowAmountOwed]}>
          {isPaidByMe ? '+' : '-'}{formatAmount(expense.is_shared ? myShare : expense.amount)}
        </Text>
        {expense.is_shared && (
          <Text style={styles.rowTotal}>{formatAmount(expense.amount)} totalt</Text>
        )}
      </View>
    </View>
  );
}

function SwipeableRow({
  expense,
  myId,
  onDelete,
  onEdit,
}: {
  expense: Expense;
  myId: string;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        Alert.alert(
          'Radera utgift?',
          'Den här åtgärden kan inte ångras.',
          [
            { text: 'Avbryt', style: 'cancel', onPress: () => swipeRef.current?.close() },
            { text: 'Radera', style: 'destructive', onPress: onDelete },
          ]
        );
      }}
      activeOpacity={0.85}
    >
      <Text style={styles.actionIcon}>🗑</Text>
      <Text style={styles.actionLabel}>Radera</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = () => (
    <TouchableOpacity
      style={styles.editAction}
      onPress={() => {
        swipeRef.current?.close();
        onEdit();
      }}
      activeOpacity={0.85}
    >
      <Text style={styles.actionIcon}>✏️</Text>
      <Text style={styles.actionLabel}>Redigera</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      overshootFriction={8}
      overshootRight={false}
      overshootLeft={false}
    >
      <ExpenseRow expense={expense} myId={myId} />
    </Swipeable>
  );
}

export default function ExpensesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: expenses = [], isLoading, isError, refetch } = useExpenses();
  const deleteExpense = useDeleteExpense();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('expenses-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (payload) => {
        const rec = payload.new as Record<string, unknown>;
        const actor = (rec?.updated_by ?? rec?.paid_by) as string | undefined;
        if (actor && actor !== user.id) {
          setToastMsg('Din sambo lade till eller uppdaterade en utgift');
          setToastVisible(true);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const sections = groupByMonth(expenses);

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.header}>
          <Text style={styles.heading}>Utgifter</Text>
          <TouchableOpacity onPress={() => router.push('/import-csv')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.importLink}>Importera</Text>
          </TouchableOpacity>
        </View>

        {isError ? (
          <ErrorMessage message="Kunde inte hämta utgifter." onRetry={refetch} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(e) => e.id}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            )}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>🧾</Text>
                  <Text style={styles.emptyTitle}>Inga utgifter än</Text>
                  <Text style={styles.emptySub}>Tryck på + för att lägga till din första utgift</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <SwipeableRow
                expense={item}
                myId={user?.id ?? ''}
                onDelete={() => deleteExpense.mutate(item.id)}
                onEdit={() => router.push(`/add-expense?id=${item.id}`)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        )}
      </Animated.View>

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-expense')} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <Toast message={toastMsg} visible={toastVisible} onHide={() => setToastVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.base, paddingTop: spacing.base, paddingBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  heading: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  importLink: { fontSize: typography.sm, fontWeight: '600', color: colors.accentFrom },

  sectionHeader: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  list: { paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22 },
  rowMid: { flex: 1, gap: 3 },
  rowTitle: { fontSize: typography.base, fontWeight: '500', color: colors.textPrimary },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sharedBadge: { backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  sharedText: { fontSize: typography.xs, color: colors.accentFrom, fontWeight: '600' },
  editedBadge: { backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  editedText: { fontSize: typography.xs, color: colors.textDisabled, fontWeight: '500' },
  rowDate: { fontSize: typography.sm, color: colors.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontSize: typography.base, fontWeight: '600', color: colors.positive },
  rowAmountOwed: { color: colors.negative },
  rowTotal: { fontSize: typography.xs, color: colors.textDisabled },
  separator: { height: 1, backgroundColor: colors.borderSubtle, marginLeft: 44 + spacing.base + spacing.md },

  deleteAction: {
    backgroundColor: colors.negative,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  editAction: {
    backgroundColor: colors.accentFrom,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  actionIcon: { fontSize: 20 },
  actionLabel: { fontSize: typography.xs, color: colors.textPrimary, fontWeight: '600', marginTop: 4 },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md, paddingHorizontal: spacing.base },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '600', color: colors.textPrimary },
  emptySub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center' },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accentFrom, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accentFrom, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabIcon: { fontSize: 28, color: colors.textPrimary, lineHeight: 32 },
});
