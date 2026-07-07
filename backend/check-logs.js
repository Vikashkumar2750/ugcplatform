require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: dmLogs } = await supabase.from('dm_trigger_log').select('*').order('triggered_at', { ascending: false }).limit(5);
  console.log("DM Logs:", JSON.stringify(dmLogs, null, 2));

  const { data: queueLogs } = await supabase.from('message_queue').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Queue Logs:", JSON.stringify(queueLogs, null, 2));
}
check();
