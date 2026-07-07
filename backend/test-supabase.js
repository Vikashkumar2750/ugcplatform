require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSupabase() {
  const { data, error } = await supabase
    .from("user_settings")
    .select("api_keys")
    .eq("user_id", "invalid_id")
    .single();

  console.log("Data:", data);
  console.log("Error:", error);
}

testSupabase();
