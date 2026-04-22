import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { useBalance, useCreateSettlement } from '@/hooks/useExpenses';
import { colors, typography, spacing, radius } from '@/constants/theme';

export default function DashboardScreen() {
  const { profile, signOut } = useAuthStore();
  const { household, members } = useHouseholdStore();
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { net, partner: balancePartner } = useBalance();
  const createSettlement = useCreateSettlement();

  const partner = members.find((m) => m.user_id !== profile?.id);
  const greeting = profile?.display_name ? `Hej, ${profile.display_name}` : 'Hej!';

  const balanceColor = net > 0 ? colors.positive : net < 0 ? colors.negative : colors.textPrimary;
  const balanceLabel = net > 0
    ? `${balancePartner?.display_name ?? 'Din sambo'} är skyldig dig`
    : net < 0
    ? `Du är skyldig ${balancePartner?.display_name ?? 'din sambo'}`
    : 'Ni är jämna';

  const absNet = Math.abs(net);
  const formattedNet = absNet.toLocaleString('sv-SE', { maximumFractionDigits: 0 });

  async function copyInviteCode() {
    if (!household?.invite_code) return;
    await Clipboard.setStringAsync(household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSettle() {
    if (!profile || !balancePartner || absNet < 1) return;

    const fromUser = net < 0 ? profile.id : balancePartner.id;
    const toUser   = net < 0 ? balancePartner.id : profile.id;
    const actionText = net < 0
      ? `Du markerar att du betalat ${formattedNet} kr till ${balancePartner.display_name ?? 'din sambo'}.`
      : `Du markerar att du mottagit ${formattedNet} kr från ${balancePartner.display_name ?? 'din sambo'}.`;

    Alert.alert(
      'Markera som betald',
      `${actionText}\n\nSaldot nollställs.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Bekräfta',
          onPress: async () => {
            try {
              await createSettlement.mutateAsync({ amount: absNet, fromUser, toUser });
            } catch (e: any) {
              Alert.alert('Fel', e.message);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            {household && <Text style={styles.householdName}>{household.name}</Text>}
          </View>
          <TouchableOpacity onPress={() => Alert.alert('Logga ut', 'Är du säker?', [
            { text: 'Avbryt', style: 'cancel' },
            { text: 'Logga ut', style: 'destructive', onPress: signOut },
          ])}>
            <Text style={styles.signOut}>Logga ut</Text>
          </TouchableOpacity>
        </View>

        {/* Saldo-kort */}
        <TouchableOpacity style={styles.balanceCard} onPress={() => router.push('/add-expense')} activeOpacity={0.85}>
          <Text style={styles.balanceLabel}>{household ? balanceLabel : 'Ditt saldo'}</Text>
          <Text style={[styles.balanceAmount, household && { color: balanceColor }]}>
            {formattedNet} kr
          </Text>
          <Text style={styles.balanceNote}>
            {household ? 'Tryck för att lägga till utgift' : 'Skapa ett hushåll för att spåra delat saldo'}
          </Text>
        </TouchableOpacity>

        {/* Markera som betald — syns bara när det finns ett saldo och en partner */}
        {household && balancePartner && absNet >= 1 && (
          <TouchableOpacity
            style={[styles.settleBtn, createSettlement.isPending && styles.settleBtnDisabled]}
            onPress={handleSettle}
            disabled={createSettlement.isPending}
            activeOpacity={0.8}
          >
            <Text style={styles.settleBtnText}>
              {net < 0
                ? `✓  Jag har betalat ${formattedNet} kr`
                : `✓  Jag har mottagit ${formattedNet} kr`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Hushåll / inbjudningskod */}
        {household ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hushåll</Text>
            {partner ? (
              <View style={styles.memberRow}>
                <Text style={styles.memberIcon}>👤</Text>
                <View>
                  <Text style={styles.memberName}>{partner.profile?.display_name ?? partner.profile?.email}</Text>
                  <Text style={styles.memberSub}>Din sambo</Text>
                </View>
              </View>
            ) : (
              <View style={styles.inviteBox}>
                <Text style={styles.inviteLabel}>Bjud in din sambo</Text>
                <Text style={styles.inviteSubtitle}>Dela den här koden:</Text>
                <TouchableOpacity style={styles.codeRow} onPress={copyInviteCode} activeOpacity={0.7}>
                  <Text style={styles.code}>{household.invite_code}</Text>
                  <Text style={styles.copyBtn}>{copied ? '✓ Kopierad' : 'Kopiera'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.soloBox}>
            <Text style={styles.soloText}>Du kör solo just nu.</Text>
          </View>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: spacing.base, gap: spacing.lg, paddingTop: spacing.base },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: typography['2xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  householdName: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },
  signOut: { fontSize: typography.sm, color: colors.textSecondary },

  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceLabel: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },
  balanceAmount: { fontSize: typography['4xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -1 },
  balanceNote: { fontSize: typography.xs, color: colors.textDisabled },

  settleBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.positive,
  },
  settleBtnDisabled: { opacity: 0.5 },
  settleBtnText: { fontSize: typography.base, fontWeight: '600', color: colors.positive },

  section: { gap: spacing.md },
  sectionTitle: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.base,
    borderWidth: 1, borderColor: colors.border,
  },
  memberIcon: { fontSize: 24 },
  memberName: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  memberSub: { fontSize: typography.sm, color: colors.textSecondary },

  inviteBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.base,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  inviteLabel: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  inviteSubtitle: { fontSize: typography.sm, color: colors.textSecondary },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: typography.xl, fontWeight: '700', color: colors.accentFrom, letterSpacing: 2 },
  copyBtn: { fontSize: typography.sm, color: colors.accentFrom, fontWeight: '500' },

  soloBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.base,
    borderWidth: 1, borderColor: colors.border,
  },
  soloText: { fontSize: typography.base, color: colors.textSecondary },
});
