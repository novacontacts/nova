import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, typography, spacing } from '@/constants/theme';

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSignup() {
    if (!displayName || !email || !password || !confirm) {
      setError('Fyll i alla fält.');
      return;
    }
    if (password !== confirm) {
      setError('Lösenorden matchar inte.');
      return;
    }
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken.');
      return;
    }
    setError('');
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Uppdatera display_name i profiles-tabellen
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', data.user.id);
    }

    // Supabase kräver e-postbekräftelse by default.
    // Om du stängt av det i Supabase-inställningarna loggas användaren in direkt.
    if (!data.session) {
      setDone(true);
    }
    // Om session finns hanterar AuthGate redirect automatiskt
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneIcon}>✉️</Text>
          <Text style={styles.doneTitle}>Bekräfta din e-post</Text>
          <Text style={styles.doneText}>
            Vi skickade en länk till {email}. Klicka på länken för att aktivera ditt konto.
          </Text>
          <Link href="/(auth)/login" style={styles.link}>Tillbaka till inloggning</Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>Nova</Text>
            <Text style={styles.tagline}>Skapa ditt konto</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Vad ska vi kalla dig?"
              placeholder="Förnamn eller smeknamn"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
            <Input
              label="E-post"
              placeholder="du@exempel.se"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <Input
              label="Lösenord"
              placeholder="Minst 6 tecken"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              secureToggle
            />
            <Input
              label="Bekräfta lösenord"
              placeholder="Samma lösenord igen"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              error={confirm && password !== confirm ? 'Lösenorden matchar inte' : undefined}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button label="Skapa konto" onPress={handleSignup} loading={loading} style={styles.btn} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Har du redan ett konto? </Text>
            <Link href="/(auth)/login" style={styles.link}>Logga in</Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, paddingHorizontal: spacing['2xl'], justifyContent: 'center', gap: spacing['2xl'] },
  header: { alignItems: 'center', gap: spacing.sm },
  logo: { fontSize: typography['4xl'], fontWeight: '700', color: colors.textPrimary, letterSpacing: -1 },
  tagline: { fontSize: typography.base, color: colors.textSecondary },
  form: { gap: spacing.base },
  error: { fontSize: typography.sm, color: colors.negative, textAlign: 'center' },
  btn: { marginTop: spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { fontSize: typography.base, color: colors.textSecondary },
  link: { fontSize: typography.base, color: colors.accentFrom, fontWeight: '600' },
  doneContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['2xl'], gap: spacing.base },
  doneIcon: { fontSize: 48 },
  doneTitle: { fontSize: typography.xl, fontWeight: '700', color: colors.textPrimary },
  doneText: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
