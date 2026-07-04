const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('message_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  console.log(JSON.stringify(data, null, 2));
}

run();
