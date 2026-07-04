require("dotenv").config({ path: "./frontend/.env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
