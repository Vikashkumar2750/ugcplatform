const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'smuserd3@gmail.com');
  const { data: accounts } = await supabase.from('connected_accounts').select('*').eq('user_id', user.id).eq('platform', 'instagram').eq('is_active', true).order('connected_at', { ascending: false });
  console.log('Active IG accounts:', accounts.length);
  for (const acc of accounts) {
    console.log('\nTesting account:', acc.platform_name, acc.id);
    const url = `https://graph.facebook.com/v21.0/${acc.platform_user_id}?fields=id,username,name&access_token=${acc.access_token}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log('Response:', data);
    } catch (e) {
      console.log('Fetch error:', e);
    }
  }
})();
