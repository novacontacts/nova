import { useMemo } from 'react';
import { useExpenses } from './useExpenses';
import { useAuthStore } from '@/lib/store/auth';
import { Category } from '@/types';

export type CategoryStat = {
  category: Category | null;
  total: number;
  count: number;
  pct: number;
};

export type StatsFilter = 'all' | 'private' | 'shared';

export function useStats(year: number, month: number, filter: StatsFilter = 'all') {
  const { user } = useAuthStore();
  const { data: expenses = [], isError, refetch } = useExpenses();

  return useMemo(() => {
    const monthExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) return false;
      if (filter === 'private') return !e.is_shared;
      if (filter === 'shared') return e.is_shared;
      return true;
    });

    // Bara utgifter jag betalade (för min privatekonomi), men för delade räknar vi min andel
    const total = monthExpenses.reduce((sum, e) => {
      if (e.is_shared) {
        return sum + (e.paid_by === user?.id ? e.amount * e.split_ratio : e.amount * (1 - e.split_ratio));
      }
      return e.paid_by === user?.id ? sum + e.amount : sum;
    }, 0);

    // Gruppera per kategori
    const map = new Map<string, { category: Category | null; total: number; count: number }>();

    for (const e of monthExpenses) {
      if (e.paid_by !== user?.id) continue; // bara egna betalningar
      const key = e.category_id ?? '__none__';
      const existing = map.get(key);
      const amount = e.is_shared ? e.amount * e.split_ratio : e.amount;
      if (existing) {
        existing.total += amount;
        existing.count += 1;
      } else {
        map.set(key, { category: e.category ?? null, total: amount, count: 1 });
      }
    }

    const byCategory: CategoryStat[] = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map((s) => ({ ...s, pct: total > 0 ? s.total / total : 0 }));

    return { total, byCategory, count: monthExpenses.length, isError, refetch };
  }, [expenses, year, month, filter, user?.id, isError, refetch]);
}
