import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth';

/** Normaliserar svenska Swish-nummer till E.164 (+46...). Returnerar null om tomt. */
export function normalizeSwishPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Behåll bara siffror och +
  const cleaned = trimmed.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);
  if (cleaned.startsWith('0')) return '+46' + cleaned.slice(1);
  if (cleaned.startsWith('46')) return '+' + cleaned;
  return '+46' + cleaned;
}

type ProfileUpdate = {
  display_name?: string;
  swish_phone?: string | null;
};

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user, profile, setProfile } = useAuthStore();

  return useMutation({
    mutationFn: async (updates: ProfileUpdate) => {
      if (!user) throw new Error('Inte inloggad');

      const payload: any = {};
      if (updates.display_name !== undefined) payload.display_name = updates.display_name;
      if (updates.swish_phone !== undefined) payload.swish_phone = updates.swish_phone;

      const { data, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Uppdatera lokal store-representation direkt
      if (profile) setProfile({ ...profile, ...data });
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['household-members'] });
    },
  });
}
