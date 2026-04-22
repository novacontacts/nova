import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { Expense, CreateExpenseInput, Settlement } from '@/types';

export function useExpenses() {
  const { user } = useAuthStore();
  const { household } = useHouseholdStore();

  return useQuery({
    queryKey: ['expenses', user?.id, household?.id],
    enabled: !!user,
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, category:categories(id,name,icon,color,is_default,household_id), payer:profiles!paid_by(id,email,display_name,avatar_url,created_at)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Expense[]) ?? [];
    },
  });
}

export function useAddExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { household } = useHouseholdStore();

  return useMutation({
    mutationFn: async (input: Omit<CreateExpenseInput, 'paid_by' | 'household_id'>) => {
      const payload: CreateExpenseInput = {
        ...input,
        paid_by: user!.id,
        household_id: input.is_shared ? (household?.id ?? null) : null,
      };
      const { data, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const { household } = useHouseholdStore();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Expense> }) => {
      const { error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

function useSettlements() {
  const { household } = useHouseholdStore();

  return useQuery({
    queryKey: ['settlements', household?.id],
    enabled: !!household?.id,
    queryFn: async (): Promise<Settlement[]> => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('household_id', household!.id)
        .order('settled_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateSettlement() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { household } = useHouseholdStore();

  return useMutation({
    mutationFn: async ({ amount, fromUser, toUser }: { amount: number; fromUser: string; toUser: string }) => {
      const { error } = await supabase.from('settlements').insert({
        household_id: household!.id,
        from_user: fromUser,
        to_user: toUser,
        amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

// Beräknar nettosaldo mot partner (inkl. avräkningar)
export function useBalance() {
  const { user } = useAuthStore();
  const { members } = useHouseholdStore();
  const { data: expenses = [] } = useExpenses();
  const { data: settlements = [] } = useSettlements();

  const partner = members.find((m) => m.user_id !== user?.id);

  // Bruttobelopp från delade utgifter
  let gross = 0; // positivt = partner är skyldig mig, negativt = jag är skyldig partner
  for (const e of expenses.filter((e) => e.is_shared)) {
    if (e.paid_by === user?.id) {
      gross += e.amount * (1 - e.split_ratio); // partners andel
    } else {
      gross -= e.amount * e.split_ratio;        // min andel
    }
  }

  // Dra av avräkningar
  for (const s of settlements) {
    if (s.from_user === user?.id) {
      gross += s.amount; // jag betalade → jag är mindre skyldig
    } else if (s.to_user === user?.id) {
      gross -= s.amount; // partner betalade till mig → de är mindre skyldiga
    }
  }

  return { net: gross, partner: partner?.profile ?? null };
}
