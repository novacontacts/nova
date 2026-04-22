import { useRef, useMemo } from 'react';
import { Animated, PanResponder, View, Text, StyleSheet, Dimensions } from 'react-native';
import { Expense } from '@/types';
import { colors, typography, spacing, radius, shadows } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing['2xl'] * 2;
const THRESHOLD = SCREEN_WIDTH * 0.32;

type Props = {
  expense: Expense;
  index: number;
  onSwipe: (id: string, direction: 'left' | 'right') => void;
};

function formatAmount(n: number) {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export function SwipeCard({ expense, index, onSwipe }: Props) {
  const position = useRef(new Animated.ValueXY()).current;
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const isTop = index === 0;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isTop,
        onMoveShouldSetPanResponder: () => isTop,
        onPanResponderMove: (_, g) => {
          position.setValue({ x: g.dx, y: g.dy * 0.25 });
        },
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > THRESHOLD) {
            const dir = g.dx > 0 ? 1 : -1;
            Animated.timing(position, {
              toValue: { x: dir * SCREEN_WIDTH * 1.6, y: g.dy * 0.5 },
              duration: 300,
              useNativeDriver: true,
            }).start(() => onSwipeRef.current(expense.id, dir > 0 ? 'right' : 'left'));
          } else {
            Animated.spring(position, {
              toValue: { x: 0, y: 0 },
              useNativeDriver: true,
              damping: 15,
              stiffness: 120,
            }).start();
          }
        },
      }),
    [isTop, expense.id, position],
  );

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-14deg', '0deg', '14deg'],
    extrapolate: 'clamp',
  });

  const leftOpacity = position.x.interpolate({
    inputRange: [-80, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const leftScale = position.x.interpolate({
    inputRange: [-100, 0],
    outputRange: [1, 0.8],
    extrapolate: 'clamp',
  });
  const rightOpacity = position.x.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const rightScale = position.x.interpolate({
    inputRange: [0, 100],
    outputRange: [0.8, 1],
    extrapolate: 'clamp',
  });

  const dynamicCardStyle = isTop
    ? { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }
    : { transform: [{ translateY: -index * 10 }, { scale: 1 - index * 0.04 }] };

  return (
    <Animated.View
      style={[styles.card, dynamicCardStyle as any, { zIndex: 10 - index }]}
      pointerEvents={isTop ? 'auto' : 'none'}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      {/* PRIVAT-stämpel */}
      <Animated.View
        style={[
          styles.stamp,
          styles.stampLeft,
          { opacity: leftOpacity, transform: [{ rotate: '-12deg' }, { scale: leftScale }] },
        ]}
      >
        <Text style={[styles.stampText, { color: colors.negative }]}>PRIVAT</Text>
      </Animated.View>

      {/* DELAD-stämpel */}
      <Animated.View
        style={[
          styles.stamp,
          styles.stampRight,
          { opacity: rightOpacity, transform: [{ rotate: '12deg' }, { scale: rightScale }] },
        ]}
      >
        <Text style={[styles.stampText, { color: colors.positive }]}>DELAD</Text>
      </Animated.View>

      {/* Kortinnehåll */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryIcon}>{expense.category?.icon ?? '📦'}</Text>
        <Text style={styles.categoryName}>{expense.category?.name ?? 'Övrigt'}</Text>
      </View>

      <Text style={styles.amount}>{formatAmount(expense.amount)}</Text>

      {expense.description && (
        <Text style={styles.description} numberOfLines={2}>{expense.description}</Text>
      )}

      <Text style={styles.date}>{formatDate(expense.date)}</Text>

      <View style={styles.hints}>
        <View style={styles.hintItem}>
          <Text style={styles.hintArrow}>←</Text>
          <Text style={[styles.hintText, { color: colors.negative }]}>Privat</Text>
        </View>
        <View style={[styles.hintItem, { flexDirection: 'row-reverse' }]}>
          <Text style={styles.hintArrow}>→</Text>
          <Text style={[styles.hintText, { color: colors.positive }]}>Delad</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },

  stamp: {
    position: 'absolute',
    top: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 2.5,
  },
  stampLeft: {
    left: spacing.lg,
    borderColor: colors.negative,
  },
  stampRight: {
    right: spacing.lg,
    borderColor: colors.positive,
  },
  stampText: {
    fontSize: typography.md,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.lg,
  },
  categoryIcon: { fontSize: 18 },
  categoryName: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },

  amount: {
    fontSize: 52,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -2,
    marginVertical: spacing.sm,
  },
  description: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  date: {
    fontSize: typography.sm,
    color: colors.textDisabled,
  },

  hints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  hintItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  hintArrow: { fontSize: typography.lg, color: colors.textDisabled },
  hintText: { fontSize: typography.sm, fontWeight: '600' },
});
