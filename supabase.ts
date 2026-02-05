
import { createClient } from '@supabase/supabase-js';

// Konfigurasi Database GNOME COMP-TEST DRIVE
const supabaseUrl = 'https://eywjayeilwzwtkqswnfi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5d2pheWVpbHd6d3RrcXN3bmZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MDg1MjAsImV4cCI6MjA4NTQ4NDUyMH0.RZEU8_u5Jfrp_ZP1WVcQV8VbNjG8Yvr005N5ORXWhlE';

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
