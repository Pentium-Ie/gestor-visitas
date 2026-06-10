const SUPABASE_URL = window.SUPABASE_URL || 'https://bygwwnaudkxinytgbmrf.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5Z3d3bmF1ZGt4aW55dGdibXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTE2ODAsImV4cCI6MjA5NjY4NzY4MH0.wseeLbw7MT5_z1ne6zlv55rcVzoJEihZfOlzj5ZxiMs';

const supabase = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
