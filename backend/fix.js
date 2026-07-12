require('dotenv').config({path: '.env'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const res = await supabase.rpc('execute_sql', { sql_query: "ALTER TABLE scheduled_posts DROP CONSTRAINT IF EXISTS scheduled_posts_content_type_check;" });
  console.log(res);
}
run();
