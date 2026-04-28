import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth';
import { useHouseholdStore } from '@/lib/store/household';
import { Expense, CreateExpenseInput, Settlement } from '@/types';

async function sendPush(householdId: string, excludeUserId: string, title: string, body: string) {
  try {
    console.log('[sendPush] anropar Edge Function', { householdId, excludeUserId, title });
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: { household_id: householdId, excluded_user_id: excludeUserId, title, body },
    });
    console.log('[sendPush] svar:', data, 'fel:', error);
  } catch (e) {
    console.log('[sendPush] exception:', e);
  }
}

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
  const { user, profile } = useAuthStore();
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      if (data.is_shared && household?.id && user?.id) {
        const name = profile?.display_name ?? 'Din sambo';
        const desc = data.description || 'en utgift';
        const amt = Number(data.amount).toLocaleString('sv-SE', { maximumFractionDigits: 0 });
        sendPush(household.id, user.id, `${name} lade till en utgift`, `${desc} – ${amt} kr`);
      }
    },
  });
}

export function useExpense(id: string | null) {
  return useQuery({
    queryKey: ['expense', id],
    enabled: !!id,
    queryFn: async (): Promise<Expense | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('expenses')
        .select('*, category:categories(id,name,icon,color,is_default,household_id), payer:profiles!paid_by(id,email,display_name,avatar_url,created_at)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as unknown as Expense;
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuthStore();
  const { household } = useHouseholdStore();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Expense> }) => {
      const { error } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      return { id, updates };
    },
    onSuccess: ({ updates }) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      if (updates.is_shared !== false && household?.id && user?.id) {
        const name = profile?.display_name ?? 'Din sambo';
        const desc = updates.description || 'en utgift';
        sendPush(household.id, user.id, `${name} uppdaterade en utgift`, desc);
      }
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
  const { user, profile } = useAuthStore();
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
      return { amount };
    },
    onSuccess: ({ amount }) => {
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      if (household?.id && user?.id) {
        const name = profile?.display_name ?? 'Din sambo';
        const amt = amount.toLocaleString('sv-SE', { maximumFractionDigits: 0 });
        sendPush(household.id, user.id, `${name} betalade ${amt} kr`, 'Avräkningen är uppdaterad.');
      }
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
  // N-person: antal icke-betalande per delad utgift
  const otherCount = Math.max(1, members.length - 1);

  // Bruttobelopp: positivt = andra är skyldiga mig, negativt = jag är skyldig
  let gross = 0;
  for (const e of expenses.filter((e) => e.is_shared)) {
    if (e.paid_by === user?.id) {
      gross += e.amount * (1 - e.split_ratio);           // summan de andra är skyldiga
    } else {
      gross -= (e.amount * (1 - e.split_ratio)) / otherCount; // min andel av vad jag är skyldig
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
