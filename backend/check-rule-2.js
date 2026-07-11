require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('automation_rules').select('*').eq('id', 'eb74bb00-c08a-4ac8-bae3-a826dd0aac12').single();
  console.log(JSON.stringify(data, null, 2));
}

run();
