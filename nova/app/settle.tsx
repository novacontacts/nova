// app/settle.tsx — flöde för att skapa en avräkning manuellt
import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCreateSettlement, SettlementMethod } from '@/hooks/useSettlements';
import { useBalance } from '@/hooks/useExpenses';
import { useHouseholdStore } from '@/lib/store/household';
import { useAuthStore } from '@/lib/store/auth';
import { Icon } from '@/components/Icon';
import { colors, typography, spacing, radius } from '@/constants/theme';

export default function SettleScreen() {
  const router = useRouter();
  const { amount: presetAmount, method: presetMethod } = useLocalSearchParams<{
    amount?: string; method?: SettlementMethod;
  }>();
  const { net } = useBalance();
  const { profile } = useAuthStore();
  const partnerMember = useHouseholdStore((s) =>
    s.members.find((m) => m.user_id !== profile?.id)
  );
  const partner = partnerMember?.profile ?? null;
  const create = useCreateSettlement();

  const [amountStr, setAmountStr] = useState(
    presetAmount ?? Math.abs(net).toFixed(0)
  );
  const [method, setMethod] = useState<SettlementMethod>(presetMethod ?? 'swish');
  const [note, setNote] = useState('');

  const amount = parseFloat(amountStr.replace(',', '.')) || 0;

  async function handleSave() {
    if (amount <= 0) {
      Alert.alert('Ange belopp', 'Beloppet måste vara större än noll.');
      return;
    }
    try {
      if (method === 'swish') {
        const phone = partner?.swish_phone ?? null;
        if (!phone) {
          Alert.alert(
            'Swish-nummer saknas',
            `${partner?.display_name ?? 'Din sambo'} har inte lagt till sitt Swish-nummer under Inställningar.`,
          );
          return;
        }
        let payee = phone.trim();
        if (payee.startsWith('+46')) payee = '0' + payee.slice(3);
        else if (payee.startsWith('0046')) payee = '0' + payee.slice(4);
        payee = payee.replace(/\D/g, '');
        const data = {
          version: 1,
          payee: { value: payee, editable: false },
          amount: { value: Math.round(amount), editable: false },
          message: { value: 'Nova avräkning', editable: true },
        };
        const url = `swish://payment?data=${encodeURIComponent(JSON.stringify(data))}`;
        await Linking.openURL(url);
      }
      await create.mutateAsync({ amount, method, note: note.trim() || undefined });
      router.back();
    } catch (e: any) {
      Alert.alert('Fel', e.message);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Icon name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Ny avräkning</Text>
          <TouchableOpacity onPress={handleSave} disabled={create.isPending}>
            {create.isPending
              ? <ActivityIndicator color={colors.accentFrom} size="small" />
              : <Text style={styles.save}>Spara</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.amountCard}>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                value={amountStr}
                onChangeText={setAmountStr}
                keyboardType="decimal-pad"
                autoFocus
                selectionColor={colors.accentFrom}
              />
              <Text style={styles.currency}>kr</Text>
            </View>
            {partner && (
              <Text style={styles.amountSub}>
                Du betalar {partner.display_name ?? 'sambo'}
              </Text>
            )}
          </View>

          <Text style={styles.label}>Metod</Text>
          <View style={styles.methodRow}>
            {(['swish', 'cash', 'manual', 'other'] as SettlementMethod[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.methodBtn, method === m && styles.methodBtnActive]}
                onPress={() => setMethod(m)}
                activeOpacity={0.7}
              >
                <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
                  {m === 'swish' ? 'Swish' : m === 'cash' ? 'Kontant' : m === 'manual' ? 'Manuell' : 'Annat'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Anteckning</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Valfritt – t.ex. 'oktober-uppgörelse'"
            placeholderTextColor={colors.textDisabled}
            multiline
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  save: { fontSize: typography.base, fontWeight: '600', color: colors.accentFrom },
  content: { padding: spacing.base, gap: spacing.lg },
  amountCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: spacing.xs,
  },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  amountInput: {
    fontSize: 64, fontWeight: '700', color: colors.textPrimary,
    letterSpacing: -2, minWidth: 80, textAlign: 'right', padding: 0,
  },
  currency: { fontSize: typography.xl, fontWeight: '600', color: colors.textSecondary, paddingBottom: 12 },
  amountSub: { fontSize: typography.sm, color: colors.textSecondary },
  label: {
    fontSize: typography.sm, color: colors.textSecondary, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  methodRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  methodBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  methodBtnActive: { borderColor: colors.accentFrom, backgroundColor: colors.surfaceRaised },
  methodText: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },
  methodTextActive: { color: colors.accentFrom, fontWeight: '600' },
  noteInput: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, minHeight: 80, textAlignVertical: 'top',
    fontSize: typography.base, color: colors.textPrimary,
  },
});
