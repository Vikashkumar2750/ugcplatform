require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('connected_accounts').select('access_token').eq('platform_user_id', '17841478826696086').single();
  const res = await fetch(`https://graph.facebook.com/v21.0/1346873274202634?fields=username&access_token=${data.access_token}`);
  const json = await res.json();
  console.log(json);
}
run();
