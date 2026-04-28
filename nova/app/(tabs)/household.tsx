import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
  Pressable, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useExpenses, useBalance } from '@/hooks/useExpenses';
import { useSavingsGoals, useCreateSavingsGoal, useAddToSavingsGoal, useDeleteSavingsGoal, SavingsGoal } from '@/hooks/useSavingsGoals';
import { useRecurringExpenses, useCreateRecurringExpense, useDeleteRecurringExpense } from '@/hooks/useRecurringExpenses';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { supabase } from '@/lib/supabase';
import { colors, typography, spacing, radius } from '@/constants/theme';

const FULL  = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
const SHORT = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
const WEEK  = ['Mån','Tis','Ons','Tor','Fre','Lör','Sön'];

function fmt(n: number) {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}
function initials(name?: string | null) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}
function relTime(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m sedan`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h sedan`;
  if (h < 48) return 'igår';
  return `${Math.floor(h / 24)}d sedan`;
}
function nextDue(day: number) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), today.getMonth(), day);
  if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, day);
  const diff = Math.round((next.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Idag';
  if (diff === 1) return 'Imorgon';
  if (diff <= 7) return `Om ${diff} dagar`;
  return `${next.getDate()} ${SHORT[next.getMonth()]}`;
}
function monthAt(baseYear: number, baseMonth: number, offset: number) {
  let m = baseMonth - offset, y = baseYear;
  while (m < 0) { m += 12; y -= 1; }
  return { year: y, month: m };
}

// ── Kalender ──────────────────────────────────────────────────────────────────

function Calendar({ year, month, expensesByDay, selectedDay, onSelectDay }: {
  year: number; month: number; expensesByDay: Map<number, number>;
  selectedDay: number | null; onSelectDay: (d: number) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={cal.wrap}>
      <View style={cal.headerRow}>
        {WEEK.map(d => <View key={d} style={cal.headerCell}><Text style={cal.headerTxt}>{d}</Text></View>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={cal.row}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={cal.cell} />;
            const hasExp = expensesByDay.has(day);
            const isSel = day === selectedDay;
            const isToday = isCurrentMonth && day === today.getDate();
            return (
              <TouchableOpacity key={col} style={[cal.cell, isSel && cal.cellSel]}
                onPress={() => onSelectDay(day === selectedDay ? -1 : day)} activeOpacity={0.7}>
                <Text style={[cal.dayTxt, isToday && cal.dayToday, isSel && cal.daySelTxt]}>{day}</Text>
                {hasExp && <View style={[cal.dot, isSel && cal.dotSel]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Sparmål-kort ──────────────────────────────────────────────────────────────

function GoalCard({ goal, onAdd, onDelete }: { goal: SavingsGoal; onAdd: () => void; onDelete: () => void }) {
  const [exp, setExp] = useState(false);
  const pct = Math.min(goal.current_amount / goal.target_amount, 1);
  const done = pct >= 1;
  return (
    <TouchableOpacity style={g.card} onPress={() => setExp(e => !e)} activeOpacity={0.85}>
      <View style={g.top}>
        <Text style={g.emoji}>{goal.emoji}</Text>
        <View style={g.mid}>
          <Text style={g.title} numberOfLines={1}>{goal.title}</Text>
          {goal.deadline && <Text style={g.sub}>Mål: {new Date(goal.deadline).getDate()} {SHORT[new Date(goal.deadline).getMonth()]}</Text>}
        </View>
        {done
          ? <View style={g.donePill}><Text style={g.doneTxt}>✓ Klart!</Text></View>
          : <Text style={g.pct}>{Math.round(pct * 100)}%</Text>}
      </View>
      <View style={g.barTrack}>
        <View style={[g.barFill, { width: `${pct * 100}%` as any, backgroundColor: done ? colors.positive : colors.accentFrom }]} />
      </View>
      <View style={g.amtRow}>
        <Text style={g.amtCur}>{fmt(goal.current_amount)}</Text>
        <Text style={g.amtOf}>av {fmt(goal.target_amount)}</Text>
      </View>
      {exp && (
        <View style={g.actions}>
          <TouchableOpacity style={g.addBtn} onPress={onAdd} activeOpacity={0.8}>
            <Text style={g.addBtnTxt}>+ Lägg till pengar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={g.delBtn} onPress={onDelete} activeOpacity={0.8}>
            <Text style={g.delBtnTxt}>Ta bort</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Modaler ───────────────────────────────────────────────────────────────────

const EMOJIS = ['🎯','✈️','🏠','🚗','👶','🏖️','💍','🎓','🛋️','💻','🐾','🎸'];

function NewGoalModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const create = useCreateSavingsGoal();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');

  async function submit() {
    const t = parseFloat(target.replace(',', '.'));
    if (!title.trim() || isNaN(t) || t <= 0) { Alert.alert('Fyll i namn och belopp'); return; }
    await create.mutateAsync({ title: title.trim(), emoji, target_amount: t, deadline: deadline || undefined });
    setTitle(''); setTarget(''); setDeadline(''); setEmoji('🎯');
    onClose();
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mo.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mo.sheet}>
        <View style={mo.handle} />
        <Text style={mo.title}>Nytt sparmål</Text>
        <Text style={mo.label}>Emoji</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          {EMOJIS.map(e => (
            <TouchableOpacity key={e} style={[mo.emojiBtn, emoji === e && mo.emojiBtnOn]} onPress={() => setEmoji(e)} activeOpacity={0.7}>
              <Text style={mo.emojiTxt}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={mo.label}>Namn</Text>
        <TextInput style={mo.input} placeholder="t.ex. Resa till Japan" placeholderTextColor={colors.textDisabled} value={title} onChangeText={setTitle} />
        <Text style={mo.label}>Sparmål (kr)</Text>
        <TextInput style={mo.input} placeholder="t.ex. 15000" placeholderTextColor={colors.textDisabled} keyboardType="numeric" value={target} onChangeText={setTarget} />
        <Text style={mo.label}>Deadline (valfri, ÅÅÅÅ-MM-DD)</Text>
        <TextInput style={mo.input} placeholder="t.ex. 2026-12-01" placeholderTextColor={colors.textDisabled} value={deadline} onChangeText={setDeadline} />
        <TouchableOpacity style={mo.saveBtn} onPress={submit} activeOpacity={0.85} disabled={create.isPending}>
          <Text style={mo.saveTxt}>{create.isPending ? 'Sparar…' : 'Skapa mål'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddMoneyModal({ goal, onClose }: { goal: SavingsGoal | null; onClose: () => void }) {
  const addTo = useAddToSavingsGoal();
  const [amount, setAmount] = useState('');
  async function submit() {
    const a = parseFloat(amount.replace(',', '.'));
    if (!goal || isNaN(a) || a <= 0) { Alert.alert('Ange ett belopp'); return; }
    await addTo.mutateAsync({ id: goal.id, amount: a, current: goal.current_amount });
    setAmount(''); onClose();
  }
  return (
    <Modal visible={!!goal} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mo.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mo.sheet}>
        <View style={mo.handle} />
        <Text style={mo.title}>{goal?.emoji} {goal?.title}</Text>
        <Text style={mo.sub}>{fmt(goal?.current_amount ?? 0)} av {fmt(goal?.target_amount ?? 0)}</Text>
        <Text style={mo.label}>Hur mycket sparar ni nu?</Text>
        <TextInput style={mo.input} placeholder="t.ex. 500" placeholderTextColor={colors.textDisabled} keyboardType="numeric" value={amount} onChangeText={setAmount} autoFocus />
        <TouchableOpacity style={mo.saveBtn} onPress={submit} activeOpacity={0.85} disabled={addTo.isPending}>
          <Text style={mo.saveTxt}>{addTo.isPending ? 'Sparar…' : 'Lägg till'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddRecurringModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const create = useCreateRecurringExpense();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');

  async function submit() {
    const a = parseFloat(amount.replace(',', '.'));
    const d = parseInt(day, 10);
    if (!title.trim() || isNaN(a) || a <= 0 || isNaN(d) || d < 1 || d > 31) {
      Alert.alert('Fyll i alla fält korrekt'); return;
    }
    await create.mutateAsync({ title: title.trim(), amount: a, day_of_month: d });
    setTitle(''); setAmount(''); setDay('1');
    onClose();
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mo.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mo.sheet}>
        <View style={mo.handle} />
        <Text style={mo.title}>Återkommande utgift</Text>
        <Text style={mo.label}>Namn</Text>
        <TextInput style={mo.input} placeholder="t.ex. Hyra, El, Netflix" placeholderTextColor={colors.textDisabled} value={title} onChangeText={setTitle} />
        <Text style={mo.label}>Belopp per månad (kr)</Text>
        <TextInput style={mo.input} placeholder="t.ex. 7500" placeholderTextColor={colors.textDisabled} keyboardType="numeric" value={amount} onChangeText={setAmount} />
        <Text style={mo.label}>Förfaller dag i månaden</Text>
        <TextInput style={mo.input} placeholder="t.ex. 1" placeholderTextColor={colors.textDisabled} keyboardType="numeric" value={day} onChangeText={setDay} />
        <TouchableOpacity style={mo.saveBtn} onPress={submit} activeOpacity={0.85} disabled={create.isPending}>
          <Text style={mo.saveTxt}>{create.isPending ? 'Sparar…' : 'Lägg till'}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EditNameModal({ visible, current, onClose, onSave }: {
  visible: boolean; current: string; onClose: () => void; onSave: (n: string) => void;
}) {
  const [name, setName] = useState(current);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mo.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={mo.sheet}>
        <View style={mo.handle} />
        <Text style={mo.title}>Ändra namn</Text>
        <TextInput style={mo.input} value={name} onChangeText={setName} autoFocus
          placeholderTextColor={colors.textDisabled} selectTextOnFocus />
        <TouchableOpacity style={mo.saveBtn} onPress={() => { if (name.trim()) { onSave(name.trim()); onClose(); } }} activeOpacity={0.85}>
          <Text style={mo.saveTxt}>Spara</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Huvud ─────────────────────────────────────────────────────────────────────

export default function HouseholdScreen() {
  const router = useRouter();
  const now = new Date();
  const [calYear, setCalYear]   = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selDay, setSelDay]     = useState<number | null>(null);

  const [showNewGoal, setShowNewGoal]           = useState(false);
  const [addToGoal, setAddToGoal]               = useState<SavingsGoal | null>(null);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [editingName, setEditingName]           = useState(false);

  const { user, profile } = useAuthStore();
  const { household, members, setHousehold } = useHouseholdStore();
  const { data: expenses = [] } = useExpenses();
  const { data: goals = [] }    = useSavingsGoals();
  const { data: recurring = [] } = useRecurringExpenses();
  const { net, partner }        = useBalance();
  const deleteGoal     = useDeleteSavingsGoal();
  const deleteRecurring = useDeleteRecurringExpense();

  const isCurrent = calYear === now.getFullYear() && calMonth === now.getMonth();

  // ── Månadsdata ───────────────────────────────────────────────
  const sharedMonth = useMemo(() =>
    expenses.filter(e => {
      if (!e.is_shared) return false;
      const d = new Date(e.date);
      return d.getFullYear() === calYear && d.getMonth() === calMonth;
    }), [expenses, calYear, calMonth]);

  const prevM = monthAt(calYear, calMonth, 1);
  const sharedPrev = useMemo(() =>
    expenses.filter(e => {
      if (!e.is_shared) return false;
      const d = new Date(e.date);
      return d.getFullYear() === prevM.year && d.getMonth() === prevM.month;
    }), [expenses, prevM.year, prevM.month]);

  const total     = useMemo(() => sharedMonth.reduce((s, e) => s + e.amount, 0), [sharedMonth]);
  const prevTotal = useMemo(() => sharedPrev.reduce((s, e) => s + e.amount, 0), [sharedPrev]);
  const delta     = total - prevTotal;
  const deltaPct  = prevTotal > 0 ? (delta / prevTotal) * 100 : 0;

  // Top 3 kategorier
  const top3 = useMemo(() => {
    const map = new Map<string, { label: string; color: string; total: number }>();
    for (const e of sharedMonth) {
      const key = e.category_id ?? '__none__';
      const ex = map.get(key);
      const label = e.category ? `${e.category.icon} ${e.category.name}` : '📦 Övrigt';
      const color = e.category?.color ?? colors.textSecondary;
      if (ex) ex.total += e.amount;
      else map.set(key, { label, color, total: e.amount });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 3);
  }, [sharedMonth]);
  const top3Max = top3[0]?.total ?? 1;

  // Kalender: utgifter per dag
  const expensesByDay = useMemo(() => {
    const map = new Map<number, number>();
    for (const e of sharedMonth) {
      const day = new Date(e.date).getDate();
      map.set(day, (map.get(day) ?? 0) + e.amount);
    }
    return map;
  }, [sharedMonth]);

  const selectedExpenses = useMemo(() =>
    selDay ? sharedMonth.filter(e => new Date(e.date).getDate() === selDay) : [],
    [sharedMonth, selDay]);

  // Senaste aktivitet (8 senaste delade)
  const recentActivity = useMemo(() =>
    [...expenses]
      .filter(e => e.is_shared)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8),
    [expenses]);

  // Årets siffror
  const yearStats = useMemo(() => {
    const thisYear = now.getFullYear();
    const yearExp = expenses.filter(e => e.is_shared && new Date(e.date).getFullYear() === thisYear);
    const totalYear = yearExp.reduce((s, e) => s + e.amount, 0);
    const monthTotals = new Array(12).fill(0);
    for (const e of yearExp) monthTotals[new Date(e.date).getMonth()] += e.amount;
    const monthsElapsed = now.getMonth() + 1;
    const monthlyAvg = totalYear / Math.max(monthsElapsed, 1);
    const peakIdx = monthTotals.indexOf(Math.max(...monthTotals));
    return { totalYear, monthlyAvg, peakIdx, peakTotal: monthTotals[peakIdx] };
  }, [expenses]);

  const recurringTotal = useMemo(() => recurring.reduce((s, r) => s + r.amount, 0), [recurring]);

  // ── Handlare ────────────────────────────────────────────────
  async function saveName(name: string) {
    if (!household) return;
    await supabase.from('households').update({ name }).eq('id', household.id);
    setHousehold({ ...household, name });
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1);
    setSelDay(null);
  }
  function nextMonth() {
    if (isCurrent) return;
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1);
    setSelDay(null);
  }

  function confirmDeleteGoal(id: string, title: string) {
    Alert.alert('Ta bort mål', `Ta bort "${title}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: () => deleteGoal.mutate(id) },
    ]);
  }
  function confirmDeleteRecurring(id: string, title: string) {
    Alert.alert('Ta bort', `Ta bort "${title}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: () => deleteRecurring.mutate(id) },
    ]);
  }

  const absNet = Math.abs(net);
  const isEven = absNet < 1;
  const iOwe   = net < 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── Rubrik ────────────────────────────────────────── */}
        <Text style={s.heading}>Hushåll</Text>

        {/* ─── 1. Identitet ──────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.identRow}>
            <View style={s.identLeft}>
              <TouchableOpacity onPress={() => setEditingName(true)} activeOpacity={0.7}>
                <Text style={s.householdName}>{household?.name ?? 'Vårt hushåll'}</Text>
                <Text style={s.editHint}>Tryck för att redigera</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.shareBtn} activeOpacity={0.8}
              onPress={() => Share.share({ message: `Gå med i vårt hushåll i Nova med koden: ${household?.invite_code ?? ''}` })}>
              <Text style={s.shareTxt}>🔗 Bjud in</Text>
            </TouchableOpacity>
          </View>
          <View style={s.avatarRow}>
            {members.map(m => (
              <View key={m.user_id} style={s.avatarWrap}>
                <View style={[s.avatar, m.user_id === user?.id && s.avatarMe]}>
                  <Text style={s.avatarTxt}>{initials(m.profile?.display_name)}</Text>
                </View>
                <Text style={s.avatarName} numberOfLines={1}>{m.profile?.display_name?.split(' ')[0] ?? 'Du'}</Text>
              </View>
            ))}
            {members.length < 2 && (
              <TouchableOpacity style={s.avatarWrap} activeOpacity={0.8}
                onPress={() => Share.share({ message: `Gå med i vårt hushåll i Nova med koden: ${household?.invite_code ?? ''}` })}>
                <View style={s.avatarAdd}><Text style={s.avatarAddTxt}>+</Text></View>
                <Text style={s.avatarName}>Bjud in</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── 2. Saldo ──────────────────────────────────────── */}
        <View style={[s.card, s.balanceCard]}>
          {isEven ? (
            <>
              <Text style={s.balanceLbl}>Nuvarande saldo</Text>
              <Text style={s.balanceEven}>🎉 Ni är jämna!</Text>
            </>
          ) : (
            <>
              <Text style={s.balanceLbl}>
                {iOwe ? `Du är skyldig ${partner?.display_name ?? 'din sambo'}` : `${partner?.display_name ?? 'Din sambo'} är skyldig dig`}
              </Text>
              <Text style={[s.balanceAmt, { color: iOwe ? colors.negative : colors.positive }]}>
                {fmt(absNet)}
              </Text>
              <TouchableOpacity style={s.settleBtn} onPress={() => router.push('/settle')} activeOpacity={0.85}>
                <Text style={s.settleTxt}>Gör upp →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ─── 3. Snabbåtgärder ──────────────────────────────── */}
        <View style={s.quickActions}>
          {[
            { icon: '＋', label: 'Lägg till', onPress: () => router.push('/add-expense') },
            { icon: '🎯', label: 'Sparmål', onPress: () => setShowNewGoal(true) },
            { icon: '📅', label: 'Kalender', onPress: () => {} },
            { icon: '📊', label: 'Statistik', onPress: () => router.push('/(tabs)/stats') },
          ].map(a => (
            <TouchableOpacity key={a.label} style={s.qaBtn} onPress={a.onPress} activeOpacity={0.75}>
              <View style={s.qaIcon}><Text style={s.qaIconTxt}>{a.icon}</Text></View>
              <Text style={s.qaLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── 4. Denna månad ────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.monthHeader}>
            <View>
              <Text style={s.cardLabel}>{FULL[calMonth].toUpperCase()} {calYear}</Text>
              <Text style={s.monthTotal}>{fmt(total)}</Text>
            </View>
            {prevTotal > 0 && (
              <View style={[s.pill, delta >= 0 ? s.pillUp : s.pillDown]}>
                <Text style={[s.pillTxt, { color: delta >= 0 ? colors.negative : colors.positive }]}>
                  {delta >= 0 ? '↑' : '↓'} {Math.abs(Math.round(deltaPct))}% vs {SHORT[prevM.month]}
                </Text>
              </View>
            )}
          </View>
          {top3.length > 0 ? top3.map((cat, i) => (
            <View key={i} style={s.catRow}>
              <Text style={s.catLbl} numberOfLines={1}>{cat.label}</Text>
              <View style={s.catTrack}>
                <View style={[s.catFill, { width: `${(cat.total / top3Max) * 100}%` as any, backgroundColor: cat.color }]} />
              </View>
              <Text style={s.catAmt}>{fmt(cat.total)}</Text>
            </View>
          )) : (
            <Text style={s.emptyTxt}>Inga delade utgifter denna månad</Text>
          )}
        </View>

        {/* ─── 5. Senaste aktivitet ──────────────────────────── */}
        {recentActivity.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Senaste aktivitet</Text>
            {recentActivity.map((e, i) => {
              const payer = members.find(m => m.user_id === e.paid_by)?.profile;
              const isMe = e.paid_by === user?.id;
              return (
                <View key={e.id} style={[s.feedRow, i < recentActivity.length - 1 && s.feedBorder]}>
                  <View style={[s.feedAvatar, isMe && s.feedAvatarMe]}>
                    <Text style={s.feedAvatarTxt}>{initials(payer?.display_name)}</Text>
                  </View>
                  <View style={s.feedMid}>
                    <Text style={s.feedName}>{isMe ? 'Du' : (payer?.display_name?.split(' ')[0] ?? 'Sambo')}</Text>
                    <Text style={s.feedDesc} numberOfLines={1}>
                      {e.description || e.category?.name || 'Utgift'}
                      {e.category && e.description ? ` · ${e.category.name}` : ''}
                    </Text>
                  </View>
                  <View style={s.feedRight}>
                    <Text style={s.feedAmt}>{fmt(e.amount)}</Text>
                    <Text style={s.feedTime}>{relTime(e.created_at)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ─── 6. Sparmål ────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.cardTitle}>Sparmål</Text>
          <TouchableOpacity style={s.sectionBtn} onPress={() => setShowNewGoal(true)} activeOpacity={0.8}>
            <Text style={s.sectionBtnTxt}>+ Nytt</Text>
          </TouchableOpacity>
        </View>
        {goals.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🎯</Text>
            <Text style={s.emptyTitle}>Inga sparmål</Text>
            <Text style={s.emptySubTxt}>Sätt upp ett gemensamt mål – resa, barn, renovering...</Text>
          </View>
        ) : goals.map(goal => (
          <GoalCard key={goal.id} goal={goal}
            onAdd={() => setAddToGoal(goal)}
            onDelete={() => confirmDeleteGoal(goal.id, goal.title)}
          />
        ))}

        {/* ─── 7. Återkommande utgifter ──────────────────────── */}
        <View style={s.sectionHeader}>
          <View>
            <Text style={s.cardTitle}>Återkommande</Text>
            {recurringTotal > 0 && <Text style={s.recurringTotal}>{fmt(recurringTotal)}/mån</Text>}
          </View>
          <TouchableOpacity style={s.sectionBtn} onPress={() => setShowAddRecurring(true)} activeOpacity={0.8}>
            <Text style={s.sectionBtnTxt}>+ Lägg till</Text>
          </TouchableOpacity>
        </View>
        {recurring.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🔁</Text>
            <Text style={s.emptyTitle}>Inga fasta utgifter</Text>
            <Text style={s.emptySubTxt}>Lägg till hyra, el, internet och prenumerationer.</Text>
          </View>
        ) : (
          <View style={s.card}>
            {recurring.map((r, i) => (
              <TouchableOpacity key={r.id} style={[s.recurRow, i < recurring.length - 1 && s.feedBorder]}
                onLongPress={() => confirmDeleteRecurring(r.id, r.title)} activeOpacity={0.8}>
                <View style={s.recurLeft}>
                  <Text style={s.recurIcon}>{r.category?.icon ?? '🔁'}</Text>
                  <View>
                    <Text style={s.recurTitle}>{r.title}</Text>
                    <Text style={s.recurDue}>{nextDue(r.day_of_month)}</Text>
                  </View>
                </View>
                <Text style={s.recurAmt}>{fmt(r.amount)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── 8. Årets siffror ──────────────────────────────── */}
        {yearStats.totalYear > 0 && (
          <>
            <Text style={s.cardTitle}>Årets siffror</Text>
            <View style={s.yearRow}>
              <View style={s.yearCard}>
                <Text style={s.yearLbl}>Totalt {now.getFullYear()}</Text>
                <Text style={s.yearVal}>{fmt(Math.round(yearStats.totalYear))}</Text>
              </View>
              <View style={s.yearCard}>
                <Text style={s.yearLbl}>Snitt/månad</Text>
                <Text style={s.yearVal}>{fmt(Math.round(yearStats.monthlyAvg))}</Text>
              </View>
              <View style={s.yearCard}>
                <Text style={s.yearLbl}>Dyraste</Text>
                <Text style={s.yearVal} numberOfLines={1}>{SHORT[yearStats.peakIdx]}</Text>
                <Text style={s.yearSub}>{fmt(Math.round(yearStats.peakTotal))}</Text>
              </View>
            </View>
          </>
        )}

        {/* ─── 9. Kalender ───────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.cardTitle}>Kalender</Text>
          <View style={s.calNav}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}>
              <Text style={s.calArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={s.calLabel}>{SHORT[calMonth]} {calYear}</Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }} disabled={isCurrent}>
              <Text style={[s.calArrow, isCurrent && s.calArrowOff]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Calendar year={calYear} month={calMonth} expensesByDay={expensesByDay}
          selectedDay={selDay} onSelectDay={d => setSelDay(d === -1 ? null : d)} />
        {selDay !== null && (
          <View style={s.dayPanel}>
            <Text style={s.dayTitle}>{selDay} {SHORT[calMonth]}</Text>
            {selectedExpenses.length === 0 ? (
              <Text style={s.emptyTxt}>Inga gemensamma utgifter denna dag</Text>
            ) : selectedExpenses.map(e => (
              <View key={e.id} style={s.expRow}>
                <View style={s.expLeft}>
                  <Text style={s.expIcon}>{e.category?.icon ?? '📦'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.expDesc} numberOfLines={1}>{e.description || e.category?.name || 'Utgift'}</Text>
                    <Text style={s.expCat}>{e.category?.name ?? 'Övrigt'}</Text>
                  </View>
                </View>
                <Text style={s.expAmt}>{fmt(e.amount)}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      <NewGoalModal visible={showNewGoal} onClose={() => setShowNewGoal(false)} />
      <AddMoneyModal goal={addToGoal} onClose={() => setAddToGoal(null)} />
      <AddRecurringModal visible={showAddRecurring} onClose={() => setShowAddRecurring(false)} />
      <EditNameModal visible={editingName} current={household?.name ?? ''} onClose={() => setEditingName(false)} onSave={saveName} />
    </SafeAreaView>
  );
}

// ── Stilar ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { paddingHorizontal: spacing.base, paddingBottom: 110, gap: spacing.lg },
  heading: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5, paddingTop: spacing.base },

  card:      { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.base, gap: spacing.md },
  cardTitle: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },
  cardLabel: { fontSize: typography.xs, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  emptyTxt:  { fontSize: typography.sm, color: colors.textDisabled, paddingVertical: spacing.xs },

  // Identitet
  identRow:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  identLeft:  { flex: 1 },
  householdName: { fontSize: typography.xl, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 },
  editHint:   { fontSize: typography.xs, color: colors.textDisabled, marginTop: 2 },
  shareBtn:   { backgroundColor: colors.accentFrom + '15', borderRadius: radius.full, paddingHorizontal: spacing.base, paddingVertical: 7, borderWidth: 1, borderColor: colors.accentFrom + '40' },
  shareTxt:   { fontSize: typography.xs, fontWeight: '600', color: colors.accentFrom },
  avatarRow:  { flexDirection: 'row', gap: spacing.base },
  avatarWrap: { alignItems: 'center', gap: 6 },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  avatarMe:   { borderColor: colors.accentFrom },
  avatarTxt:  { fontSize: typography.sm, fontWeight: '700', color: colors.textPrimary },
  avatarAdd:  { width: 44, height: 44, borderRadius: 22, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  avatarAddTxt: { fontSize: 20, color: colors.textSecondary },
  avatarName: { fontSize: typography.xs, color: colors.textSecondary, maxWidth: 52, textAlign: 'center' },

  // Saldo
  balanceCard: { gap: spacing.sm },
  balanceLbl:  { fontSize: typography.xs, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  balanceAmt:  { fontSize: 44, fontWeight: '700', letterSpacing: -1.5 },
  balanceEven: { fontSize: typography.xl, fontWeight: '700', color: colors.positive },
  settleBtn:   { backgroundColor: colors.accentFrom, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  settleTxt:   { fontSize: typography.base, fontWeight: '700', color: '#fff' },

  // Snabbåtgärder
  quickActions: { flexDirection: 'row', justifyContent: 'space-between' },
  qaBtn:    { alignItems: 'center', gap: 8, flex: 1 },
  qaIcon:   { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qaIconTxt: { fontSize: 20 },
  qaLabel:  { fontSize: typography.xs, color: colors.textSecondary, fontWeight: '500' },

  // Denna månad
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  monthTotal:  { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -1, marginTop: 4 },
  pill:     { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1, marginTop: 4 },
  pillUp:   { borderColor: colors.negative + '50', backgroundColor: colors.negative + '15' },
  pillDown: { borderColor: colors.positive + '50', backgroundColor: colors.positive + '15' },
  pillTxt:  { fontSize: typography.xs, fontWeight: '600' },
  catRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catLbl:   { fontSize: typography.sm, color: colors.textPrimary, width: 120 },
  catTrack: { flex: 1, height: 5, backgroundColor: colors.surfaceRaised, borderRadius: 3, overflow: 'hidden' },
  catFill:  { height: '100%', borderRadius: 3 },
  catAmt:   { fontSize: typography.sm, color: colors.textSecondary, width: 72, textAlign: 'right' },

  // Aktivitetsflöde
  feedRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  feedBorder:   { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  feedAvatar:   { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  feedAvatarMe: { backgroundColor: colors.accentFrom + '30' },
  feedAvatarTxt: { fontSize: 11, fontWeight: '700', color: colors.textPrimary },
  feedMid:      { flex: 1 },
  feedName:     { fontSize: typography.sm, fontWeight: '600', color: colors.textPrimary },
  feedDesc:     { fontSize: typography.xs, color: colors.textSecondary },
  feedRight:    { alignItems: 'flex-end', gap: 2 },
  feedAmt:      { fontSize: typography.sm, fontWeight: '700', color: colors.textPrimary },
  feedTime:     { fontSize: 10, color: colors.textDisabled },

  // Sektionsrubriker
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionBtn:    { backgroundColor: colors.accentFrom + '15', borderRadius: radius.full, paddingHorizontal: spacing.base, paddingVertical: 6, borderWidth: 1, borderColor: colors.accentFrom + '40' },
  sectionBtnTxt: { fontSize: typography.xs, fontWeight: '600', color: colors.accentFrom },

  // Tom-state
  emptyBox:    { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyIcon:   { fontSize: 32 },
  emptyTitle:  { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  emptySubTxt: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Återkommande
  recurringTotal: { fontSize: typography.sm, color: colors.accentFrom, fontWeight: '600', marginTop: 2 },
  recurRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  recurLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recurIcon:  { fontSize: 22 },
  recurTitle: { fontSize: typography.sm, fontWeight: '600', color: colors.textPrimary },
  recurDue:   { fontSize: typography.xs, color: colors.textSecondary },
  recurAmt:   { fontSize: typography.sm, fontWeight: '700', color: colors.textPrimary },

  // Årets siffror
  yearRow:  { flexDirection: 'row', gap: spacing.sm },
  yearCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, gap: 4 },
  yearLbl:  { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  yearVal:  { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3 },
  yearSub:  { fontSize: 10, color: colors.textDisabled },

  // Kalender
  calNav:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  calArrow:   { fontSize: 24, color: colors.textPrimary, lineHeight: 28 },
  calArrowOff: { opacity: 0.2 },
  calLabel:   { fontSize: typography.sm, fontWeight: '600', color: colors.textPrimary },

  // Valda dagen
  dayPanel: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.base, gap: spacing.sm },
  dayTitle: { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },
  expRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  expLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  expIcon:  { fontSize: 20 },
  expDesc:  { fontSize: typography.sm, fontWeight: '600', color: colors.textPrimary },
  expCat:   { fontSize: typography.xs, color: colors.textSecondary },
  expAmt:   { fontSize: typography.sm, fontWeight: '700', color: colors.textPrimary },
});

const cal = StyleSheet.create({
  wrap:       { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, overflow: 'hidden' },
  headerRow:  { flexDirection: 'row', marginBottom: 4 },
  headerCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  headerTxt:  { fontSize: 11, fontWeight: '600', color: colors.textDisabled, textTransform: 'uppercase' },
  row:        { flexDirection: 'row' },
  cell:       { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  cellSel:    { backgroundColor: colors.accentFrom, borderRadius: radius.md },
  dayTxt:     { fontSize: typography.sm, color: colors.textPrimary },
  dayToday:   { fontWeight: '700', color: colors.accentFrom },
  daySelTxt:  { color: '#fff', fontWeight: '700' },
  dot:        { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accentFrom },
  dotSel:     { backgroundColor: '#fff' },
});

const g = StyleSheet.create({
  card:      { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.base, gap: spacing.sm },
  top:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emoji:     { fontSize: 26 },
  mid:       { flex: 1, gap: 2 },
  title:     { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },
  sub:       { fontSize: typography.xs, color: colors.textSecondary },
  right:     { alignItems: 'flex-end' },
  pct:       { fontSize: typography.lg, fontWeight: '700', color: colors.textPrimary },
  donePill:  { backgroundColor: colors.positive + '20', borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  doneTxt:   { fontSize: typography.xs, fontWeight: '700', color: colors.positive },
  barTrack:  { height: 8, backgroundColor: colors.surfaceRaised, borderRadius: 4, overflow: 'hidden' },
  barFill:   { height: '100%', borderRadius: 4 },
  amtRow:    { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  amtCur:    { fontSize: typography.base, fontWeight: '700', color: colors.textPrimary },
  amtOf:     { fontSize: typography.xs, color: colors.textSecondary },
  actions:   { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderSubtle, marginTop: spacing.xs },
  addBtn:    { flex: 1, backgroundColor: colors.accentFrom, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  addBtnTxt: { fontSize: typography.sm, fontWeight: '700', color: '#fff' },
  delBtn:    { paddingHorizontal: spacing.base, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  delBtnTxt: { fontSize: typography.sm, color: colors.textSecondary },
});

const mo = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:    { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: 40, gap: spacing.md },
  handle:   { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.sm },
  title:    { fontSize: typography.xl, fontWeight: '700', color: colors.textPrimary },
  sub:      { fontSize: typography.sm, color: colors.textSecondary, marginTop: -spacing.sm },
  label:    { fontSize: typography.xs, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  emojiBtn:    { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  emojiBtnOn:  { borderColor: colors.accentFrom, backgroundColor: colors.accentFrom + '20' },
  emojiTxt:    { fontSize: 22 },
  input:    { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.base, paddingVertical: 14, fontSize: typography.base, color: colors.textPrimary },
  saveBtn:  { backgroundColor: colors.accentFrom, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.sm },
  saveTxt:  { fontSize: typography.base, fontWeight: '700', color: '#fff' },
});
