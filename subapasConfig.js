const SUPABASE_URL = 'https://klniggjdqqbkmtndnoky.supabase.co';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbmlnZ2pkcXFia210bmRub2t5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzE2NTYsImV4cCI6MjA5NTcwNzY1Nn0.CCS3cP8vJ113SZNxGEsXtWQwfWPrwcT7PFzgxZ4bGmE';

window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);