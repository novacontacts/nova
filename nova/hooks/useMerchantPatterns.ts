import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth';

export type MerchantPattern = {
  id: string;
  user_id: string;
  pattern: string;
  category_id: string;
  hit_count: number;
};

export function useMerchantPatterns() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['merchant_patterns', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MerchantPattern[]> => {
      const { data, error } = await supabase
        .from('merchant_patterns')
        .select('*')
        .order('hit_count', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordMerchantPattern() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  return useMutation({
    mutationFn: async ({ pattern, category_id }: { pattern: string; category_id: string }) => {
      const { error } = await supabase.rpc('upsert_merchant_pattern', {
        p_pattern: pattern.toLowerCase().trim(),
        p_category_id: category_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant_patterns', user?.id] });
    },
  });
}
