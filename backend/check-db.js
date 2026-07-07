require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('connected_accounts').select('*').eq('platform', 'instagram').limit(5);
  console.log(JSON.stringify(data, null, 2));
}
check();
