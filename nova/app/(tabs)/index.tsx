import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { useBalance, useCreateSettlement, useExpenses } from '@/hooks/useExpenses';
import { colors, typography, spacing, radius } from '@/constants/theme';

const SWISH_PINK = '#EE2A7B';

function SettingsIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke={colors.textPrimary}
        strokeWidth={1.5}
      />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={colors.textPrimary}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function SwishGlyph({ size = 18, color = 'white' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 9c1.5-3.5 5-5 8-4s5 4 4 7-4 5-7 4M19 15c-1.5 3.5-5 5-8 4s-5-4-4-7 4-5 7-4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function CheckIcon({ size = 16, color = colors.positive }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12l5 5 11-11" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function AnimatedBalance({ value }: { value: number }) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    animValue.setValue(0);
    Animated.timing(animValue, { toValue: Math.abs(value), duration: 700, useNativeDriver: false }).start();
    const id = animValue.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => animValue.removeListener(id);
  }, [value]);

  return (
    <View style={styles.balanceRow}>
      <Text style={styles.balanceAmount}>
        {display.toLocaleString('sv-SE', { maximumFractionDigits: 0 })}
      </Text>
      <Text style={styles.balanceUnit}>kr</Text>
    </View>
  );
}

function todayLabel() {
  const d = new Date();
  const weekday = d.toLocaleDateString('sv-SE', { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString('sv-SE', { month: 'long' });
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized}, ${day} ${month}`;
}

export default function DashboardScreen() {
  const { profile } = useAuthStore();
  const { household, members } = useHouseholdStore();
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const { net, partner: balancePartner } = useBalance();
  const { data: expenses = [] } = useExpenses();
  const createSettlement = useCreateSettlement();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const partnerMember = members.find((m) => m.user_id !== profile?.id);
  const partnerPhone = partnerMember?.profile?.swish_phone ?? null;

  async function handleRefresh() {
    setRefreshing(true);
    await qc.invalidateQueries();
    setRefreshing(false);
  }

  async function openSwish() {
    if (!partnerPhone) {
      Alert.alert(
        'Swish-nummer saknas',
        `${balancePartner?.display_name ?? 'Din sambo'} har inte lagt till sitt Swish-nummer. Be hen göra det under Inställningar.`,
      );
      return;
    }
    let payee = partnerPhone.trim();
    if (payee.startsWith('+46')) payee = '0' + payee.slice(3);
    else if (payee.startsWith('0046')) payee = '0' + payee.slice(4);
    payee = payee.replace(/\D/g, '');
    const data = {
      version: 1,
      payee: { value: payee, editable: false },
      amount: { value: Math.round(absNet), editable: false },
      message: { value: 'Nova avräkning', editable: true },
    };
    const url = `swish://payment?data=${encodeURIComponent(JSON.stringify(data))}`;
    try {
      await Linking.openURL(url);
      await settleNow();
    } catch {
      Alert.alert('Swish hittades inte', 'Installera Swish-appen från App Store.');
    }
  }

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const otherMembers = members.filter((m) => m.user_id !== profile?.id);
  const isOwing = net < 0;
  const absNet = Math.abs(net);
  const formattedNet = absNet.toLocaleString('sv-SE', { maximumFractionDigits: 0 });
  const balanceLabel = isOwing
    ? `Du är skyldig ${balancePartner?.display_name ?? 'hushållet'}`
    : net > 0
    ? `${balancePartner?.display_name ?? 'Hushållet'} är skyldigt dig`
    : 'Ni är jämna';
  const pct = Math.min(absNet / 5000, 1);
  const barColor = isOwing ? colors.negative : colors.positive;

  const recentExpenses = expenses.slice(0, 4);

  async function copyInviteCode() {
    if (!household?.invite_code) return;
    await Clipboard.setStringAsync(household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function settleNow() {
    if (!profile || !balancePartner) return;
    const fromUser = isOwing ? profile.id : balancePartner.id;
    const toUser   = isOwing ? balancePartner.id : profile.id;
    try {
      await createSettlement.mutateAsync({ amount: absNet, fromUser, toUser });
    } catch (e: any) {
      Alert.alert('Fel', e.message);
    }
  }

  function handleSettle() {
    if (!profile || !balancePartner || absNet < 1) return;
    Alert.alert(
      'Markera som mottaget',
      `Du markerar att du fått ${formattedNet} kr av ${balancePartner.display_name ?? 'din sambo'}.\n\nSaldot nollställs.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Bekräfta', onPress: settleNow },
      ]
    );
  }

  function formatAmount(amount: number) {
    return amount.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textSecondary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.dateLabel}>{todayLabel()}</Text>
            <Text style={styles.greeting}>
              {profile?.display_name ? `God dag, ${profile.display_name}` : 'God dag!'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.settingsBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <SettingsIcon />
          </TouchableOpacity>
        </View>

        {/* Balance section */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>
            {household ? balanceLabel : 'Ditt saldo'}
          </Text>
          <AnimatedBalance value={net} />

          {household && absNet > 0 && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
            </View>
          )}

          <Text style={styles.balanceSub}>
            {household
              ? absNet < 1 ? 'Avräknat — alla kvitt' : 'Sedan senaste avräkning'
              : 'Skapa ett hushåll för att spåra delat saldo'}
          </Text>
        </View>

        {/* Settle CTA */}
        {household && balancePartner && absNet >= 1 && (
          isOwing ? (
            <View style={styles.swishGroup}>
              <TouchableOpacity
                style={styles.swishBtn}
                onPress={openSwish}
                activeOpacity={0.85}
              >
                <SwishGlyph size={18} color="white" />
                <Text style={styles.swishBtnText}>
                  Swisha {formattedNet} kr till {balancePartner.display_name ?? 'din sambo'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settleLink}
                onPress={() => router.push('/settle')}
                activeOpacity={0.7}
              >
                <Text style={styles.settleLinkText}>Swisha annat belopp →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.settleBtn, createSettlement.isPending && { opacity: 0.5 }]}
              onPress={handleSettle}
              disabled={createSettlement.isPending}
              activeOpacity={0.85}
            >
              <CheckIcon size={16} color={colors.positive} />
              <Text style={styles.settleBtnText}>
                Markera {formattedNet} kr som mottaget
              </Text>
            </TouchableOpacity>
          )
        )}

        {household && absNet < 1 && (
          <View style={styles.evenRow}>
            <CheckIcon size={16} color={colors.positive} />
            <Text style={styles.evenText}>Avräknat — alla kvitt</Text>
          </View>
        )}

        {/* Quick actions */}
        {household && (
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => router.push('/add-expense')}
              activeOpacity={0.8}
            >
              <Text style={styles.quickCardIcon}>+</Text>
              <View>
                <Text style={styles.quickCardTitle}>Ny utgift</Text>
                <Text style={styles.quickCardSub}>Registrera ett köp</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => router.push('/(tabs)/swipe' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.quickCardIcon}>⇄</Text>
              <View>
                <Text style={styles.quickCardTitle}>Sortera</Text>
                <Text style={styles.quickCardSub}>Granska utgifter</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent expenses */}
        {household && recentExpenses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Senaste</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/expenses' as any)}>
                <Text style={styles.sectionLink}>Alla</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.recentList}>
              {recentExpenses.map((e, i) => {
                const isPaidByMe = e.paid_by === profile?.id;
                const myAmt = e.is_shared
                  ? e.amount * (isPaidByMe ? e.split_ratio : 1 - e.split_ratio)
                  : e.amount;
                return (
                  <View
                    key={e.id}
                    style={[
                      styles.recentRow,
                      i < recentExpenses.length - 1 && styles.recentRowBorder,
                    ]}
                  >
                    <View style={[styles.recentIcon, { backgroundColor: (e.category?.color ?? colors.accentFrom) + '22' }]}>
                      <Text style={styles.recentIconText}>{e.category?.icon ?? '📦'}</Text>
                    </View>
                    <View style={styles.recentMid}>
                      <Text style={styles.recentTitle} numberOfLines={1}>
                        {e.description || e.category?.name || 'Utgift'}
                      </Text>
                      <Text style={styles.recentMeta}>
                        {e.is_shared ? 'Delad · ' : ''}{formatDate(e.date)}
                      </Text>
                    </View>
                    <Text style={[styles.recentAmt, !isPaidByMe && { color: colors.textPrimary }]}>
                      {isPaidByMe ? '+' : '−'}{formatAmount(e.is_shared ? myAmt : e.amount)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Hushåll — invite or member */}
        {!household ? (
          <View style={styles.soloCard}>
            <Text style={styles.soloIcon}>🏠</Text>
            <Text style={styles.soloTitle}>Du kör solo just nu</Text>
            <Text style={styles.soloText}>
              Skapa ett hushåll och bjud in din sambo för att dela utgifter och hålla koll på saldot.
            </Text>
            <TouchableOpacity
              style={styles.soloBtn}
              onPress={() => router.replace('/(setup)')}
              activeOpacity={0.8}
            >
              <Text style={styles.soloBtnText}>Sätt upp ett hushåll →</Text>
            </TouchableOpacity>
          </View>
        ) : otherMembers.length === 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Hushåll</Text>
            <View style={styles.inviteCard}>
              <Text style={styles.inviteLabel}>Bjud in din sambo</Text>
              <Text style={styles.inviteSub}>Dela den här koden:</Text>
              <TouchableOpacity style={styles.codeRow} onPress={copyInviteCode} activeOpacity={0.7}>
                <Text style={styles.code}>{household.invite_code}</Text>
                <Text style={styles.copyBtn}>{copied ? '✓ Kopierad' : 'Kopiera'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </Animated.ScrollView>

      {/* Swish flow — sheet */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 28,
  },
  dateLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.8,
    marginTop: 2,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },

  balanceSection: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  balanceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  balanceAmount: {
    fontSize: 64,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -2.5,
    lineHeight: 68,
  },
  balanceUnit: { fontSize: 22, fontWeight: '500', color: colors.textSecondary },
  progressTrack: {
    marginTop: 14,
    height: 2,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  balanceSub: {
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 8,
    letterSpacing: 0.2,
  },

  swishGroup: {
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 10,
  },
  // Swish CTA — pink, primary
  swishBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: SWISH_PINK,
  },
  swishBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.2,
  },
  settleLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  settleLinkText: {
    fontSize: 13,
    color: colors.textDisabled,
    fontWeight: '500',
  },

  // Settle CTA — outline, used when partner owes me
  settleBtn: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.positive + '55',
  },
  settleBtnText: { fontSize: 14, fontWeight: '500', color: colors.positive },

  evenRow: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.positive + '55',
  },
  evenText: { fontSize: 14, fontWeight: '500', color: colors.positive },

  quickGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 28,
  },
  quickCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 18,
    minHeight: 96,
  },
  quickCardIcon: { fontSize: 20, color: colors.accentFrom, fontWeight: '700' },
  quickCardTitle: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  quickCardSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionLink: { fontSize: 13, color: colors.accentFrom, fontWeight: '500' },

  recentList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  recentRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  recentRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  recentIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  recentIconText: { fontSize: 16 },
  recentMid: { flex: 1 },
  recentTitle: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  recentMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  recentAmt: { fontSize: 14, fontWeight: '600', color: colors.positive },

  inviteCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginTop: 10,
  },
  inviteLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  inviteSub: { fontSize: 13, color: colors.textSecondary },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  code: { fontSize: 22, fontWeight: '700', color: colors.accentFrom, letterSpacing: 2 },
  copyBtn: { fontSize: 13, color: colors.accentFrom, fontWeight: '500' },

  soloCard: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  soloIcon: { fontSize: 40 },
  soloTitle: { fontSize: typography.lg, fontWeight: '700', color: colors.textPrimary },
  soloText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  soloBtn: {
    marginTop: 8,
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.accentFrom + '60',
    backgroundColor: colors.accentFrom + '20',
  },
  soloBtnText: { fontSize: 13, fontWeight: '700', color: colors.accentFrom },
});
