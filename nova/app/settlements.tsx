// app/settlements.tsx — historik över avräkningar
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSettlements, Settlement } from '@/hooks/useSettlements';
import { useAuthStore } from '@/lib/store/auth';
import { Icon } from '@/components/Icon';
import { colors, typography, spacing, radius } from '@/constants/theme';

function formatAmount(n: number) {
  return n.toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr';
}

function formatDate(s: string) {
  const d = new Date(s);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Idag, ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Igår';
  if (diffDays < 7) return d.toLocaleDateString('sv-SE', { weekday: 'long' });
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
}

const METHOD_LABEL: Record<string, string> = {
  swish: 'Swish', cash: 'Kontant', manual: 'Manuell', other: 'Annat',
};

function SettlementRow({ item, currentUserId }: { item: Settlement; currentUserId: string }) {
  const sentByMe = item.from_user === currentUserId;
  const otherProfile = sentByMe ? item.to_profile : item.from_profile;
  const otherName = otherProfile?.display_name ?? otherProfile?.email?.split('@')[0] ?? 'Okänd';

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, sentByMe ? styles.iconOut : styles.iconIn]}>
        <Icon
          name={sentByMe ? 'arrowOut' : 'arrowIn'}
          size={20}
          color={sentByMe ? colors.negative : colors.positive}
          weight={2}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>
          {sentByMe ? `Du betalade ${otherName}` : `${otherName} betalade dig`}
        </Text>
        <Text style={styles.rowMeta}>
          {formatDate(item.settled_at)} · {METHOD_LABEL[item.method] ?? item.method}
        </Text>
        {item.note ? <Text style={styles.rowNote} numberOfLines={1}>{item.note}</Text> : null}
      </View>
      <Text style={[
        styles.rowAmount,
        { color: sentByMe ? colors.negative : colors.positive },
      ]}>
        {sentByMe ? '−' : '+'}{formatAmount(item.amount)}
      </Text>
    </View>
  );
}

export default function SettlementsScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { data: settlements = [], isLoading, refetch, isRefetching } = useSettlements();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Icon name="chevronLeft" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Avräkningar</Text>
        <TouchableOpacity
          onPress={() => router.push('/settle')}
          style={styles.headerBtn}
        >
          <Icon name="add" size={24} color={colors.accentFrom} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={settlements}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accentFrom} />
        }
        renderItem={({ item }) => (
          <SettlementRow item={item} currentUserId={profile?.id ?? ''} />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Icon name="swap" size={48} color={colors.textDisabled} weight={1.5} />
              <Text style={styles.emptyTitle}>Inga avräkningar än</Text>
              <Text style={styles.emptySub}>
                När du och din sambo gör en uppgörelse syns den här som historik.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/settle')}
              >
                <Text style={styles.emptyBtnText}>Skapa avräkning</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { padding: spacing.sm, minWidth: 40 },
  title: { fontSize: typography.lg, fontWeight: '700', color: colors.textPrimary },
  content: { padding: spacing.base, paddingBottom: 80 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  iconIn: { backgroundColor: colors.positive + '20' },
  iconOut: { backgroundColor: colors.negative + '20' },
  rowTitle: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  rowMeta: { fontSize: typography.xs, color: colors.textSecondary, marginTop: 2 },
  rowNote: { fontSize: typography.xs, color: colors.textDisabled, marginTop: 2, fontStyle: 'italic' },
  rowAmount: { fontSize: typography.md, fontWeight: '700', letterSpacing: -0.3 },
  sep: { height: spacing.sm },

  empty: { alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: typography.lg, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.sm },
  emptySub: { fontSize: typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.textPrimary,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  emptyBtnText: { fontSize: typography.base, fontWeight: '700', color: colors.bg },
});
