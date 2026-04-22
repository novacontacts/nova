import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, typography, spacing, radius } from '@/constants/theme';

type Step = 'choose' | 'create' | 'join';

export default function HouseholdSetupScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { createHousehold, joinHousehold } = useHouseholdStore();

  const [step, setStep] = useState<Step>('choose');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!householdName.trim()) { setError('Ge hushållet ett namn.'); return; }
    setError('');
    setLoading(true);
    const err = await createHousehold(householdName, user!.id);
    setLoading(false);
    if (err) { setError(err); return; }
    router.replace('/(tabs)');
  }

  async function handleJoin() {
    if (!inviteCode.trim()) { setError('Ange en inbjudningskod.'); return; }
    setError('');
    setLoading(true);
    const err = await joinHousehold(inviteCode, user!.id);
    setLoading(false);
    if (err) { setError(err); return; }
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {step === 'choose' && (
            <>
              <View style={styles.header}>
                <Text style={styles.logo}>Nova</Text>
                <Text style={styles.title}>Välkommen!</Text>
                <Text style={styles.subtitle}>
                  Skapa ett hushåll och bjud in din sambo, eller gå med i ett befintligt via inbjudningskod.
                </Text>
              </View>

              <View style={styles.cards}>
                <TouchableOpacity style={styles.card} onPress={() => setStep('create')} activeOpacity={0.8}>
                  <Text style={styles.cardIcon}>🏠</Text>
                  <Text style={styles.cardTitle}>Skapa hushåll</Text>
                  <Text style={styles.cardDesc}>Starta ett nytt hushåll och bjud in din partner</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.card} onPress={() => setStep('join')} activeOpacity={0.8}>
                  <Text style={styles.cardIcon}>🔑</Text>
                  <Text style={styles.cardTitle}>Gå med i hushåll</Text>
                  <Text style={styles.cardDesc}>Ange en inbjudningskod från din partner</Text>
                </TouchableOpacity>
              </View>

              <Button
                label="Fortsätt solo"
                variant="ghost"
                onPress={() => router.replace('/(tabs)')}
              />
            </>
          )}

          {step === 'create' && (
            <>
              <View style={styles.header}>
                <Text style={styles.stepBack} onPress={() => { setStep('choose'); setError(''); }}>← Tillbaka</Text>
                <Text style={styles.title}>Skapa hushåll</Text>
                <Text style={styles.subtitle}>Vad ska ditt hushåll heta?</Text>
              </View>

              <View style={styles.form}>
                <Input
                  label="Hushållets namn"
                  placeholder="t.ex. Lägenheten, Villa Svensson..."
                  value={householdName}
                  onChangeText={setHouseholdName}
                  autoCapitalize="words"
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label="Skapa hushåll" onPress={handleCreate} loading={loading} />
              </View>
            </>
          )}

          {step === 'join' && (
            <>
              <View style={styles.header}>
                <Text style={styles.stepBack} onPress={() => { setStep('choose'); setError(''); }}>← Tillbaka</Text>
                <Text style={styles.title}>Gå med i hushåll</Text>
                <Text style={styles.subtitle}>
                  Be din partner öppna Nova och dela sin inbjudningskod från översiktsskärmen.
                </Text>
              </View>

              <View style={styles.form}>
                <Input
                  label="Inbjudningskod"
                  placeholder="t.ex. a1b2c3d4"
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  autoCapitalize="none"
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label="Gå med" onPress={handleJoin} loading={loading} />
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, paddingHorizontal: spacing['2xl'], justifyContent: 'center', gap: spacing['2xl'] },
  header: { gap: spacing.sm },
  logo: { fontSize: typography['2xl'], fontWeight: '700', color: colors.accentFrom, letterSpacing: -0.5 },
  title: { fontSize: typography['3xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: typography.base, color: colors.textSecondary, lineHeight: 22 },
  stepBack: { fontSize: typography.base, color: colors.accentFrom, fontWeight: '500' },
  cards: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  cardIcon: { fontSize: 28 },
  cardTitle: { fontSize: typography.md, fontWeight: '600', color: colors.textPrimary },
  cardDesc: { fontSize: typography.sm, color: colors.textSecondary },
  form: { gap: spacing.base },
  error: { fontSize: typography.sm, color: colors.negative },
});
