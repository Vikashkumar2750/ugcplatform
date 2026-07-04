require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkComment() {
  const { data: logs } = await supabase.from('webhook_raw_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
    
  let commentId = "18087758141112611";
  
  for (const log of (logs || [])) {
    const raw = log.raw_body;
    if (raw?.entry?.[0]?.changes?.[0]?.value?.id === commentId) {
      console.log(JSON.stringify(raw.entry[0].changes[0].value, null, 2));
      break;
    }
  }
}

checkComment();
