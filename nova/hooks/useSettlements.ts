// hooks/useSettlements.ts
// Lista + skapa avräkningar mellan hushållets medlemmar.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';

export type SettlementMethod = 'manual' | 'swish' | 'cash' | 'other';

export type Settlement = {
  id: string;
  household_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  method: SettlementMethod;
  note: string | null;
  settled_at: string;
  created_by: string;
  from_profile?: { display_name: string | null; email: string };
  to_profile?: { display_name: string | null; email: string };
};

export function useSettlements() {
  const { household } = useHouseholdStore();

  return useQuery({
    queryKey: ['settlements', household?.id],
    enabled: !!household?.id,
    queryFn: async (): Promise<Settlement[]> => {
      if (!household) return [];
      const { data, error } = await supabase
        .from('settlements')
        .select(`
          *,
          from_profile:profiles!settlements_from_user_fkey(display_name, email),
          to_profile:profiles!settlements_to_user_fkey(display_name, email)
        `)
        .eq('household_id', household.id)
        .order('settled_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Settlement[];
    },
  });
}

type CreateSettlement = {
  amount: number;
  method?: SettlementMethod;
  note?: string;
  /** Vem ska ta emot? Default: motparten i hushållet. */
  toUserId?: string;
};

export function useCreateSettlement() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { household, members } = useHouseholdStore();

  return useMutation({
    mutationFn: async ({ amount, method = 'manual', note, toUserId }: CreateSettlement) => {
      if (!user) throw new Error('Inte inloggad');
      if (!household) throw new Error('Inget hushåll');
      const partner = members.find((m) => m.user_id !== user.id);
      const recipient = toUserId ?? partner?.user_id;
      if (!recipient) throw new Error('Hittade ingen mottagare');

      const { data, error } = await supabase
        .from('settlements')
        .insert({
          household_id: household.id,
          from_user: user.id,
          to_user: recipient,
          amount,
          method,
          note: note ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements'] });
      qc.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}
