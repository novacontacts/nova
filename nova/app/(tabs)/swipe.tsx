import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useExpenses, useUpdateExpense } from '@/hooks/useExpenses';
import { useHouseholdStore } from '@/lib/store/household';
import { SwipeCard } from '@/components/expenses/SwipeCard';
import { Expense } from '@/types';
import { colors, typography, spacing, radius } from '@/constants/theme';

type Action = {
  id: string;
  prev: { reviewed: boolean; is_shared: boolean; household_id: string | null };
};

export default function SwipeScreen() {
  const router = useRouter();
  const { household } = useHouseholdStore();
  const { data: allExpenses = [] } = useExpenses();
  const updateExpense = useUpdateExpense();

  const queue = allExpenses.filter((e) => !e.reviewed);

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Action[]>([]);
  const [showUndo, setShowUndo] = useState(false);
  const undoOpacity = useRef(new Animated.Value(0)).current;
  const totalRef = useRef(queue.length);

  // Lås in totalen vid första render så räknaren inte hoppar när vi sweeper
  useEffect(() => {
    if (queue.length > totalRef.current) totalRef.current = queue.length;
  }, [queue.length]);

  const visible = queue.filter((e) => !dismissedIds.has(e.id)).slice(0, 3);
  const pendingCount = queue.length - dismissedIds.size;
  const reviewedNow = totalRef.current - pendingCount;
  const total = totalRef.current;
  const isDone = pendingCount <= 0;

  const handleSwipe = useCallback(async (id: string, direction: 'left' | 'right') => {
    const original = queue.find((e) => e.id === id);
    if (!original) return;

    setDismissedIds((prev) => new Set(prev).add(id));
    setHistory((h) => [
      ...h,
      {
        id,
        prev: {
          reviewed: original.reviewed,
          is_shared: original.is_shared,
          household_id: original.household_id,
        },
      },
    ]);

    // Visa undo i 4 s
    setShowUndo(true);
    Animated.timing(undoOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(undoOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
        .start(() => setShowUndo(false));
    }, 4000);

    const isShared = direction === 'right';
    await updateExpense.mutateAsync({
      id,
      updates: {
        reviewed: true,
        is_shared: isShared,
        household_id: isShared ? (household?.id ?? null) : null,
      },
    });
  }, [household, updateExpense, queue, undoOpacity]);

  const handleUndo = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last) return;

    setHistory((h) => h.slice(0, -1));
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.delete(last.id);
      return next;
    });
    Animated.timing(undoOpacity, { toValue: 0, duration: 150, useNativeDriver: true })
      .start(() => setShowUndo(false));

    await updateExpense.mutateAsync({
      id: last.id,
      updates: {
        reviewed: last.prev.reviewed,
        is_shared: last.prev.is_shared,
        household_id: last.prev.household_id,
      },
    });
  }, [history, updateExpense, undoOpacity]);

  const progressPct = total > 0 ? (reviewedNow / total) * 100 : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.heading}>Sortera</Text>
        {!isDone && total > 0 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>{reviewedNow + 1} av {total}</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      )}

      <View style={styles.content}>
        {isDone ? (
          <DoneState onAdd={() => router.push('/add-expense?quick=true')} reviewed={total} />
        ) : (
          <>
            <Text style={styles.subtitle}>Svep för att klassificera dina utgifter</Text>

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

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnLeft]}
                onPress={() => visible[0] && handleSwipe(visible[0].id, 'left')}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>🔒</Text>
                <Text style={styles.actionBtnText}>Privat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnRight]}
                onPress={() => visible[0] && handleSwipe(visible[0].id, 'right')}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>🤝</Text>
                <Text style={styles.actionBtnText}>Delad</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Undo-toast */}
      {showUndo && (
        <Animated.View style={[styles.undoToast, { opacity: undoOpacity }]}>
          <Text style={styles.undoText}>Sorterad</Text>
          <TouchableOpacity onPress={handleUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.undoBtn}>Ångra</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function DoneState({ onAdd, reviewed }: { onAdd: () => void; reviewed: number }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.done, { opacity, transform: [{ scale }] }]}>
      <View style={styles.doneRing}>
        <Text style={styles.doneIcon}>✓</Text>
      </View>
      <Text style={styles.doneTitle}>Allt klart!</Text>
      <Text style={styles.doneSub}>
        {reviewed > 0
          ? `${reviewed} ${reviewed === 1 ? 'utgift' : 'utgifter'} sorterade`
          : 'Inga fler utgifter att sortera just nu.'}
      </Text>
      <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
        <Text style={styles.addBtnText}>+ Snabb-lägg till utgift</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  heading: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  counter: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterText: { fontSize: typography.sm, fontWeight: '600', color: colors.textPrimary },

  progressTrack: {
    height: 3,
    backgroundColor: colors.surfaceRaised,
    marginHorizontal: spacing.base,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: { height: '100%', backgroundColor: colors.accentFrom },

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
    height: 420,
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
  },
  actionBtnLeft: { borderColor: colors.negative },
  actionBtnRight: { borderColor: colors.positive },
  actionIcon: { fontSize: 18 },
  actionBtnText: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing['2xl'] },
  doneRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderColor: colors.positive,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  doneIcon: { fontSize: 48, color: colors.positive, lineHeight: 56 },
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

  undoToast: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  undoText: { fontSize: typography.sm, color: colors.textSecondary },
  undoBtn: { fontSize: typography.sm, fontWeight: '700', color: colors.accentFrom },
});
