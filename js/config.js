const CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  GOOGLE_CLIENT_ID: '',
  APP_NAME: 'CCTV Field Tools',
  SYNC_MAX_RETRIES: 5,
  TOMBSTONE_DAYS: 30,
};
let supabaseClient = null;
if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}
