require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const now = new Date().toISOString();
  console.log('Sending this JS timestamp to Supabase:', now);

  const { data, error } = await supabase.from('message_queue').insert({
    account_id: '10f6e614-5cdd-4b66-a981-1bb72e70d7ad',
    user_id: '134edb12-671b-467a-be4a-763d62dda983',
    recipient_id: 'TEST_RECIPIENT',
    message_payload: { text: "test" },
    message_type: 'dm',
    status: 'queued',
    scheduled_send_at: now
  }).select('*').single();

  console.log('Returned from Supabase:', data?.scheduled_send_at);
}

run();
