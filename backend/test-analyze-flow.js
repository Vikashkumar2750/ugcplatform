require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    console.log("1. Authenticating as smuserd3@gmail.com...");
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'smuserd3@gmail.com',
      password: 'test@123',
    });
    
    if (authErr) throw authErr;
    const token = authData.session.access_token;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    
    const profileUrl = 'https://instagram.com/techaasvik';
    const platform = 'instagram';
    const niche = 'tech';
    const language = 'en';

    console.log("2. Running Audit...");
    const auditRes = await fetch('http://localhost:3001/api/analyze/audit', {
      method: 'POST', headers,
      body: JSON.stringify({ profileUrl, platform, niche, language })
    });
    const auditData = await auditRes.json();
    console.log("Audit Success:", auditData.success);
    console.log("Audit Fields Exists:", !!auditData.audit);
    if (auditData.audit) {
        console.log("Weak Content Areas:", auditData.audit.weak_content_areas);
        console.log("CTA Insights:", auditData.audit.cta_insights);
        console.log("Content Gaps:", auditData.audit.content_gaps);
        console.log("Viral Hook Suggestions:", auditData.audit.viral_hook_suggestions);
    }

    console.log("3. Running Competitors...");
    const compRes = await fetch('http://localhost:3001/api/analyze/competitors', {
      method: 'POST', headers,
      body: JSON.stringify({ profileUrl, platform, niche, language, competitors: [] })
    });
    const compData = await compRes.json();
    console.log("Competitors Success:", compData.success);
    console.log("Competitors Count:", compData.competitors?.length);

    console.log("4. Running Trends...");
    const trendsRes = await fetch('http://localhost:3001/api/analyze/trends', {
      method: 'POST', headers,
      body: JSON.stringify({ profileUrl, platform, niche, language, competitors: [] })
    });
    const trendsData = await trendsRes.json();
    console.log("Trends Success:", trendsData.success);
    console.log("Trends Exists:", !!trendsData.trends);

    console.log("5. Running Pipeline...");
    const pipeRes = await fetch('http://localhost:3001/api/analyze/pipeline', {
      method: 'POST', headers,
      body: JSON.stringify({ profileUrl, platform, niche, language, competitors: [], growthStrategy: [] })
    });
    const pipeData = await pipeRes.json();
    console.log("Pipeline Success:", pipeData.success);
    console.log("Pipeline Exists:", !!pipeData.pipeline);
    
    console.log("6. Saving Full Analysis...");
    const saveRes = await fetch('http://localhost:3001/api/analyze/save', {
      method: 'POST', headers,
      body: JSON.stringify({
        profileUrl,
        platform,
        niche,
        auditData: auditData.audit,
        competitorsData: compData.competitors,
        trendsData: trendsData.trends,
        pipelineData: pipeData.pipeline
      })
    });
    const saveData = await saveRes.json();
    console.log("Save Success:", saveData.success, "ID:", saveData.analysisId);

  } catch(e) {
    console.error("Test failed:", e);
  }
}
run();
