import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { View as AnimatedView } from 'react-native';
import { useExpenses, useUpdateExpense } from '@/hooks/useExpenses';
import { useHouseholdStore } from '@/lib/store/household';
import { SwipeCard } from '@/components/expenses/SwipeCard';
import { colors, typography, spacing } from '@/constants/theme';

export default function SwipeScreen() {
  const router = useRouter();
  const { household } = useHouseholdStore();
  const { data: allExpenses = [] } = useExpenses();
  const updateExpense = useUpdateExpense();

  // Kön: ogranskade utgifter, nyast sist (vi visar i omvänd ordning)
  const queue = allExpenses.filter((e) => !e.reviewed);

  // Lokalt state för att hantera animerade bort-kort innan React Query hinner uppdatera
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const visible = queue.filter((e) => !dismissedIds.has(e.id)).slice(0, 3);

  const handleSwipe = useCallback(async (id: string, direction: 'left' | 'right') => {
    setDismissedIds((prev) => new Set(prev).add(id));

    const isShared = direction === 'right';
    await updateExpense.mutateAsync({
      id,
      updates: {
        reviewed: true,
        is_shared: isShared,
        household_id: isShared ? (household?.id ?? null) : null,
      },
    });
  }, [household, updateExpense]);

  const pendingCount = queue.length - dismissedIds.size;
  const isDone = pendingCount <= 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.heading}>Sortera</Text>
        {!isDone && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {isDone ? (
          <DoneState onAdd={() => router.push('/add-expense?quick=true')} />
        ) : (
          <>
            <Text style={styles.subtitle}>Svep för att klassificera dina utgifter</Text>

            {/* Kortstack */}
            <View style={styles.stack}>
              {[...visible].reverse().map((expense, i) => (
                <SwipeCard
                  key={expense.id}
                  expense={expense}
                  index={visible.length - 1 - i}
                  onSwipe={handleSwipe}
                />
              ))}
            </View>

            {/* Knapp-alternativ under kortet */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnLeft]}
                onPress={() => visible[0] && handleSwipe(visible[0].id, 'left')}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>← Privat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnRight]}
                onPress={() => visible[0] && handleSwipe(visible[0].id, 'right')}
                activeOpacity={0.8}
              >
                <Text style={styles.actionBtnText}>Delad →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function DoneState({ onAdd }: { onAdd: () => void }) {
  return (
    <AnimatedView style={styles.done}>
      <Text style={styles.doneIcon}>✅</Text>
      <Text style={styles.doneTitle}>Allt klart!</Text>
      <Text style={styles.doneSub}>Inga fler utgifter att sortera just nu.</Text>
      <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
        <Text style={styles.addBtnText}>+ Snabb-lägg till utgift</Text>
      </TouchableOpacity>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  heading: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  badge: {
    backgroundColor: colors.accentFrom,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { fontSize: typography.xs, fontWeight: '700', color: colors.textPrimary },

  content: { flex: 1, alignItems: 'center', paddingBottom: 100 },
  subtitle: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing['3xl'],
  },

  stack: {
    width: '100%',
    alignItems: 'center',
    height: 380,
    justifyContent: 'center',
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  actionBtnLeft: { borderColor: colors.negative },
  actionBtnRight: { borderColor: colors.positive },
  actionBtnText: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing['2xl'] },
  doneIcon: { fontSize: 64 },
  doneTitle: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary },
  doneSub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center' },
  addBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtnText: { fontSize: typography.base, fontWeight: '600', color: colors.accentFrom },
});
