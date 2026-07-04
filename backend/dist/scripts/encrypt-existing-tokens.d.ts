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
import "dotenv/config";
