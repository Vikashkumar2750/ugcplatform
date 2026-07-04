require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testDMToRealUser() {
  const { data: accounts } = await supabase.from('connected_accounts').select('*').eq('platform', 'instagram').eq('is_active', true).limit(1);
  if (!accounts || accounts.length === 0) return console.log('No active IG account found');
  
  const account = accounts[0];
  const token = account.access_token;
  
  // Get a REAL IGSID from the webhook logs (someone who commented recently)
  const { data: msgs } = await supabase.from('message_queue')
    .select('recipient_id')
    .eq('message_type', 'private_reply')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (!msgs || msgs.length === 0) return console.log("No recipient IDs found.");
  
  for (const msg of msgs) {
    const commentId = msg.recipient_id;
    console.log(`\nTesting Private Reply to Comment ID: ${commentId}`);
    
    // We must use page_id or me/messages for Private Reply based on previous findings
    const res = await fetch(`https://graph.facebook.com/v21.0/${account.page_id}/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: "Testing DM functionality from API!" }
      })
    });
    
    const data = await res.json();
    console.log("Result:", data);
  }
}

testDMToRealUser();
