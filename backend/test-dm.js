require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testDM() {
  const { data: accounts } = await supabase.from('connected_accounts').select('*').eq('platform', 'instagram').eq('is_active', true).limit(1);
  if (!accounts || accounts.length === 0) return console.log('No active IG account found');
  
  const account = accounts[0];
  const token = account.access_token;
  
  const { data: msgs } = await supabase.from('message_queue')
    .select('recipient_id')
    .eq('message_type', 'private_reply')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (!msgs || msgs.length === 0) return console.log("No private reply in message_queue.");
  
  const commentId = msgs[0].recipient_id;
  
  console.log(`Testing Private Reply to Comment ID: ${commentId}`);
  console.log(`Using IG User ID: ${account.platform_user_id}`);
  
  // Test 1: Using igUserId
  const res1 = await fetch(`https://graph.facebook.com/v21.0/${account.platform_user_id}/messages?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: "Test reply using igUserId" }
    })
  });
  console.log("IG User ID Result:", await res1.json());
  
  console.log(`Using FB Page ID: ${account.page_id}`);
  // Test 2: Using pageId
  const res2 = await fetch(`https://graph.facebook.com/v21.0/${account.page_id}/messages?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: "Test reply using pageId" }
    })
  });
  console.log("FB Page ID Result:", await res2.json());
}

testDM();
