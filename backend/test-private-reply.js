require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

async function testPrivateReply() {
  const token = process.env.TEST_PAGE_ACCESS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY; // I need to get the page access token
}
testPrivateReply();
