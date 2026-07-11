require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: q } = await supabase.from('message_queue').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('--- MESSAGE QUEUE ---');
  console.log(JSON.stringify(q, null, 2));

  const { data: l } = await supabase.from('dm_trigger_log').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('--- TRIGGER LOGS ---');
  console.log(JSON.stringify(l, null, 2));
}

run();
