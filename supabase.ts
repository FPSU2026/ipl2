
import { createClient } from '@supabase/supabase-js';

// Konfigurasi Database GNOME COMP-TEST DRIVE
const supabaseUrl = 'https://kisajncljmhrtzuztntu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpc2FqbmNsam1ocnR6dXp0bnR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjgyNDQsImV4cCI6MjA4NTgwNDI0NH0.rHBlyjLYEys0ztdhPvTUdLoBgrc2ApE86q80CVN_1JM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  }
});
