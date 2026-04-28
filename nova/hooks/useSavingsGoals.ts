import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useHouseholdStore } from '@/lib/store/household';
import { useAuthStore } from '@/lib/store/auth';

export type SavingsGoal = {
  id: string;
  household_id: string;
  title: string;
  emoji: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  created_by: string;
  created_at: string;
};

export function useSavingsGoals() {
  const { household } = useHouseholdStore();

  return useQuery({
    queryKey: ['savings_goals', household?.id],
    enabled: !!household?.id,
    queryFn: async (): Promise<SavingsGoal[]> => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('household_id', household!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSavingsGoal() {
  const queryClient = useQueryClient();
  const { household } = useHouseholdStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: { title: string; emoji: string; target_amount: number; deadline?: string }) => {
      const { error } = await supabase.from('savings_goals').insert({
        household_id: household!.id,
        created_by: user!.id,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savings_goals'] }),
  });
}

export function useAddToSavingsGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, amount, current }: { id: string; amount: number; current: number }) => {
      const { error } = await supabase
        .from('savings_goals')
        .update({ current_amount: current + amount })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savings_goals'] }),
  });
}

export function useDeleteSavingsGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savings_goals'] }),
  });
}
