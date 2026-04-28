import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useHouseholdStore } from '@/lib/store/household';
import { useAuthStore } from '@/lib/store/auth';

export type RecurringExpense = {
  id: string;
  household_id: string;
  title: string;
  amount: number;
  category_id: string | null;
  category: { id: string; name: string; icon: string; color: string } | null;
  day_of_month: number;
  created_by: string;
  is_active: boolean;
  created_at: string;
};

export function useRecurringExpenses() {
  const { household } = useHouseholdStore();

  return useQuery({
    queryKey: ['recurring_expenses', household?.id],
    enabled: !!household?.id,
    queryFn: async (): Promise<RecurringExpense[]> => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*, category:categories(id,name,icon,color)')
        .eq('household_id', household!.id)
        .eq('is_active', true)
        .order('day_of_month', { ascending: true });
      if (error) throw error;
      return (data as unknown as RecurringExpense[]) ?? [];
    },
  });
}

export function useCreateRecurringExpense() {
  const queryClient = useQueryClient();
  const { household } = useHouseholdStore();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (input: { title: string; amount: number; day_of_month: number; category_id?: string }) => {
      const { error } = await supabase.from('recurring_expenses').insert({
        household_id: household!.id,
        created_by: user!.id,
        is_active: true,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] }),
  });
}

export function useDeleteRecurringExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_expenses').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring_expenses'] }),
  });
}
