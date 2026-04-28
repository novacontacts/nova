import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  ScrollView, Share, Linking, Switch, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { useBalance } from '@/hooks/useExpenses';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { useUpdateProfile, normalizeSwishPhone } from '@/hooks/useUpdateProfile';
import { supabase } from '@/lib/supabase';
import { colors, typography, spacing, radius } from '@/constants/theme';

const PRIVACY_URL = 'https://novaapp.se/privacy';
const TERMS_URL   = 'https://novaapp.se/terms';

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const { household, members, reset: resetHousehold } = useHouseholdStore();
  const { net } = useBalance();
  const { isSupported, isEnabled, isLoaded, toggle: toggleBiometric } = useLocalAuth();
  const updateProfile = useUpdateProfile();
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState(profile?.swish_phone ?? '');

  const partner = members.find((m) => m.user_id !== profile?.id)?.profile;

  async function handleSavePhone() {
    const normalized = normalizeSwishPhone(phoneInput);
    if (phoneInput.trim() && !normalized?.match(/^\+\d{8,15}$/)) {
      Alert.alert('Felaktigt nummer', 'Använd format 070... eller +46...');
      return;
    }
    try {
      await updateProfile.mutateAsync({ swish_phone: normalized });
      setPhoneModalOpen(false);
    } catch (e: any) {
      Alert.alert('Fel', e.message);
    }
  }

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

        {/* Swish */}
        <Text style={styles.sectionLabel}>Swish</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => { setPhoneInput(profile?.swish_phone ?? ''); setPhoneModalOpen(true); }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>Mitt Swish-nummer</Text>
              <Text style={styles.rowSub}>
                {profile?.swish_phone ?? 'Inte angivet — Swish-länkar förifylls inte'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {partner && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{partner.display_name ?? 'Sambo'}</Text>
                  <Text style={styles.rowSub}>
                    {partner.swish_phone ? partner.swish_phone : 'Sambo har inte angivit Swish-nummer'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
        <Text style={styles.dangerNote}>
          Numret används för att förifylla mottagare i Swish-appen när du gör en avräkning.
        </Text>

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

        {/* Säkerhet */}
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

        {/* Data */}
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

      {/* Swish-nummer modal */}
      <Modal visible={phoneModalOpen} transparent animationType="slide" onRequestClose={() => setPhoneModalOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPhoneModalOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Ditt Swish-nummer</Text>
              <Text style={styles.modalSub}>
                Används när din sambo öppnar Swish för att betala dig.
              </Text>
              <TextInput
                style={styles.modalInput}
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="070-123 45 67"
                placeholderTextColor={colors.textDisabled}
                keyboardType="phone-pad"
                autoFocus
                selectionColor={colors.accentFrom}
              />
              <TouchableOpacity
                style={styles.modalSave}
                onPress={handleSavePhone}
                disabled={updateProfile.isPending}
                activeOpacity={0.85}
              >
                {updateProfile.isPending
                  ? <ActivityIndicator color={colors.bg} size="small" />
                  : <Text style={styles.modalSaveText}>Spara</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setPhoneModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Avbryt</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
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
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.accentFrom + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  profileInitial: { fontSize: typography.xl, fontWeight: '700', color: colors.accentFrom },
  profileName: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  profileEmail: { fontSize: typography.sm, color: colors.textSecondary },

  sectionLabel: {
    fontSize: typography.xs, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: spacing.md, marginLeft: spacing.xs,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.base, minHeight: 52, gap: spacing.md,
  },
  rowText: { fontSize: typography.base, fontWeight: '500', color: colors.textPrimary },
  rowSub: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: typography.xl, color: colors.textDisabled },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginLeft: spacing.base },

  dangerNote: {
    fontSize: typography.xs, color: colors.textDisabled,
    paddingHorizontal: spacing.xs, lineHeight: 18,
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.sm },
  modalTitle: { fontSize: typography.lg, fontWeight: '700', color: colors.textPrimary },
  modalSub: { fontSize: typography.sm, color: colors.textSecondary },
  modalInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 52,
    fontSize: typography.lg, color: colors.textPrimary,
    fontWeight: '500', letterSpacing: 0.5,
  },
  modalSave: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.full, paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { fontSize: typography.base, fontWeight: '700', color: colors.bg },
  modalCancel: { paddingVertical: spacing.sm, alignItems: 'center' },
  modalCancelText: { fontSize: typography.sm, color: colors.textSecondary },
});
