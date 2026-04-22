import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useHouseholdStore } from '@/lib/store/household';
import { colors, typography, spacing, radius } from '@/constants/theme';

const EMOJI_SUGGESTIONS = ['🍕','🏋️','✈️','🎮','🐶','💇','🌿','🏊','📚','🎵','🍷','🎨','🏡','🛋️','🌍','💡','🎁','🧹','💻','🏦'];
const COLOR_OPTIONS = ['#34C759','#007AFF','#FF9F0A','#AF52DE','#FF453A','#FF2D55','#5AC8FA','#FF6B35','#8E8E93','#30B0C7','#32ADE6','#64D2FF'];

export default function AddCategoryScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { household } = useHouseholdStore();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('categories').insert({
        name: name.trim(),
        icon: icon || '📦',
        color,
        is_default: false,
        household_id: household!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      router.back();
    },
  });

  function handleSave() {
    if (!name.trim()) { setError('Ange ett namn.'); return; }
    if (!household) { setError('Du måste vara med i ett hushåll.'); return; }
    setError('');
    create.mutate();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancel}>Avbryt</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Ny kategori</Text>
          <TouchableOpacity onPress={handleSave} disabled={create.isPending}>
            {create.isPending
              ? <ActivityIndicator color={colors.accentFrom} size="small" />
              : <Text style={styles.save}>Spara</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Förhandsgranskning */}
          <View style={styles.preview}>
            <View style={[styles.previewChip, { borderColor: color }]}>
              <Text style={styles.previewIcon}>{icon || '📦'}</Text>
              <Text style={[styles.previewName, { color }]}>{name || 'Kategorinamn'}</Text>
            </View>
          </View>

          {/* Namn */}
          <Text style={styles.label}>Namn</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="t.ex. Husdjur, Gym, Prenumerationer..."
            placeholderTextColor={colors.textDisabled}
            selectionColor={colors.accentFrom}
            autoCapitalize="sentences"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Emoji */}
          <Text style={styles.label}>Ikon</Text>
          <TextInput
            style={[styles.input, styles.emojiInput]}
            value={icon}
            onChangeText={(t) => setIcon(t.slice(-2))}
            placeholder="Klistra in emoji eller välj nedan"
            placeholderTextColor={colors.textDisabled}
            selectionColor={colors.accentFrom}
          />
          <View style={styles.emojiGrid}>
            {EMOJI_SUGGESTIONS.map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.emojiBtn, icon === e && styles.emojiBtnActive]}
                onPress={() => setIcon(e)}
                activeOpacity={0.7}
              >
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Färg */}
          <Text style={styles.label}>Färg</Text>
          <View style={styles.colorGrid}>
            {COLOR_OPTIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
                onPress={() => setColor(c)}
                activeOpacity={0.7}
              />
            ))}
          </View>

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
  cancel: { fontSize: typography.base, color: colors.textSecondary },
  title: { fontSize: typography.base, fontWeight: '600', color: colors.textPrimary },
  save: { fontSize: typography.base, fontWeight: '600', color: colors.accentFrom },

  content: { padding: spacing.base, gap: spacing.lg },
  label: { fontSize: typography.sm, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  preview: { alignItems: 'center', paddingVertical: spacing.md },
  previewChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.full, paddingHorizontal: spacing.base, paddingVertical: spacing.sm,
    borderWidth: 1.5, backgroundColor: colors.surface,
  },
  previewIcon: { fontSize: 20 },
  previewName: { fontSize: typography.base, fontWeight: '600' },

  input: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: spacing.md,
    height: 52, fontSize: typography.base, color: colors.textPrimary,
  },
  emojiInput: { fontSize: 22 },
  error: { fontSize: typography.sm, color: colors.negative },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiBtn: {
    width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  emojiBtnActive: { borderColor: colors.accentFrom, backgroundColor: colors.surfaceRaised },
  emojiText: { fontSize: 22 },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: colors.textPrimary },
});
