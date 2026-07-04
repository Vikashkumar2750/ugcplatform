"use strict";
/**
 * encrypt-existing-tokens.ts — One-time migration script
 *
 * Encrypts all plaintext access_token and refresh_token values
 * in the connected_accounts table using AES-256-GCM.
 *
 * USAGE:
 *   cd backend
 *   npx ts-node src/scripts/encrypt-existing-tokens.ts
 *
 * SAFETY:
 * - Idempotent: already-encrypted tokens (format iv:tag:cipher) are skipped
 * - Dry-run mode by default: set DRY_RUN=false to actually write
 * - Logs every action for audit
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_js_1 = require("@supabase/supabase-js");
const crypto_1 = require("../services/crypto");
const DRY_RUN = process.env.DRY_RUN !== "false";
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
function isAlreadyEncrypted(value) {
    // Encrypted tokens have the format: iv_hex:tag_hex:cipher_hex
    // Each part is exactly 32 hex chars (16 bytes) for iv and tag
    const parts = value.split(":");
    if (parts.length !== 3)
        return false;
    // iv = 32 hex chars, tag = 32 hex chars, cipher = variable
    return parts[0].length === 32 && parts[1].length === 32 && /^[0-9a-f]+$/i.test(parts[0]);
}
async function main() {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  Token Encryption Migration");
    console.log(`  Mode: ${DRY_RUN ? "DRY RUN (set DRY_RUN=false to write)" : "⚠️  LIVE — writing to database"}`);
    console.log("═══════════════════════════════════════════════════════════\n");
    if (!process.env.API_KEY_SECRET) {
        console.error("❌ API_KEY_SECRET env var is required for encryption");
        process.exit(1);
    }
    // Fetch all connected accounts
    const { data: accounts, error } = await supabase
        .from("connected_accounts")
        .select("id, platform, platform_username, access_token, refresh_token")
        .order("created_at", { ascending: true });
    if (error) {
        console.error("❌ Failed to fetch accounts:", error.message);
        process.exit(1);
    }
    if (!accounts?.length) {
        console.log("No connected accounts found. Nothing to do.");
        return;
    }
    console.log(`Found ${accounts.length} connected accounts.\n`);
    let encrypted = 0;
    let skipped = 0;
    let errors = 0;
    for (const account of accounts) {
        const label = `${account.platform}/${account.platform_username || account.id}`;
        // Check access_token
        if (account.access_token) {
            if (isAlreadyEncrypted(account.access_token)) {
                console.log(`  ✓ ${label}: access_token already encrypted — skipping`);
                skipped++;
            }
            else {
                try {
                    const encryptedToken = (0, crypto_1.encrypt)(account.access_token);
                    // Verify round-trip
                    const decrypted = (0, crypto_1.decrypt)(encryptedToken);
                    if (decrypted !== account.access_token) {
                        throw new Error("Round-trip verification failed!");
                    }
                    if (!DRY_RUN) {
                        await supabase
                            .from("connected_accounts")
                            .update({ access_token: encryptedToken })
                            .eq("id", account.id);
                    }
                    console.log(`  🔒 ${label}: access_token encrypted ${DRY_RUN ? "(dry run)" : "✅"}`);
                    encrypted++;
                }
                catch (err) {
                    console.error(`  ❌ ${label}: access_token encryption failed: ${err.message}`);
                    errors++;
                }
            }
        }
        // Check refresh_token
        if (account.refresh_token) {
            if (isAlreadyEncrypted(account.refresh_token)) {
                console.log(`  ✓ ${label}: refresh_token already encrypted — skipping`);
                skipped++;
            }
            else {
                try {
                    const encryptedToken = (0, crypto_1.encrypt)(account.refresh_token);
                    // Verify round-trip
                    const decrypted = (0, crypto_1.decrypt)(encryptedToken);
                    if (decrypted !== account.refresh_token) {
                        throw new Error("Round-trip verification failed!");
                    }
                    if (!DRY_RUN) {
                        await supabase
                            .from("connected_accounts")
                            .update({ refresh_token: encryptedToken })
                            .eq("id", account.id);
                    }
                    console.log(`  🔒 ${label}: refresh_token encrypted ${DRY_RUN ? "(dry run)" : "✅"}`);
                    encrypted++;
                }
                catch (err) {
                    console.error(`  ❌ ${label}: refresh_token encryption failed: ${err.message}`);
                    errors++;
                }
            }
        }
    }
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log(`  Results: ${encrypted} encrypted, ${skipped} skipped, ${errors} errors`);
    if (DRY_RUN && encrypted > 0) {
        console.log("  ⚠️  This was a DRY RUN. Run with DRY_RUN=false to apply.");
    }
    console.log("═══════════════════════════════════════════════════════════");
}
main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
//# sourceMappingURL=encrypt-existing-tokens.js.map