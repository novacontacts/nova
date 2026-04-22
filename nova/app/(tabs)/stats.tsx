import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStats, StatsFilter } from '@/hooks/useStats';
import { colors, typography, spacing, radius } from '@/constants/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const MONTH_FULL = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

function formatAmount(n: number) {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

export default function StatsScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [filter, setFilter] = useState<StatsFilter>('all');

  const { total, byCategory, count } = useStats(year, month, filter);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    if (isCurrentMonth) return;
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.heading}>Statistik</Text>
        </View>

        {/* Månadsväljare */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
            <Text style={styles.monthArrowText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTH_FULL[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}>
            <Text style={[styles.monthArrowText, isCurrentMonth && styles.monthArrowTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Filter: Alla / Privat / Delad */}
        <View style={styles.filterRow}>
          {(['all', 'private', 'shared'] as StatsFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? 'Alla' : f === 'private' ? 'Privat' : 'Delad'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Totalkort */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total spending — {MONTHS[month]}</Text>
          <Text style={styles.totalAmount}>{formatAmount(total)}</Text>
          <Text style={styles.totalCount}>{count} utgifter</Text>
        </View>

        {/* Kategoriuppdelning */}
        {byCategory.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Ingen data</Text>
            <Text style={styles.emptySub}>Inga utgifter registrerade för {MONTHS[month]}</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Per kategori</Text>
            {byCategory.map((stat, i) => {
              const barColor = stat.category?.color ?? colors.textSecondary;
              const label = stat.category ? `${stat.category.icon} ${stat.category.name}` : '📦 Övrigt';
              return (
                <View key={i} style={styles.catRow}>
                  <View style={styles.catMeta}>
                    <Text style={styles.catLabel}>{label}</Text>
                    <Text style={styles.catAmount}>{formatAmount(stat.total)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.max(stat.pct * 100, 2)}%` as any, backgroundColor: barColor }]} />
                  </View>
                  <Text style={styles.catPct}>{Math.round(stat.pct * 100)}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Månadsöversikt (senaste 4 månader) */}
        <MonthCompare currentYear={year} currentMonth={month} />

      </ScrollView>
    </SafeAreaView>
  );
}

function MonthCompare({ currentYear, currentMonth }: { currentYear: number; currentMonth: number }) {
  // Bygg 4 månader bakåt från vald månad
  const months = Array.from({ length: 4 }, (_, i) => {
    let m = currentMonth - i;
    let y = currentYear;
    while (m < 0) { m += 12; y -= 1; }
    return { year: y, month: m };
  }).reverse();

  const stats = months.map((p) => useStats(p.year, p.month));
  const maxTotal = Math.max(...stats.map((s) => s.total), 1);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Senaste 4 månader</Text>
      <View style={styles.compareRow}>
        {months.map((p, i) => {
          const { total } = stats[i];
          const heightPct = total / maxTotal;
          const isSelected = p.year === currentYear && p.month === currentMonth;
          return (
            <View key={i} style={styles.compareCol}>
              <Text style={styles.compareAmount}>{total > 0 ? Math.round(total / 1000) + 'k' : ''}</Text>
              <View style={styles.compareBarTrack}>
                <View style={[
                  styles.compareBarFill,
                  { height: `${Math.max(heightPct * 100, total > 0 ? 4 : 0)}%` as any },
                  isSelected && styles.compareBarSelected,
                ]} />
              </View>
              <Text style={[styles.compareMonth, isSelected && styles.compareMonthSelected]}>
                {MONTHS[p.month]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingBottom: 100, gap: spacing.lg },

  header: { paddingTop: spacing.base },
  heading: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthArrow: { padding: spacing.sm },
  monthArrowDisabled: { opacity: 0.2 },
  monthArrowText: { fontSize: 28, color: colors.textPrimary, lineHeight: 32 },
  monthArrowTextDisabled: { color: colors.textDisabled },
  monthLabel: { fontSize: typography.lg, fontWeight: '600', color: colors.textPrimary },

  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm - 2 },
  filterBtnActive: { backgroundColor: colors.surfaceRaised },
  filterText: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: colors.textPrimary, fontWeight: '600' },

  totalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalLabel: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },
  totalAmount: { fontSize: typography['3xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -1 },
  totalCount: { fontSize: typography.xs, color: colors.textDisabled },

  empty: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '600', color: colors.textPrimary },
  emptySub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center' },

  section: { gap: spacing.md },
  sectionTitle: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  catRow: { gap: spacing.sm },
  catMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLabel: { fontSize: typography.base, color: colors.textPrimary, fontWeight: '500' },
  catAmount: { fontSize: typography.base, color: colors.textPrimary, fontWeight: '600' },
  barTrack: { height: 6, backgroundColor: colors.surfaceRaised, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  catPct: { fontSize: typography.xs, color: colors.textDisabled, alignSelf: 'flex-end' },

  compareRow: { flexDirection: 'row', gap: spacing.sm, height: 120, alignItems: 'flex-end' },
  compareCol: { flex: 1, alignItems: 'center', gap: spacing.xs, height: '100%', justifyContent: 'flex-end' },
  compareAmount: { fontSize: 10, color: colors.textDisabled },
  compareBarTrack: { width: '100%', flex: 1, backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  compareBarFill: { width: '100%', backgroundColor: colors.border, borderRadius: radius.sm },
  compareBarSelected: { backgroundColor: colors.accentFrom },
  compareMonth: { fontSize: typography.xs, color: colors.textSecondary },
  compareMonthSelected: { color: colors.accentFrom, fontWeight: '600' },
});
