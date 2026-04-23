// ─── Auth ────────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

// ─── Hushåll ─────────────────────────────────────────────────────────────────

export type Household = {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  created_at: string;
};

export type HouseholdMember = {
  household_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
};

// ─── Kategorier ──────────────────────────────────────────────────────────────

export type Category = {
  id: string;
  name: string;
  icon: string;       // emoji eller icon-namn
  color: string;      // hex
  is_default: boolean;
  household_id: string | null; // null = global default
};

// ─── Utgifter ────────────────────────────────────────────────────────────────

export type SplitType = '50/50' | 'custom';

export type Expense = {
  id: string;
  household_id: string | null;
  amount: number;           // i SEK (örens precision: 2)
  category_id: string | null;
  date: string;             // ISO 8601
  description: string | null;
  paid_by: string;          // user_id
  is_shared: boolean;
  split_type: SplitType;
  split_ratio: number;      // andel för paid_by (0–1), t.ex. 0.5 = 50/50
  is_recurring: boolean;
  recurring_id: string | null;
  reviewed: boolean;
  currency?: string;        // default 'SEK' (satt av DB)
  source_hash?: string;     // för CSV-importdubblettdetektering
  updated_at: string | null;
  updated_by: string | null;
  created_at: string;
  category?: Category;
  payer?: Profile;
};

export type CreateExpenseInput = Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'updated_by' | 'category' | 'payer'>;

// ─── Återkommande utgifter ───────────────────────────────────────────────────

export type RecurringFrequency = 'monthly' | 'weekly' | 'yearly';

export type RecurringExpense = {
  id: string;
  household_id: string | null;
  amount: number;
  category_id: string | null;
  description: string | null;
  paid_by: string;
  is_shared: boolean;
  split_type: SplitType;
  split_ratio: number;
  frequency: RecurringFrequency;
  next_due_date: string;
  created_at: string;
};

// ─── Avräkningar ─────────────────────────────────────────────────────────────

export type Settlement = {
  id: string;
  household_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  note: string | null;
  settled_at: string;
};

// ─── UI-hjälptyper ───────────────────────────────────────────────────────────

export type Balance = {
  owedToMe: number;       // positiv = jag ska ha pengar
  iOwe: number;           // positiv = jag är skyldig
  net: number;            // positiv = jag får tillbaka, negativ = jag är skyldig
  counterpart: Profile | null;
};
