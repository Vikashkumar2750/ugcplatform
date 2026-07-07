require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('webhook_events').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Webhooks:", JSON.stringify(data, null, 2));
}
check();
