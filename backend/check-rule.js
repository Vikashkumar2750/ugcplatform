require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('automation_rules').select('*').eq('id', '094f0b21-282d-4289-9e2e-81c1575b02a8').single();
  console.log(JSON.stringify(data, null, 2));
}

run();
