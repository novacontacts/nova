import { useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Linking, Alert, Platform,
} from 'react-native';
import { useHouseholdStore } from '@/lib/store/household';
import { useAuthStore } from '@/lib/store/auth';
import { colors, typography, spacing, radius } from '@/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = {
  visible: boolean;
  onClose: () => void;
  onSettle: () => void;
  amount: number;
  direction: 'owed' | 'owes' | 'even';
};

function formatAmount(n: number) {
  return Math.abs(n).toLocaleString('sv-SE', { maximumFractionDigits: 0 });
}

export function SwishSheet({ visible, onClose, onSettle, amount, direction }: Props) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { profile } = useAuthStore();
  const partner = useHouseholdStore((s) =>
    s.members.find((m) => m.user_id !== profile?.id)?.profile
  );

  // För Swish-länken behöver vi mottagarens nummer:
  // - direction='owes': JAG ska betala sambo → öppna mot sambons nummer
  // - direction='owed': sambo ska betala MIG → vi kan inte öppna en pull-betalning,
  //   men vi visar mitt nummer + delningsknapp så jag kan skicka till sambo.
  const recipient = direction === 'owes' ? partner : profile;
  const recipientPhone = recipient?.swish_phone ?? null;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const swishUrl = useMemo(() => {
    if (!recipientPhone) return null;
    // Konvertera E.164 (+46701234567) → lokal format (0701234567) som Swish förväntar sig
    let payee = recipientPhone.trim();
    if (payee.startsWith('+46')) payee = '0' + payee.slice(3);
    else if (payee.startsWith('0046')) payee = '0' + payee.slice(4);
    payee = payee.replace(/\D/g, '');
    const amt = Math.abs(amount).toFixed(2);
    return `swish://payment?data={"version":1,"payee":{"value":"${payee}","editable":false},"amount":{"value":${amt},"editable":false},"message":{"value":"","editable":true}}`;
  }, [recipientPhone, amount]);

  async function openSwish() {
    if (!swishUrl) return;
    try {
      await Linking.openURL(swishUrl);
    } catch {
      Alert.alert(
        'Swish hittades inte',
        'Installera Swish-appen från App Store för att öppna betalningen direkt.',
      );
    }
  }

  if (!visible && (slideAnim as any)._value === SCREEN_HEIGHT) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.swishBadge}>
            <Text style={styles.swishMark}>Swish</Text>
          </View>
          <Text style={styles.amountLabel}>
            {direction === 'owes' ? 'Du ska betala' : direction === 'owed' ? 'Du får tillbaka' : 'Allt är jämnt'}
          </Text>
          <Text style={styles.amountValue}>{formatAmount(amount)} kr</Text>
          {partner && (
            <Text style={styles.partnerName}>
              {direction === 'owes' ? 'till' : 'från'} {partner.display_name ?? 'din sambo'}
            </Text>
          )}
        </View>

        {/* Mottagare */}
        {recipient && (
          <View style={styles.recipientCard}>
            <View style={styles.recipientAvatar}>
              <Text style={styles.recipientInitial}>
                {(recipient.display_name ?? '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recipientLabel}>
                {direction === 'owes' ? 'Mottagare' : 'Ditt Swish-nummer'}
              </Text>
              <Text style={styles.recipientName}>{recipient.display_name ?? 'Okänd'}</Text>
              <Text style={[
                styles.recipientPhone,
                !recipientPhone && { color: colors.warning },
              ]}>
                {recipientPhone ?? 'Inget Swish-nummer'}
              </Text>
            </View>
          </View>
        )}

        {/* Saknat nummer */}
        {!recipientPhone && (
          <View style={styles.warning}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.warningText}>
                {direction === 'owes'
                  ? `${partner?.display_name ?? 'Sambo'} har inte angivit Swish-nummer än. Be hen lägga till det i Inställningar.`
                  : 'Lägg till ditt Swish-nummer i Inställningar så vi kan förifylla mottagare när du Swishas.'}
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {direction === 'owes' && recipientPhone && (
            <TouchableOpacity style={styles.primaryBtn} onPress={openSwish} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Öppna Swish</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.secondaryBtn, !recipientPhone && styles.primaryBtn]}
            onPress={onSettle}
            activeOpacity={0.85}
          >
            <Text style={[
              styles.secondaryBtnText,
              !recipientPhone && styles.primaryBtnText,
            ]}>
              Markera som betald
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Avbryt</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['2xl'],
    gap: spacing.lg,
  },
  handle: {
    alignSelf: 'center', width: 44, height: 5, borderRadius: 3,
    backgroundColor: colors.border, marginBottom: spacing.xs,
  },

  hero: { alignItems: 'center', gap: 6 },
  swishBadge: {
    backgroundColor: '#1F1F1F',
    borderWidth: 2, borderColor: '#EF6C00',
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  swishMark: { color: '#EF6C00', fontSize: typography.sm, fontWeight: '800', letterSpacing: 0.5 },
  amountLabel: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '500' },
  amountValue: { fontSize: 56, fontWeight: '700', color: colors.textPrimary, letterSpacing: -1.5 },
  partnerName: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 2 },

  recipientCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.base, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  recipientAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accentFrom + '25',
    alignItems: 'center', justifyContent: 'center',
  },
  recipientInitial: { fontSize: typography.lg, fontWeight: '700', color: colors.accentFrom },
  recipientLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  recipientName: { fontSize: typography.base, color: colors.textPrimary, fontWeight: '600', marginTop: 2 },
  recipientPhone: { fontSize: typography.sm, color: colors.textSecondary, marginTop: 1 },

  warning: {
    flexDirection: 'row', gap: spacing.sm,
    backgroundColor: colors.warning + '15',
    borderRadius: radius.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.warning + '40',
  },
  warningIcon: { fontSize: 16 },
  warningText: { flex: 1, fontSize: typography.sm, color: colors.textPrimary, lineHeight: 20 },

  actions: { gap: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: typography.base, fontWeight: '700', color: colors.bg },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  cancelBtn: { paddingVertical: spacing.sm, alignItems: 'center' },
  cancelText: { fontSize: typography.sm, color: colors.textSecondary },
});
