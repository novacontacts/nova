import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuthStore } from '@/lib/store/auth';
import { Expense } from '@/types';
import { colors, typography, spacing, radius } from '@/constants/theme';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatAmount(amount: number) {
  return amount.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

function ExpenseRow({ expense, myId }: { expense: Expense; myId: string }) {
  const isPaidByMe = expense.paid_by === myId;
  const myShare = expense.is_shared
    ? (isPaidByMe ? expense.amount * expense.split_ratio : expense.amount * (1 - expense.split_ratio))
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

export default function ExpensesScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: expenses = [], isLoading } = useExpenses();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.heading}>Utgifter</Text>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🧾</Text>
              <Text style={styles.emptyTitle}>Inga utgifter än</Text>
              <Text style={styles.emptySub}>Tryck på + för att lägga till din första utgift</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <ExpenseRow expense={item} myId={user?.id ?? ''} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-expense')} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.base, paddingTop: spacing.base, paddingBottom: spacing.sm },
  heading: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },

  list: { paddingHorizontal: spacing.base, paddingBottom: 100 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 22 },
  rowMid: { flex: 1, gap: 3 },
  rowTitle: { fontSize: typography.base, fontWeight: '500', color: colors.textPrimary },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sharedBadge: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  sharedText: { fontSize: typography.xs, color: colors.accentFrom, fontWeight: '600' },
  rowDate: { fontSize: typography.sm, color: colors.textSecondary },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontSize: typography.base, fontWeight: '600', color: colors.positive },
  rowAmountOwed: { color: colors.negative },
  rowTotal: { fontSize: typography.xs, color: colors.textDisabled },

  separator: { height: 1, backgroundColor: colors.borderSubtle },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '600', color: colors.textPrimary },
  emptySub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center' },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accentFrom,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accentFrom, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabIcon: { fontSize: 28, color: colors.textPrimary, lineHeight: 32 },
});
