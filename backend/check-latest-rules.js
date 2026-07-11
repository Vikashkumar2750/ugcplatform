require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('automation_rules').select('*').order('created_at', { ascending: false }).limit(3);
  console.log(JSON.stringify(data, null, 2));
}

run();
