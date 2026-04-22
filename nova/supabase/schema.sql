-- ============================================================
-- Nova – databassschema
-- Kör detta i Supabase: SQL Editor → New query → klistra in → Run
-- ============================================================

-- ─── Profiler ────────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  display_name TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Skapar automatiskt en profil när en ny användare registrerar sig
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Hushåll ─────────────────────────────────────────────────
CREATE TABLE households (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE household_members (
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (household_id, user_id)
);

-- ─── Kategorier ──────────────────────────────────────────────
CREATE TABLE categories (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  icon         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#8E8E93',
  is_default   BOOLEAN DEFAULT FALSE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categories (name, icon, color, is_default) VALUES
  ('Mat & dryck',       '🛒', '#34C759', TRUE),
  ('Hyra & boende',     '🏠', '#007AFF', TRUE),
  ('Transport',         '🚗', '#FF9F0A', TRUE),
  ('Nöje',              '🎬', '#AF52DE', TRUE),
  ('Hälsa',             '💊', '#FF453A', TRUE),
  ('Kläder',            '👕', '#FF2D55', TRUE),
  ('Prenumerationer',   '📱', '#5AC8FA', TRUE),
  ('Restaurang',        '🍽️', '#FF6B35', TRUE),
  ('Övrigt',            '📦', '#8E8E93', TRUE);

-- ─── Utgifter ────────────────────────────────────────────────
CREATE TABLE expenses (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  amount       DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  description  TEXT,
  paid_by      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_shared    BOOLEAN DEFAULT FALSE,
  split_type   TEXT DEFAULT '50/50' CHECK (split_type IN ('50/50', 'custom')),
  split_ratio  DECIMAL(4,3) DEFAULT 0.5 CHECK (split_ratio >= 0 AND split_ratio <= 1),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_id UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Avräkningar ─────────────────────────────────────────────
CREATE TABLE settlements (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE NOT NULL,
  from_user    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_user      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount       DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  note         TEXT,
  settled_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE households        ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements       ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Egen profil: läsa"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Egen profil: uppdatera" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Sambopar ska kunna se varandras namn
CREATE POLICY "Hushållsmedlem: se profiler" ON profiles FOR SELECT
  USING (id IN (
    SELECT user_id FROM household_members
    WHERE household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  ));

-- households
CREATE POLICY "Hushåll: se eget" ON households FOR SELECT
  USING (id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "Hushåll: skapa" ON households FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Hushåll: uppdatera" ON households FOR UPDATE
  USING (created_by = auth.uid());

-- household_members
CREATE POLICY "Hushåll: se medlemmar" ON household_members FOR SELECT
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "Hushåll: gå med" ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Hushåll: lämna" ON household_members FOR DELETE
  USING (user_id = auth.uid());

-- categories
CREATE POLICY "Kategorier: se standard + egna" ON categories FOR SELECT
  USING (
    is_default = TRUE OR
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Kategorier: skapa egna" ON categories FOR INSERT
  WITH CHECK (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));

-- expenses
CREATE POLICY "Utgifter: se egna + delade" ON expenses FOR SELECT
  USING (
    paid_by = auth.uid() OR
    (is_shared = TRUE AND household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    ))
  );
CREATE POLICY "Utgifter: skapa" ON expenses FOR INSERT WITH CHECK (paid_by = auth.uid());
CREATE POLICY "Utgifter: uppdatera egna" ON expenses FOR UPDATE USING (paid_by = auth.uid());
CREATE POLICY "Utgifter: ta bort egna" ON expenses FOR DELETE USING (paid_by = auth.uid());

-- settlements
CREATE POLICY "Avräkningar: se i hushåll" ON settlements FOR SELECT
  USING (household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
CREATE POLICY "Avräkningar: skapa" ON settlements FOR INSERT
  WITH CHECK (from_user = auth.uid());
