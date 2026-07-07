require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testCache() {
  const profileUrl = 'https://instagram.com/techaasvik';
  
  // Try to find a cached analysis from the last 7 days
  const { data, error } = await supabase
    .from('analysis_results')
    .select('id, created_at, result')
    .eq('user_id', '5e1e79bc-2d12-429f-a2e6-a059b8d276d1') // smuserd3
    .filter('result->>profileUrl', 'eq', profileUrl)
    .filter('result->>type', 'eq', 'full')
    .order('created_at', { ascending: false })
    .limit(1);
    
  console.log(error ? "Error: " + error.message : "Data:", data?.map(d => ({ id: d.id, date: d.created_at })));
}
testCache();
