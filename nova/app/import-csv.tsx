import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth';
import { parseCSV, ParsedTransaction } from '@/lib/csv/parser';
import { colors, typography, spacing, radius } from '@/constants/theme';

// expo-document-picker och expo-file-system måste installeras:
// npx expo install expo-document-picker expo-file-system
let DocumentPicker: typeof import('expo-document-picker') | null = null;
let FileSystem: typeof import('expo-file-system') | null = null;
try { DocumentPicker = require('expo-document-picker'); } catch (_) {}
try { FileSystem = require('expo-file-system'); } catch (_) {}

export default function ImportCSVScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [bank, setBank] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const newTxs = useMemo(
    () => transactions.filter(t => !duplicates.has(t.hash)),
    [transactions, duplicates]
  );

  async function pickFile() {
    if (!DocumentPicker || !FileSystem) {
      Alert.alert(
        'Paketen saknas',
        'Kör: npx expo install expo-document-picker expo-file-system — starta sedan om appen.'
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setLoading(true);
      const uri = result.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(uri, {
        encoding: (FileSystem.EncodingType as any).UTF8,
      });

      const parsed = parseCSV(content);
      if (!parsed || parsed.transactions.length === 0) {
        Alert.alert(
          'Okänt format',
          'Filen matchar inte SEB, Swedbank, Nordea eller Handelsbanken.\n\nSe till att du exporterar som CSV med semikolonavgränsare.'
        );
        setLoading(false);
        return;
      }

      // Dubblettdetektering
      const hashes = parsed.transactions.map(t => t.hash);
      let existingHashes = new Set<string>();
      try {
        const { data } = await supabase
          .from('expenses')
          .select('source_hash')
          .in('source_hash', hashes);
        existingHashes = new Set(
          (data ?? []).map(e => e.source_hash as string).filter(Boolean)
        );
      } catch (_) {}

      setBank(parsed.bank);
      setTransactions(parsed.transactions);
      setDuplicates(existingHashes);
    } catch (e: any) {
      Alert.alert('Fel', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function doImport() {
    if (!user || newTxs.length === 0) return;
    setImporting(true);
    try {
      const rows = newTxs.map(t => ({
        date: t.date,
        description: t.description || null,
        amount: t.amount,
        paid_by: user.id,
        is_shared: false,
        reviewed: false,
        split_ratio: 0.5,
        household_id: null,
        category_id: null,
        source_hash: t.hash,
        currency: 'SEK',
        split_type: '50/50',
        is_recurring: false,
        recurring_id: null,
      }));

      const { error } = await supabase.from('expenses').insert(rows);
      if (error) throw error;

      router.replace('/(tabs)/swipe');
    } catch (e: any) {
      Alert.alert('Fel vid import', e.message);
      setImporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.close}>Stäng</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Importera transaktioner</Text>
        <View style={{ width: 48 }} />
      </View>

      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏦</Text>
          <Text style={styles.emptyTitle}>Välj CSV-exportfil</Text>
          <Text style={styles.emptySub}>
            Exportera dina transaktioner från din bank som CSV och välj filen här.{'\n\n'}
            Stöder: SEB · Swedbank · Nordea · Handelsbanken
          </Text>
          <TouchableOpacity
            style={styles.pickBtn}
            onPress={pickFile}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.pickBtnText}>Välj fil...</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.bankBar}>
            <View style={styles.bankBadge}>
              <Text style={styles.bankName}>{bank}</Text>
            </View>
            <Text style={styles.bankStats} numberOfLines={1}>
              {newTxs.length} nya · {duplicates.size} redan importerade
            </Text>
            <TouchableOpacity onPress={pickFile} disabled={loading}>
              <Text style={styles.changeFile}>Byt fil</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={transactions}
            keyExtractor={t => t.hash}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isDupe = duplicates.has(item.hash);
              const mmdd = item.date.substring(5).replace('-', '/');
              return (
                <View style={[styles.txRow, isDupe && styles.txRowDupe]}>
                  <View style={styles.txLeft}>
                    <Text style={[styles.txDate, isDupe && styles.txMuted]}>{mmdd}</Text>
                    <Text style={[styles.txDesc, isDupe && styles.txMuted]} numberOfLines={1}>
                      {item.description || '(ingen beskrivning)'}
                    </Text>
                  </View>
                  <View>
                    {isDupe ? (
                      <Text style={styles.dupeBadge}>Importerad</Text>
                    ) : (
                      <Text style={styles.txAmount}>
                        −{item.amount.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                      </Text>
                    )}
                  </View>
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.importBtn, (importing || newTxs.length === 0) && styles.importBtnDisabled]}
              onPress={doImport}
              disabled={importing || newTxs.length === 0}
              activeOpacity={0.85}
            >
              {importing
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.importBtnText}>
                    Importera {newTxs.length} transaktioner →
                  </Text>}
            </TouchableOpacity>
            <Text style={styles.footerNote}>
              Transaktionerna läggs i swipe-kön för kategorisering.
            </Text>
          </View>
        </>
      )}
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
  close: { fontSize: typography.base, color: colors.textSecondary, width: 48 },
  title: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, paddingHorizontal: spacing['2xl'],
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: typography.xl, fontWeight: '700', color: colors.textPrimary },
  emptySub: {
    fontSize: typography.base, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  pickBtn: {
    marginTop: spacing.sm, backgroundColor: colors.accentFrom,
    borderRadius: radius.full, paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base, minWidth: 160, alignItems: 'center',
  },
  pickBtnText: { fontSize: typography.base, fontWeight: '700', color: '#fff' },

  bankBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.base, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  bankBadge: {
    backgroundColor: colors.accentFrom + '25', borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  bankName: { fontSize: typography.sm, fontWeight: '700', color: colors.accentFrom },
  bankStats: { flex: 1, fontSize: typography.sm, color: colors.textSecondary },
  changeFile: { fontSize: typography.sm, color: colors.accentFrom, fontWeight: '500' },

  list: { paddingHorizontal: spacing.base, paddingVertical: spacing.xs, paddingBottom: 140 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  txRowDupe: { opacity: 0.4 },
  txLeft: { flex: 1, gap: 2 },
  txDate: { fontSize: typography.xs, fontWeight: '500', color: colors.textSecondary },
  txDesc: { fontSize: typography.base, fontWeight: '500', color: colors.textPrimary },
  txMuted: { color: colors.textDisabled },
  txAmount: { fontSize: typography.base, fontWeight: '600', color: colors.negative },
  dupeBadge: {
    fontSize: typography.xs, color: colors.textDisabled,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.borderSubtle,
  },
  sep: { height: 1, backgroundColor: colors.borderSubtle },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.base, paddingBottom: spacing['2xl'],
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: spacing.xs,
  },
  importBtn: {
    backgroundColor: colors.accentFrom, borderRadius: radius.full,
    padding: spacing.base, alignItems: 'center',
  },
  importBtnDisabled: { opacity: 0.4 },
  importBtnText: { fontSize: typography.base, fontWeight: '700', color: '#fff' },
  footerNote: { fontSize: typography.xs, color: colors.textDisabled, textAlign: 'center' },
});
