import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { useBalance, useCreateSettlement } from '@/hooks/useExpenses';
import { colors, typography, spacing, radius } from '@/constants/theme';

function AnimatedBalance({ value, color }: { value: number; color: string }) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    animValue.setValue(0);
    Animated.timing(animValue, { toValue: Math.abs(value), duration: 700, useNativeDriver: false }).start();
    const id = animValue.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => animValue.removeListener(id);
  }, [value]);

  return (
    <Text style={[styles.balanceAmount, { color }]}>
      {display.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
    </Text>
  );
}

export default function DashboardScreen() {
  const { profile, signOut } = useAuthStore();
  const { household, members } = useHouseholdStore();
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { net, partner: balancePartner } = useBalance();
  const createSettlement = useCreateSettlement();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const otherMembers = members.filter((m) => m.user_id !== profile?.id);
  const greeting = profile?.display_name ? `Hej, ${profile.display_name}` : 'Hej!';
  const balanceColor = net > 0 ? colors.positive : net < 0 ? colors.negative : colors.textPrimary;
  const balanceLabel = net > 0
    ? `${balancePartner?.display_name ?? 'Hushållet'} är skyldigt dig`
    : net < 0
    ? `Du är skyldig ${balancePartner?.display_name ?? 'hushållet'}`
    : 'Ni är jämna';
  const absNet = Math.abs(net);
  const formattedNet = absNet.toLocaleString('sv-SE', { maximumFractionDigits: 0 });

  async function copyInviteCode() {
    if (!household?.invite_code) return;
    await Clipboard.setStringAsync(household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function doSettle() {
    try {
      const fromUser = net < 0 ? profile!.id : balancePartner!.id;
      const toUser   = net < 0 ? balancePartner!.id : profile!.id;
      await createSettlement.mutateAsync({ amount: absNet, fromUser, toUser });
    } catch (e: any) {
      Alert.alert('Fel', e.message);
    }
  }

  function confirmSettle() {
    const actionText = net < 0
      ? `Du markerar att du betalat ${formattedNet} kr till ${balancePartner?.display_name ?? 'din sambo'}.`
      : `Du markerar att du mottagit ${formattedNet} kr från ${balancePartner?.display_name ?? 'din sambo'}.`;
    Alert.alert('Markera som betald', `${actionText}\n\nSaldot nollställs.`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Bekräfta', onPress: doSettle },
    ]);
  }

  function handleSettle() {
    if (!profile || !balancePartner || absNet < 1) return;
    if (net < 0) {
      Alert.alert(`Betala ${formattedNet} kr`, `till ${balancePartner.display_name ?? 'din sambo'}`, [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: '🔵 Öppna Swish',
          onPress: () =>
            Linking.openURL('swish://').catch(() =>
              Alert.alert('Swish saknas', 'Swish verkar inte vara installerat.')
            ),
        },
        { text: 'Markera manuellt', onPress: confirmSettle },
      ]);
    } else {
      confirmSettle();
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.ScrollView
        style={{ flex: 1, opacity: fadeAnim }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            {household && <Text style={styles.householdSub}>{household.name}</Text>}
          </View>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.settingsBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Balance hero */}
        <TouchableOpacity
          style={styles.hero}
          onPress={() => router.push('/add-expense')}
          activeOpacity={0.85}
        >
          <Text style={styles.heroLabel}>
            {household ? balanceLabel : 'Ditt saldo'}
          </Text>
          <AnimatedBalance
            value={net}
            color={household ? balanceColor : colors.textPrimary}
          />
          <Text style={styles.heroHint}>
            {household
              ? 'Tryck för att lägga till utgift'
              : 'Skapa ett hushåll för att spåra delat saldo'}
          </Text>
        </TouchableOpacity>

        {/* Settle CTA */}
        {household && balancePartner && absNet >= 1 && (
          <TouchableOpacity
            style={[styles.settleBtn, createSettlement.isPending && { opacity: 0.5 }]}
            onPress={handleSettle}
            disabled={createSettlement.isPending}
            activeOpacity={0.8}
          >
            <Text style={styles.settleBtnText}>
              {net < 0
                ? `Betala ${formattedNet} kr →`
                : `Mottagit ${formattedNet} kr ✓`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Hushåll */}
        {household ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Hushåll</Text>
            <View style={styles.card}>
              {otherMembers.length > 0 ? (
                otherMembers.map((m, i) => (
                  <View key={m.user_id}>
                    {i > 0 && <View style={styles.divider} />}
                    <View style={styles.memberRow}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberInitial}>
                          {(m.profile?.display_name ?? m.profile?.email ?? '?')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.memberName}>
                          {m.profile?.display_name ?? m.profile?.email}
                        </Text>
                        <Text style={styles.memberSub}>Hushållsmedlem</Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.inviteInner}>
                  <Text style={styles.inviteLabel}>Bjud in din sambo</Text>
                  <Text style={styles.inviteSub}>Dela den här koden:</Text>
                  <TouchableOpacity style={styles.codeRow} onPress={copyInviteCode} activeOpacity={0.7}>
                    <Text style={styles.code}>{household.invite_code}</Text>
                    <Text style={styles.copyBtn}>{copied ? '✓ Kopierad' : 'Kopiera'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
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
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing['4xl'] },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  greeting: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  householdSub: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  settingsBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  settingsIcon: { fontSize: 18 },

  hero: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroLabel: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: typography['5xl'],
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 60,
  },
  heroHint: {
    fontSize: typography.xs,
    color: colors.textDisabled,
    marginTop: spacing.xs,
  },

  settleBtn: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    backgroundColor: colors.positive + '18',
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  settleBtnText: {
    fontSize: typography.base,
    fontWeight: '700',
    color: colors.positive,
  },

  section: { marginTop: spacing.xl, paddingHorizontal: spacing.base, gap: spacing.sm },
  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginLeft: 60 + spacing.base },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  memberAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accentFrom + '25',
    alignItems: 'center', justifyContent: 'center',
  },
  memberInitial: { fontSize: typography.lg, fontWeight: '700', color: colors.accentFrom },
  memberName: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  memberSub: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 1 },

  inviteInner: { padding: spacing.base, gap: spacing.sm },
  inviteLabel: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  inviteSub: { fontSize: typography.sm, color: colors.textSecondary },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  code: { fontSize: typography.xl, fontWeight: '700', color: colors.accentFrom, letterSpacing: 2 },
  copyBtn: { fontSize: typography.sm, color: colors.accentFrom, fontWeight: '500' },

  soloCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  soloIcon: { fontSize: 40 },
  soloTitle: { fontSize: typography.lg, fontWeight: '700', color: colors.textPrimary },
  soloText: { fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  soloBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accentFrom + '20',
    borderRadius: radius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accentFrom + '60',
  },
  soloBtnText: { fontSize: typography.sm, fontWeight: '700', color: colors.accentFrom },
});
