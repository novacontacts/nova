import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Share, Linking, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { useBalance } from '@/hooks/useExpenses';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { supabase } from '@/lib/supabase';
import { colors, typography, spacing, radius } from '@/constants/theme';

// Uppdatera dessa URL:er när sidor är live
const PRIVACY_URL = 'https://novaapp.se/privacy';
const TERMS_URL   = 'https://novaapp.se/terms';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { household, reset: resetHousehold } = useHouseholdStore();
  const { net } = useBalance();
  const { isSupported, isEnabled, isLoaded, toggle: toggleBiometric } = useLocalAuth();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function handleExportData() {
    setIsExporting(true);
    try {
      const [expRes, settlRes] = await Promise.all([
        supabase.from('expenses').select('*, category:categories(name)').eq('paid_by', profile!.id),
        supabase.from('settlements').select('*').eq('household_id', household?.id ?? ''),
      ]);
      const payload = {
        exportDate: new Date().toISOString(),
        profile: { name: profile?.display_name, email: profile?.email },
        expenses: expRes.data ?? [],
        settlements: settlRes.data ?? [],
      };
      await Share.share({ message: JSON.stringify(payload, null, 2), title: 'Nova – Min data' });
    } catch (e: any) {
      Alert.alert('Fel', e.message);
    } finally {
      setIsExporting(false);
    }
  }

  async function confirmLeave() {
    if (!household) return;
    setIsLeaving(true);
    try {
      const { error } = await supabase.rpc('leave_household', { p_household_id: household.id });
      if (error) throw error;
      resetHousehold();
      router.replace('/(setup)');
    } catch (e: any) {
      Alert.alert('Fel', e.message);
      setIsLeaving(false);
    }
  }

  function handleLeaveHousehold() {
    const absNet = Math.abs(net);
    if (absNet >= 1) {
      Alert.alert(
        'Okvitterat saldo',
        `Det finns ett okvitterat saldo på ${absNet.toFixed(0)} kr. Reglera det med din sambo innan du lämnar.`,
        [
          { text: 'Avbryt', style: 'cancel' },
          { text: 'Lämna ändå', style: 'destructive', onPress: confirmLeave },
        ]
      );
    } else {
      Alert.alert(
        'Lämna hushåll?',
        'Du lämnar hushållet. Delade utgifter förblir synliga som historik men kan inte redigeras.',
        [
          { text: 'Avbryt', style: 'cancel' },
          { text: 'Lämna', style: 'destructive', onPress: confirmLeave },
        ]
      );
    }
  }

  async function confirmDeleteAccount() {
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await signOut();
    } catch (e: any) {
      Alert.alert('Fel', e.message);
      setIsDeleting(false);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Radera konto?',
      'All din data raderas permanent: utgifter, kategorier och kontoinformation. Delade utgifter anonymiseras för din sambo.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Fortsätt',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Sista chansen',
              'Det här kan inte ångras. Kontot och all data försvinner för alltid.',
              [
                { text: 'Avbryt', style: 'cancel' },
                { text: 'Radera för alltid', style: 'destructive', onPress: confirmDeleteAccount },
              ]
            ),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.close}>Stäng</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Inställningar</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Profil */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>
                {(profile?.display_name ?? profile?.email ?? '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{profile?.display_name ?? 'Okänt namn'}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{profile?.email}</Text>
            </View>
          </View>
        </View>

        {/* Konto-åtgärder */}
        <Text style={styles.sectionLabel}>Konto</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              Alert.alert('Logga ut', 'Är du säker?', [
                { text: 'Avbryt', style: 'cancel' },
                { text: 'Logga ut', style: 'destructive', onPress: signOut },
              ])
            }
          >
            <Text style={styles.rowText}>Logga ut</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {household && (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.row}
                onPress={handleLeaveHousehold}
                disabled={isLeaving}
              >
                {isLeaving ? (
                  <ActivityIndicator color={colors.warning} size="small" />
                ) : (
                  <Text style={[styles.rowText, { color: colors.warning }]}>Lämna hushåll</Text>
                )}
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Säkerhet (D1) */}
        {isLoaded && isSupported && (
          <>
            <Text style={styles.sectionLabel}>Säkerhet</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowText}>Face ID / Touch ID</Text>
                <Switch
                  value={isEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ true: colors.accentFrom, false: colors.border }}
                  thumbColor={colors.textPrimary}
                />
              </View>
            </View>
          </>
        )}

        {/* Data (B3 + B4) */}
        <Text style={styles.sectionLabel}>Data & juridik</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={handleExportData} disabled={isExporting}>
            {isExporting
              ? <ActivityIndicator color={colors.accentFrom} size="small" />
              : <Text style={styles.rowText}>Exportera min data</Text>}
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.rowText}>Integritetspolicy</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.rowText}>Användarvillkor</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Farlig zon */}
        <Text style={styles.sectionLabel}>Farlig zon</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <TouchableOpacity
            style={styles.row}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.negative} size="small" />
            ) : (
              <Text style={[styles.rowText, { color: colors.negative }]}>Radera konto</Text>
            )}
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.dangerNote}>
          Raderar kontot och all tillhörande data permanent.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { fontSize: typography.base, color: colors.textSecondary },
  title: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },

  content: { padding: spacing.base, gap: spacing.sm, paddingBottom: 48 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dangerCard: { borderColor: colors.negative + '50' },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentFrom + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { fontSize: typography.xl, fontWeight: '700', color: colors.accentFrom },
  profileName: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  profileEmail: { fontSize: typography.sm, color: colors.textSecondary },

  sectionLabel: {
    fontSize: typography.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    minHeight: 52,
  },
  rowText: { fontSize: typography.base, fontWeight: '500', color: colors.textPrimary },
  chevron: { fontSize: typography.xl, color: colors.textDisabled },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginLeft: spacing.base },

  dangerNote: {
    fontSize: typography.xs,
    color: colors.textDisabled,
    paddingHorizontal: spacing.xs,
    lineHeight: 18,
  },
});
