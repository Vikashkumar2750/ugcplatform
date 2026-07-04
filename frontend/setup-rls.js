const { createClient } = require("@supabase/supabase-js");

const supabase = createClient("https://efrxmkidupynwmnqhcfx.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcnhta2lkdXB5bndtbnFoY2Z4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg4MDc4MCwiZXhwIjoyMDk1NDU2NzgwfQ.7nGLIXLbYLZZ1q9VYQaeroOnG8ElpRz97Myt1dVF1Zs");

async function setupRLS() {
  try {
    const { data, error } = await supabase.rpc("exec_sql", {
      sql_string: `
        CREATE POLICY "Allow authenticated users to insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-media');
        CREATE POLICY "Allow authenticated users to select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'post-media');
      `
    });
    // This will likely fail if we don't have exec_sql RPC. But if we can't do exec_sql, we're stuck unless we make the API call via pg.
    console.log("SQL Exec result:", data, error);
  } catch (e) {
    console.error("Error:", e);
  }
}

setupRLS();
