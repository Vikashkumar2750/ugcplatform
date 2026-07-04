const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://efrxmkidupynwmnqhcfx.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcnhta2lkdXB5bndtbnFoY2Z4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg4MDc4MCwiZXhwIjoyMDk1NDU2NzgwfQ.7nGLIXLbYLZZ1q9VYQaeroOnG8ElpRz97Myt1dVF1Zs");

async function testSignedUrl() {
  const { data, error } = await supabase.storage.from("post-media").createSignedUploadUrl("test/upload.mp4");
  console.log(data, error);
}

testSignedUrl();
