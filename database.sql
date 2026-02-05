
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
    deposit BIGINT DEFAULT 0, -- New Column for Overpayment
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
ALTER TABLE residents ADD COLUMN IF NOT EXISTS deposit BIGINT DEFAULT 0;

-- C. USERS (SYSTEM USERS) - UPDATED
CREATE TABLE IF NOT EXISTS app_users (
