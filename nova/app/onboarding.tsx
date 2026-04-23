import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Dimensions, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, radius } from '@/constants/theme';

const { width } = Dimensions.get('window');

const slides = [
  {
    emoji: '🌌',
    title: 'Välkommen till Nova',
    subtitle: 'Din smarta partner för delad ekonomi — enkelt, rättvist och utan tjafset.',
  },
  {
    emoji: '💸',
    title: 'Spåra tillsammans',
    subtitle: 'Lägg till utgifter, välj delat eller privat, och se alltid vem som är skyldig vad.',
  },
  {
    emoji: '✨',
    title: 'Svep för att sortera',
    subtitle: 'Snabbsortera dina utgifter med en svepning — höger för delat, vänster för privat.',
  },
];

function DemoSwipeCard() {
  const x = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState<'left' | 'right' | null>(null);

  const rotate = x.interpolate({ inputRange: [-150, 0, 150], outputRange: ['-12deg', '0deg', '12deg'] });
  const leftOpacity = x.interpolate({ inputRange: [-100, -20, 0], outputRange: [0.9, 0.3, 0] });
  const rightOpacity = x.interpolate({ inputRange: [0, 20, 100], outputRange: [0, 0.3, 0.9] });

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => x.setValue(gs.dx),
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > 100) {
        Animated.timing(x, { toValue: width, duration: 220, useNativeDriver: true }).start(() => {
          setSwiped('right');
          x.setValue(0);
          setTimeout(() => setSwiped(null), 1200);
        });
      } else if (gs.dx < -100) {
        Animated.timing(x, { toValue: -width, duration: 220, useNativeDriver: true }).start(() => {
          setSwiped('left');
          x.setValue(0);
          setTimeout(() => setSwiped(null), 1200);
        });
      } else {
        Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
      }
    },
  });

  if (swiped) {
    return (
      <View style={demo.swipedWrap}>
        <Text style={[demo.swipedText, { color: swiped === 'right' ? colors.positive : colors.negative }]}>
          {swiped === 'right' ? '✓  Delad!' : '✓  Privat!'}
        </Text>
      </View>
    );
  }

  return (
    <View style={demo.container}>
      <Animated.View
        {...pan.panHandlers}
        style={[demo.card, { transform: [{ translateX: x }, { rotate }] }]}
      >
        <Animated.View style={[demo.hint, demo.hintLeft, { opacity: leftOpacity }]}>
          <Text style={demo.hintText}>← Privat</Text>
        </Animated.View>
        <Animated.View style={[demo.hint, demo.hintRight, { opacity: rightOpacity }]}>
          <Text style={demo.hintText}>Delad →</Text>
        </Animated.View>
        <View style={demo.row}>
          <View style={demo.iconWrap}><Text style={{ fontSize: 22 }}>🍕</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={demo.cardTitle}>Middag</Text>
            <Text style={demo.cardSub}>Igår</Text>
          </View>
          <Text style={demo.cardAmount}>320 kr</Text>
        </View>
      </Animated.View>
      <Text style={demo.label}>← Svep för att testa →</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const [current, setCurrent] = useState(0);
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  function goTo(index: number) {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setCurrent(index);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  async function finish() {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    router.replace('/(auth)/login');
  }

  function next() {
    if (current < slides.length - 1) {
      goTo(current + 1);
    } else {
      finish();
    }
  }

  const slide = slides[current];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <Animated.View
          style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {current === 2 ? (
            <>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
              <DemoSwipeCard />
            </>
          ) : (
            <>
              <Text style={styles.emoji}>{slide.emoji}</Text>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </>
          )}
        </Animated.View>

        <View style={styles.bottom}>
          <View style={styles.dots}>
            {slides.map((_, i) => (
              <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
            ))}
          </View>

          <TouchableOpacity style={styles.btn} onPress={next} activeOpacity={0.85}>
            <Text style={styles.btnText}>
              {current < slides.length - 1 ? 'Nästa' : 'Kom igång'}
            </Text>
          </TouchableOpacity>

          {current < slides.length - 1 && (
            <TouchableOpacity onPress={finish} style={styles.skipBtn}>
              <Text style={styles.skipText}>Hoppa över</Text>
            </TouchableOpacity>
          )}
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: spacing['2xl'], justifyContent: 'space-between', paddingBottom: spacing['2xl'] },

  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  emoji: { fontSize: 72 },
  title: {
    fontSize: typography['3xl'],
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  bottom: { gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.accentFrom },

  btn: {
    backgroundColor: colors.accentFrom,
    borderRadius: radius.full,
    padding: spacing.base,
    alignItems: 'center',
  },
  btnText: { fontSize: typography.base, fontWeight: '700', color: '#fff' },

  skipBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  skipText: { fontSize: typography.sm, color: colors.textDisabled },
});

const demo = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', gap: spacing.sm },
  card: {
    width: width - 48,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', borderRadius: radius.xl,
  },
  hintLeft: { backgroundColor: colors.negative + '40', borderWidth: 2, borderColor: colors.negative },
  hintRight: { backgroundColor: colors.positive + '40', borderWidth: 2, borderColor: colors.positive },
  hintText: { fontSize: typography.lg, fontWeight: '700', color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  cardSub: { fontSize: typography.sm, color: colors.textSecondary },
  cardAmount: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  label: { fontSize: typography.sm, color: colors.textDisabled },
  swipedWrap: {
    width: width - 48, height: 76,
    borderRadius: radius.xl, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  swipedText: { fontSize: typography.base, fontWeight: '700' },
});
