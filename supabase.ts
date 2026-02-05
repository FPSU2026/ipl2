
import { createClient } from '@supabase/supabase-js';

// Konfigurasi Database GNOME COMP-TEST DRIVE
const supabaseUrl = 'https://ovdlcxrmrxizhmpghbhx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92ZGxjeHJtcnhpemhtcGdoYmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjY4ODcsImV4cCI6MjA4NTgwMjg4N30.qOGKuBBD3OUPpsBbt6DxYPDZSh4YK8Mbv3Bnh8A28KE';

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
