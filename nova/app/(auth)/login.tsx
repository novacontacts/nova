import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, typography, spacing } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      setError('Fyll i e-post och lösenord.');
      return;
    }
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setLoading(false);
    if (error) setError(error.message);
    // Om det lyckas hanterar AuthGate i _layout.tsx redirect automatiskt
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
            <Text style={styles.tagline}>Din ekonomi, tillsammans.</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="E-post"
              placeholder="du@exempel.se"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <Input
              label="Lösenord"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              secureToggle
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button label="Logga in" onPress={handleLogin} loading={loading} style={styles.btn} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Inget konto? </Text>
            <Link href="/(auth)/signup" style={styles.link}>Skapa konto</Link>
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
});
