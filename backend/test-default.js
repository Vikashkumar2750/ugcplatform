require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('message_queue').insert({
    account_id: '10f6e614-5cdd-4b66-a981-1bb72e70d7ad',
    user_id: '134edb12-671b-467a-be4a-763d62dda983',
    recipient_id: 'TEST_RECIPIENT_2',
    message_payload: { text: "test" },
    message_type: 'dm',
    status: 'ready',
    // Omit scheduled_send_at intentionally!
  }).select('*').single();

  console.log('Without scheduled_send_at:', data?.scheduled_send_at);

  const { data: d2 } = await supabase.from('message_queue').insert({
    account_id: '10f6e614-5cdd-4b66-a981-1bb72e70d7ad',
    user_id: '134edb12-671b-467a-be4a-763d62dda983',
    recipient_id: 'TEST_RECIPIENT_3',
    message_payload: { text: "test" },
    message_type: 'dm',
    status: 'ready',
    scheduled_send_at: new Date().toISOString()
  }).select('*').single();

  console.log('With scheduled_send_at:', d2?.scheduled_send_at);
}

run();
