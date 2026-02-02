
-- ================================================================
-- 1. CLEANUP (OPTIONAL - ONLY IF YOU WANT FRESH START)
-- DROP PUBLICATION IF EXISTS supabase_realtime;
-- CREATE PUBLICATION supabase_realtime;
-- DROP TABLE IF EXISTS complaints CASCADE;
-- ... (other drops)
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 2. CREATE TABLES IF NOT EXISTS
-- ================================================================

-- A. PENGATURAN (SETTINGS)
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    config JSONB NOT NULL
);

-- B. WARGA (RESIDENTS) - UPDATED
CREATE TABLE IF NOT EXISTS residents (
    id TEXT PRIMARY KEY, 
    house_no TEXT NOT NULL,
    name TEXT NOT NULL,
    rt TEXT NOT NULL,
    rw TEXT NOT NULL,
    phone TEXT,
    initial_meter INTEGER DEFAULT 0,
    initial_arrears BIGINT DEFAULT 0,
    status TEXT DEFAULT 'PEMILIK', 
    -- Fitur Dispensasi & Biaya Lain --
    is_dispensation BOOLEAN DEFAULT FALSE,
    dispensation_note TEXT,
    exemptions TEXT[] DEFAULT '{}', 
    active_custom_fees TEXT[] DEFAULT '{}', 
    -- Auth --
    password TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist if table already existed without them
ALTER TABLE residents ADD COLUMN IF NOT EXISTS is_dispensation BOOLEAN DEFAULT FALSE;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS dispensation_note TEXT;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS exemptions TEXT[] DEFAULT '{}';
ALTER TABLE residents ADD COLUMN IF NOT EXISTS active_custom_fees TEXT[] DEFAULT '{}';

-- C. USERS (SYSTEM USERS) - UPDATED
CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, 
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR', 'RESIDENT')),
    resident_id TEXT REFERENCES residents(id) ON DELETE SET NULL,
    permissions TEXT[] DEFAULT NULL, -- Granular access rights
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure permissions column exists
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT NULL;

-- D. REKENING BANK (BANK ACCOUNTS)
CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    balance BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- E. PENCATATAN METERAN (METER READINGS)
CREATE TABLE IF NOT EXISTS meter_readings (
    id TEXT PRIMARY KEY,
    resident_id TEXT REFERENCES residents(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    meter_value INTEGER NOT NULL,
    prev_meter_value INTEGER NOT NULL,
    usage INTEGER NOT NULL,
    photo_url TEXT,
    operator TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- F. TAGIHAN (BILLS) - UPDATED
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    resident_id TEXT REFERENCES residents(id) ON DELETE CASCADE,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    prev_meter INTEGER DEFAULT 0,
    curr_meter INTEGER DEFAULT 0,
    water_usage INTEGER DEFAULT 0,
    water_cost BIGINT DEFAULT 0,
    ipl_cost BIGINT DEFAULT 0,
    kas_rt_cost BIGINT DEFAULT 0,
    abodemen_cost BIGINT DEFAULT 0,
    extra_cost BIGINT DEFAULT 0,
    arrears BIGINT DEFAULT 0,
    total BIGINT DEFAULT 0,
    status TEXT DEFAULT 'UNPAID' CHECK (status IN ('PAID', 'UNPAID')),
    paid_amount BIGINT DEFAULT 0,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_edit_count INTEGER DEFAULT 0, -- Track payment edits
    meter_photo_url TEXT,
    operator TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure payment_edit_count column exists
ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_edit_count INTEGER DEFAULT 0;

-- G. TRANSAKSI (TRANSACTIONS)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    category TEXT NOT NULL,
    amount BIGINT NOT NULL,
    description TEXT,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'TRANSFER')),
    bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE SET NULL,
    resident_id TEXT REFERENCES residents(id) ON DELETE SET NULL,
    bill_id TEXT REFERENCES bills(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- H. MUTASI BANK (BANK MUTATIONS)
CREATE TABLE IF NOT EXISTS bank_mutations (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('DEBIT', 'KREDIT')),
    amount BIGINT NOT NULL,
    description TEXT,
    reference TEXT
);

-- I. ADUAN & MASUKAN (COMPLAINTS) - NEW TABLE
CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    resident_id TEXT REFERENCES residents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('KELUHAN', 'MASUKAN', 'LAINNYA')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'DONE')),
    admin_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================================
-- 3. SEEDING DATA (OPTIONAL)
-- ================================================================

INSERT INTO app_users (id, username, password, role, permissions) VALUES 
('1', 'admin', 'admin123', 'ADMIN', NULL),
('2', 'operator', 'op123', 'OPERATOR', NULL)
ON CONFLICT (id) DO NOTHING;

-- Seed Settings if empty
INSERT INTO app_settings (config) 
SELECT '{
  "location_name": "GNOME COMP-TEST DRIVE",
  "ipl_base": 145000,
  "kas_rt_base": 20000,
  "water_abodemen": 15000,
  "water_rate_low": 3500,
  "water_rate_high": 4500,
  "extra_fees": [],
  "rtList": ["RT 01", "RT 02", "RT 03", "RT 04", "RT 05", "RT 06"],
  "rwList": ["RW 15"],
  "transactionCategories": [],
  "whatsappTemplates": {}
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM app_settings);

-- ================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ================================================================
DO $$ 
BEGIN
    ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE bank_mutations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Policies (Drop first to avoid errors on re-run)
DROP POLICY IF EXISTS "Enable all access" ON app_settings;
CREATE POLICY "Enable all access" ON app_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON residents;
CREATE POLICY "Enable all access" ON residents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON app_users;
CREATE POLICY "Enable all access" ON app_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON bank_accounts;
CREATE POLICY "Enable all access" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON meter_readings;
CREATE POLICY "Enable all access" ON meter_readings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON bills;
CREATE POLICY "Enable all access" ON bills FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON transactions;
CREATE POLICY "Enable all access" ON transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON bank_mutations;
CREATE POLICY "Enable all access" ON bank_mutations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access" ON complaints;
CREATE POLICY "Enable all access" ON complaints FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- 5. STORAGE BUCKETS
-- ================================================================
insert into storage.buckets (id, name, public)
values ('meter-photos', 'meter-photos', true)
on conflict (id) do nothing;

create policy "Public Access" on storage.objects for select using ( bucket_id = 'meter-photos' );
create policy "Public Upload" on storage.objects for insert with check ( bucket_id = 'meter-photos' );

-- ================================================================
-- 6. REALTIME
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'app_settings') THEN ALTER PUBLICATION supabase_realtime ADD TABLE app_settings; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'residents') THEN ALTER PUBLICATION supabase_realtime ADD TABLE residents; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'app_users') THEN ALTER PUBLICATION supabase_realtime ADD TABLE app_users; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bank_accounts') THEN ALTER PUBLICATION supabase_realtime ADD TABLE bank_accounts; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'meter_readings') THEN ALTER PUBLICATION supabase_realtime ADD TABLE meter_readings; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bills') THEN ALTER PUBLICATION supabase_realtime ADD TABLE bills; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'transactions') THEN ALTER PUBLICATION supabase_realtime ADD TABLE transactions; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bank_mutations') THEN ALTER PUBLICATION supabase_realtime ADD TABLE bank_mutations; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'complaints') THEN ALTER PUBLICATION supabase_realtime ADD TABLE complaints; END IF;
END
$$;
