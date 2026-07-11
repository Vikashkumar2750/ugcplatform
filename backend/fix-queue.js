require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('message_queue')
    .update({ scheduled_send_at: new Date().toISOString() })
    .in('status', ['ready', 'queued'])
    .select('id, scheduled_send_at');
    
  console.log("Updated rows:", data);
}

run();
