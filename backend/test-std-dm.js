require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testStandardDM() {
  const { data: accounts } = await supabase.from('connected_accounts').select('*').eq('platform', 'instagram').eq('is_active', true).limit(1);
  if (!accounts || accounts.length === 0) return console.log('No active IG account found');
  
  const account = accounts[0];
  const token = account.access_token;
  
  // The user's Instagram Scoped ID (IGSID)
  // We need an IGSID of a user who messaged the account.
  // We can just try to DM the account itself (which often fails but gives a different error).
  const igsid = account.platform_user_id; 
  
  console.log(`Testing Standard DM to IGSID: ${igsid}`);
  
  // Standard DM endpoint for Instagram is /me/messages with the IG User ID
  // Wait! The documentation says: POST /me/messages (but me resolves to the Facebook Page!)
  // If we send to the Facebook Page's /me/messages, does it go to IG?
  // Let's test /me/messages using the IG token (which is the page token).
  
  const res1 = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text: "Testing standard DM to myself" }
    })
  });
  console.log("me/messages Result:", await res1.json());
  
  const res2 = await fetch(`https://graph.facebook.com/v21.0/${account.platform_user_id}/messages?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text: "Testing standard DM to myself via IG ID" }
    })
  });
  console.log("igUserId/messages Result:", await res2.json());
}

testStandardDM();
