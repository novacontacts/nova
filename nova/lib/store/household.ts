import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Household, Profile } from '@/types';

type Member = { user_id: string; joined_at: string; profile: Profile };

type HouseholdStore = {
  household: Household | null;
  members: Member[];
  loading: boolean;
  fetchHousehold: (userId: string) => Promise<void>;
  createHousehold: (name: string, userId: string) => Promise<string | null>;
  joinHousehold: (inviteCode: string, userId: string) => Promise<string | null>;
  reset: () => void;
};

export const useHouseholdStore = create<HouseholdStore>((set) => ({
  household: null,
  members: [],
  loading: false,

  fetchHousehold: async (userId) => {
    set({ loading: true });
    const { data } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (!data) {
      set({ household: null, members: [], loading: false });
      return;
    }

    const { data: household } = await supabase
      .from('households')
      .select('*')
      .eq('id', data.household_id)
      .single();

    const { data: members } = await supabase
      .from('household_members')
      .select('user_id, joined_at, profile:profiles(id, email, display_name, avatar_url, created_at)')
      .eq('household_id', data.household_id);

    set({
      household: household ?? null,
      members: (members as unknown as Member[]) ?? [],
      loading: false,
    });
  },

  createHousehold: async (name, userId) => {
    const { data: household, error } = await supabase
      .from('households')
      .insert({ name: name.trim(), created_by: userId })
      .select()
      .single();

    if (error || !household) return error?.message ?? 'Kunde inte skapa hushållet.';

    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: household.id, user_id: userId });

    if (memberError) return memberError.message;

    set({ household, members: [] });
    return null;
  },

  joinHousehold: async (inviteCode, _userId) => {
    const { data, error } = await supabase
      .rpc('join_household_by_code', { p_invite_code: inviteCode.trim() });

    if (error) {
      if (error.message.includes('Ingen kod matchar')) return 'Ingen kod matchar. Kontrollera att du skrivit rätt.';
      if (error.message.includes('duplicate') || error.code === '23505') return 'Du är redan med i det här hushållet.';
      return error.message;
    }

    set({ household: data as Household });
    return null;
  },

  reset: () => set({ household: null, members: [] }),
}));
