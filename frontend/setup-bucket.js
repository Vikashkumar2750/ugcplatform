const { createClient } = require("@supabase/supabase-js");

const supabase = createClient("https://efrxmkidupynwmnqhcfx.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcnhta2lkdXB5bndtbnFoY2Z4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg4MDc4MCwiZXhwIjoyMDk1NDU2NzgwfQ.7nGLIXLbYLZZ1q9VYQaeroOnG8ElpRz97Myt1dVF1Zs");

async function setupBucket() {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;
    
    let bucketExists = buckets.find(b => b.name === "post-media");
    if (!bucketExists) {
      console.log("Creating post-media bucket...");
      const { error: createError } = await supabase.storage.createBucket("post-media", {
        public: true,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "video/mp4", "video/quicktime"],
        fileSizeLimit: 104857600 // 100MB
      });
      if (createError) throw createError;
      console.log("Bucket created successfully.");
    } else {
      console.log("Bucket already exists. Updating to public...");
      await supabase.storage.updateBucket("post-media", {
        public: true,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "video/mp4", "video/quicktime"],
        fileSizeLimit: 104857600
      });
    }

    console.log("Done.");
  } catch (e) {
    console.error("Error:", e);
  }
}

setupBucket();
