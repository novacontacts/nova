import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
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
          <Text style={styles.emoji}>{slide.emoji}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
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

  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.xl },
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
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.accentFrom,
  },

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
