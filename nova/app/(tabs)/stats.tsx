import { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { useStats, StatsFilter } from '@/hooks/useStats';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { colors, typography, spacing, radius } from '@/constants/theme';

const SHORT = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
const FULL  = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
const DAYS  = ['Mån','Tis','Ons','Tor','Fre','Lör','Sön'];
const { width: SW } = Dimensions.get('window');

function fmt(n: number) {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

function monthAt(baseYear: number, baseMonth: number, offset: number) {
  let m = baseMonth - offset, y = baseYear;
  while (m < 0) { m += 12; y -= 1; }
  return { year: y, month: m };
}

// ── Line chart ────────────────────────────────────────────────────────────────

function useDailyCum(year: number, month: number, filter: StatsFilter) {
  const { user } = useAuthStore();
  const { data: expenses = [] } = useExpenses();
  return useMemo(() => {
    const days = new Date(year, month + 1, 0).getDate();
    const b = new Array(days).fill(0) as number[];
    for (const e of expenses) {
      const d = new Date(e.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      if (filter === 'private' && e.is_shared) continue;
      if (filter === 'shared' && !e.is_shared) continue;
      const mine = e.paid_by === user?.id;
      const amt = e.is_shared
        ? e.amount * (mine ? e.split_ratio : 1 - e.split_ratio)
        : mine ? e.amount : 0;
      const idx = d.getDate() - 1;
      if (idx >= 0 && idx < days) b[idx] += amt;
    }
    const cum: number[] = [];
    let acc = 0;
    for (const v of b) { acc += v; cum.push(acc); }
    return { days, cum };
  }, [expenses, year, month, filter, user?.id]);
}

function smooth(pts: { x: number; y: number }[]) {
  if (!pts.length) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], cx = (a.x + b.x) / 2;
    d += ` Q${cx},${a.y} ${cx},${(a.y + b.y) / 2} T${b.x},${b.y}`;
  }
  return d;
}

function LineChart({ year, month, filter }: { year: number; month: number; filter: StatsFilter }) {
  const cur  = useDailyCum(year, month, filter);
  const prev = useDailyCum(year, month === 0 ? 11 : month - 1, filter);

  const W = SW - spacing.base * 4;
  const H = 140, px = 8, py = 12;
  const iW = W - px * 2, iH = H - py * 2;

  const now = new Date();
  const isCur = year === now.getFullYear() && month === now.getMonth();
  const todayIdx = isCur ? now.getDate() - 1 : cur.days - 1;
  const maxVal = Math.max(cur.cum[cur.cum.length - 1] ?? 0, prev.cum[prev.cum.length - 1] ?? 0, 1);

  const curPts = cur.cum.slice(0, todayIdx + 1).map((v, i) => ({
    x: px + (iW * i) / Math.max(cur.days - 1, 1),
    y: py + iH - (iH * v) / maxVal,
  }));
  const prevPts = prev.cum.map((v, i) => ({
    x: px + (iW * i) / Math.max(prev.days - 1, 1),
    y: py + iH - (iH * v) / maxVal,
  }));

  const dayAvg = todayIdx > 0 ? (cur.cum[todayIdx] ?? 0) / (todayIdx + 1) : 0;
  const projected = (cur.cum[todayIdx] ?? 0) + dayAvg * (cur.days - todayIdx - 1);
  const last = curPts[curPts.length - 1];
  const curPath = smooth(curPts);
  const area = curPts.length > 1
    ? `${curPath} L${last.x},${py + iH} L${curPts[0].x},${py + iH} Z` : '';

  return (
    <View style={s.card}>
      <View style={s.chartTop}>
        <View>
          <Text style={s.cardTitle}>Daglig förbrukning</Text>
          <Text style={s.cardSub}>{fmt(cur.cum[todayIdx] ?? 0)} hittills</Text>
        </View>
        {isCur && projected > 0 && todayIdx < cur.days - 1 && (
          <View style={s.forecastPill}>
            <Text style={s.forecastLbl}>Prognos</Text>
            <Text style={s.forecastVal}>{fmt(Math.round(projected))}</Text>
          </View>
        )}
      </View>

      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.accentFrom} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={colors.accentFrom} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[0.33, 0.66].map(p => (
          <Line key={p} x1={px} x2={W - px} y1={py + iH * p} y2={py + iH * p}
            stroke={colors.borderSubtle} strokeWidth={1} />
        ))}
        {prev.cum[prev.cum.length - 1] > 0 && (
          <Path d={smooth(prevPts)} stroke={colors.textDisabled} strokeWidth={1.5}
            strokeDasharray="3,5" fill="none" />
        )}
        {area ? <Path d={area} fill="url(#g)" /> : null}
        {curPath ? <Path d={curPath} stroke={colors.accentFrom} strokeWidth={2.5} fill="none" /> : null}
        {isCur && last && projected > 0 && todayIdx < cur.days - 1 && (
          <Path
            d={`M${last.x},${last.y} L${px + iW},${py + iH - (iH * projected) / maxVal}`}
            stroke={colors.accentFrom} strokeWidth={1.5} strokeDasharray="4,4" fill="none" opacity={0.5}
          />
        )}
        {last && <Circle cx={last.x} cy={last.y} r={4} fill={colors.accentFrom} stroke={colors.bg} strokeWidth={2} />}
      </Svg>

      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.accentFrom }]} />
          <Text style={s.legendTxt}>Denna månad</Text>
        </View>
        <View style={s.legendItem}>
          <View style={s.legendDash} />
          <Text style={s.legendTxt}>{FULL[month === 0 ? 11 : month - 1]}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [filter, setFilter] = useState<StatsFilter>('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { user, profile } = useAuthStore();
  const { members } = useHouseholdStore();
  const { data: expenses = [] } = useExpenses();

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const prevM = monthAt(year, month, 1);
  const { total, byCategory, count, isError, refetch } = useStats(year, month, filter);
  const prev = useStats(prevM.year, prevM.month, filter);

  const delta    = total - prev.total;
  const deltaPct = prev.total > 0 ? (delta / prev.total) * 100 : 0;
  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  const partner = members.find(m => m.user_id !== user?.id)?.profile ?? null;

  // Filtrerade utgifter för vald månad
  const monthExp = useMemo(() => expenses.filter(e => {
    const d = new Date(e.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return false;
    if (filter === 'shared')  return e.is_shared;
    if (filter === 'private') return !e.is_shared;
    return true;
  }), [expenses, year, month, filter]);

  // Vem betalade mest
  const { myPaid, partnerPaid } = useMemo(() => {
    let myPaid = 0, partnerPaid = 0;
    for (const e of monthExp) {
      if (e.paid_by === user?.id) myPaid += e.amount;
      else partnerPaid += e.amount;
    }
    return { myPaid, partnerPaid };
  }, [monthExp, user?.id]);

  const splitTotal = myPaid + partnerPaid;
  const myPct = splitTotal > 0 ? myPaid / splitTotal : 0.5;

  // Störst utgift + snitt per dag
  const biggestExp = useMemo(() =>
    monthExp.reduce<typeof monthExp[0] | null>((best, e) =>
      e.amount > (best?.amount ?? 0) ? e : best, null),
    [monthExp]);

  const daysElapsed = isCurrent
    ? Math.max(now.getDate(), 1)
    : new Date(year, month + 1, 0).getDate();
  const dailyAvg = total / daysElapsed;

  // Veckodagsfördelning
  const weekdayData = useMemo(() => {
    const b = new Array(7).fill(0) as number[];
    for (const e of monthExp) {
      const dow = (new Date(e.date).getDay() + 6) % 7; // mån=0
      const mine = e.paid_by === user?.id;
      const amt = e.is_shared
        ? e.amount * (mine ? e.split_ratio : 1 - e.split_ratio)
        : mine ? e.amount : 0;
      b[dow] += amt;
    }
    return b;
  }, [monthExp, user?.id]);

  const maxDay = Math.max(...weekdayData, 1);
  const peakDayIdx = weekdayData.indexOf(Math.max(...weekdayData));

  // 12 månaders historik
  const history = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const { year: y, month: m } = monthAt(now.getFullYear(), now.getMonth(), 11 - i);
    let t = 0;
    for (const e of expenses) {
      const d = new Date(e.date);
      if (d.getFullYear() !== y || d.getMonth() !== m) continue;
      if (filter === 'shared'  && !e.is_shared) continue;
      if (filter === 'private' && e.is_shared)  continue;
      const mine = e.paid_by === user?.id;
      t += e.is_shared
        ? e.amount * (mine ? e.split_ratio : 1 - e.split_ratio)
        : mine ? e.amount : 0;
    }
    return { year: y, month: m, total: t };
  }), [expenses, filter, user?.id]);

  const maxHist = Math.max(...history.map(h => h.total), 1);

  // Kategoritrender vs förra månaden
  const prevCatMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of prev.byCategory) map.set(s.category?.id ?? 'null', s.total);
    return map;
  }, [prev.byCategory]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (isCurrent) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  if (isError) return (
    <SafeAreaView style={s.safe}>
      <ErrorMessage message="Kunde inte hämta statistik." onRetry={refetch} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <Animated.ScrollView style={{ opacity: fadeAnim }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Rubrik */}
        <Text style={s.heading}>Statistik</Text>

        {/* Månadsnavigering */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
            <Text style={s.arrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.monthLabel}>{FULL[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }} disabled={isCurrent}>
            <Text style={[s.arrow, isCurrent && s.arrowOff]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroLbl}>Total {isCurrent ? 'hittills' : ''}</Text>
          <Text style={s.heroAmt}>{fmt(total)}</Text>
          <View style={s.heroMeta}>
            {prev.total > 0 && (
              <View style={[s.pill, delta >= 0 ? s.pillUp : s.pillDown]}>
                <Text style={[s.pillTxt, { color: delta >= 0 ? colors.negative : colors.positive }]}>
                  {delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(deltaPct))}% vs {SHORT[prevM.month]}
                </Text>
              </View>
            )}
            <Text style={s.countTxt}>{count} utgifter</Text>
          </View>
        </View>

        {/* Filter */}
        <View style={s.filterRow}>
          {(['all', 'private', 'shared'] as StatsFilter[]).map(f => (
            <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterOn]}
              onPress={() => setFilter(f)} activeOpacity={0.7}>
              <Text style={[s.filterTxt, filter === f && s.filterTxtOn]}>
                {f === 'all' ? 'Alla' : f === 'private' ? 'Privat' : 'Delad'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {total > 0 ? (
          <>
            {/* Snabbfakta */}
            <View style={s.quickRow}>
              <View style={s.quickCard}>
                <Text style={s.quickLbl}>Störst utgift</Text>
                <Text style={s.quickVal} numberOfLines={1}>
                  {biggestExp ? fmt(biggestExp.amount) : '–'}
                </Text>
                <Text style={s.quickSub} numberOfLines={1}>
                  {biggestExp?.description || biggestExp?.category?.name || '–'}
                </Text>
              </View>
              <View style={s.quickCard}>
                <Text style={s.quickLbl}>Snitt per dag</Text>
                <Text style={s.quickVal}>{fmt(Math.round(dailyAvg))}</Text>
                <Text style={s.quickSub}>{daysElapsed} dagar</Text>
              </View>
            </View>

            {/* Du vs sambo */}
            {partner && splitTotal > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Vem betalade mest?</Text>
                <View style={s.splitNames}>
                  <Text style={s.splitName}>{profile?.display_name ?? 'Du'}</Text>
                  <Text style={s.splitName}>{partner.display_name ?? 'Sambo'}</Text>
                </View>
                <View style={s.splitTrack}>
                  <View style={[s.splitMy, { flex: Math.max(myPct, 0.04) }]} />
                  <View style={[s.splitPartner, { flex: Math.max(1 - myPct, 0.04) }]} />
                </View>
                <View style={s.splitAmts}>
                  <Text style={s.splitAmt}>{fmt(Math.round(myPaid))}</Text>
                  <Text style={s.splitAmt}>{fmt(Math.round(partnerPaid))}</Text>
                </View>
              </View>
            )}

            {/* Linjegraf */}
            <LineChart year={year} month={month} filter={filter} />

            {/* Per kategori */}
            {byCategory.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Per kategori</Text>
                {byCategory.map((stat, i) => {
                  const prevAmt = prevCatMap.get(stat.category?.id ?? 'null') ?? 0;
                  const diff    = stat.total - prevAmt;
                  const hasTrend = prevAmt > 0;
                  return (
                    <View key={i} style={[s.catRow, i < byCategory.length - 1 && s.catBorder]}>
                      <View style={s.catTop}>
                        <Text style={s.catLbl}>
                          {stat.category ? `${stat.category.icon} ${stat.category.name}` : '📦 Övrigt'}
                        </Text>
                        <View style={s.catRight}>
                          {hasTrend && (
                            <Text style={[s.catTrend, { color: diff > 0 ? colors.negative : colors.positive }]}>
                              {diff > 0 ? '↑' : '↓'}{Math.abs(Math.round((diff / prevAmt) * 100))}%
                            </Text>
                          )}
                          <Text style={s.catAmt}>{fmt(stat.total)}</Text>
                        </View>
                      </View>
                      <View style={s.barTrack}>
                        <View style={[s.barFill, {
                          width: `${Math.max(stat.pct * 100, 2)}%` as any,
                          backgroundColor: stat.category?.color ?? colors.textSecondary,
                        }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Veckodagsanalys */}
            {weekdayData.some(v => v > 0) && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Mest aktiva dag</Text>
                <Text style={s.cardSub}>{DAYS[peakDayIdx]} är er dyraste dag</Text>
                <View style={s.weekRow}>
                  {DAYS.map((d, i) => {
                    const pct = weekdayData[i] / maxDay;
                    const isMax = i === peakDayIdx && weekdayData[i] > 0;
                    return (
                      <View key={d} style={s.weekCol}>
                        <View style={s.weekTrack}>
                          <View style={[s.weekBar, {
                            height: `${Math.max(pct * 100, weekdayData[i] > 0 ? 5 : 0)}%` as any,
                            backgroundColor: isMax ? colors.accentFrom : colors.surfaceRaised,
                          }]} />
                        </View>
                        <Text style={[s.weekLbl, isMax && s.weekLblOn]}>{d}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 12 månader */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Senaste 12 månader</Text>
              <Text style={s.cardSub}>Tryck på en månad för att visa den</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.base }}>
                <View style={s.histRow}>
                  {history.map(({ year: y, month: m, total: t }, i) => {
                    const pct = t / maxHist;
                    const isSel = y === year && m === month;
                    return (
                      <TouchableOpacity key={i} style={s.histCol} onPress={() => { setYear(y); setMonth(m); }} activeOpacity={0.7}>
                        <Text style={s.histAmt}>{t > 500 ? Math.round(t / 1000) + 'k' : ''}</Text>
                        <View style={s.histTrack}>
                          <View style={[s.histBar, {
                            height: `${Math.max(pct * 100, t > 0 ? 4 : 0)}%` as any,
                            backgroundColor: isSel ? colors.accentFrom : colors.border,
                          }]} />
                        </View>
                        <Text style={[s.histLbl, isSel && s.histLblOn]}>{SHORT[m]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </>
        ) : (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>📊</Text>
            <Text style={s.emptyTitle}>Ingen data</Text>
            <Text style={s.emptySub}>Inga utgifter för {FULL[month]}</Text>
          </View>
        )}

      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { paddingHorizontal: spacing.base, paddingBottom: 100, gap: spacing.lg },
  heading: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5, paddingTop: spacing.base },

  monthNav:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow:     { fontSize: 30, color: colors.textPrimary, lineHeight: 36 },
  arrowOff:  { opacity: 0.2 },
  monthLabel: { fontSize: typography.lg, fontWeight: '600', color: colors.textPrimary },

  hero:    { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', gap: spacing.xs },
  heroLbl: { fontSize: typography.xs, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroAmt: { fontSize: 52, fontWeight: '700', color: colors.textPrimary, letterSpacing: -2 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  pill:    { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  pillUp:  { borderColor: colors.negative + '50', backgroundColor: colors.negative + '15' },
  pillDown: { borderColor: colors.positive + '50', backgroundColor: colors.positive + '15' },
  pillTxt: { fontSize: typography.xs, fontWeight: '600' },
  countTxt: { fontSize: typography.xs, color: colors.textDisabled },

  filterRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  filterBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm - 2 },
  filterOn:  { backgroundColor: colors.surfaceRaised },
  filterTxt:   { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },
  filterTxtOn: { color: colors.textPrimary, fontWeight: '600' },

  quickRow:  { flexDirection: 'row', gap: spacing.sm },
  quickCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.base, gap: 4 },
  quickLbl:  { fontSize: typography.xs, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  quickVal:  { fontSize: typography.xl, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  quickSub:  { fontSize: typography.xs, color: colors.textDisabled },

  card:      { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.base, gap: spacing.md },
  cardTitle: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },
  cardSub:   { fontSize: typography.xs, color: colors.textSecondary, marginTop: -spacing.sm },

  chartTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  forecastPill: { backgroundColor: colors.accentFrom + '20', borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 6, alignItems: 'flex-end', borderWidth: 1, borderColor: colors.accentFrom + '40' },
  forecastLbl:  { fontSize: 9, color: colors.accentFrom, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
  forecastVal:  { fontSize: typography.sm, fontWeight: '700', color: colors.accentFrom },
  legendRow:    { flexDirection: 'row', gap: spacing.lg },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendDash:   { width: 14, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textDisabled },
  legendTxt:    { fontSize: typography.xs, color: colors.textSecondary },

  splitNames: { flexDirection: 'row', justifyContent: 'space-between' },
  splitName:  { fontSize: typography.sm, fontWeight: '600', color: colors.textPrimary },
  splitTrack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  splitMy:    { backgroundColor: colors.accentFrom, borderRadius: 5 },
  splitPartner: { backgroundColor: colors.border, borderRadius: 5 },
  splitAmts:  { flexDirection: 'row', justifyContent: 'space-between' },
  splitAmt:   { fontSize: typography.sm, color: colors.textSecondary },

  catRow:    { gap: spacing.xs, paddingBottom: spacing.md },
  catBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  catTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catLbl:    { fontSize: typography.base, color: colors.textPrimary, fontWeight: '500' },
  catRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catTrend:  { fontSize: typography.xs, fontWeight: '600' },
  catAmt:    { fontSize: typography.base, color: colors.textPrimary, fontWeight: '600' },
  barTrack:  { height: 5, backgroundColor: colors.surfaceRaised, borderRadius: 3, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 3 },

  weekRow:   { flexDirection: 'row', height: 90, alignItems: 'flex-end', gap: 6 },
  weekCol:   { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6 },
  weekTrack: { width: '100%', flex: 1, borderRadius: radius.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  weekBar:   { width: '100%', borderRadius: radius.sm },
  weekLbl:   { fontSize: 10, color: colors.textDisabled },
  weekLblOn: { color: colors.accentFrom, fontWeight: '700' },

  histRow:   { flexDirection: 'row', height: 110, alignItems: 'flex-end', paddingHorizontal: spacing.base, gap: 8 },
  histCol:   { width: 44, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 },
  histAmt:   { fontSize: 9, color: colors.textDisabled },
  histTrack: { width: '100%', flex: 1, borderRadius: radius.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  histBar:   { width: '100%', borderRadius: radius.sm },
  histLbl:   { fontSize: 10, color: colors.textSecondary },
  histLblOn: { color: colors.accentFrom, fontWeight: '700' },

  empty:      { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyIcon:  { fontSize: 48 },
  emptyTitle: { fontSize: typography.lg, fontWeight: '600', color: colors.textPrimary },
  emptySub:   { fontSize: typography.base, color: colors.textSecondary },
});
