# Meta UGC Automation Platform: AI Context & Architecture Guide

**ATTENTION AI ASSISTANTS:** Read this entire document first to understand the system architecture, business logic, tech stack, and Meta API constraints before making any code changes.

## 1. System Overview
This platform is an Instagram/Facebook messaging automation tool (similar to ManyChat). It allows creators to automatically reply to comments, send automated Direct Messages (DMs) with links, and require users to follow them before receiving gated content.

## 2. Infrastructure & Tech Stack
The platform is fully decoupled into a serverless frontend, a worker backend, and a cloud database:
- **Frontend (Vercel)**: Next.js (App Router). Hosts the user dashboard and the main Meta Webhook receiver.
- **Backend (Render)**: Express.js (Node.js). Acts as the background worker. Handles the message queue, rate-limiting, cron jobs, and scheduled delayed messages.
- **Database (Supabase)**: PostgreSQL database used for storing rules, connected Meta accounts, processing state, and the outbound message queue.

## 3. Core Features & Complex Logic Flow

### A. Keyword Automations & Webhook Receiver
- **Entry Point**: `frontend/app/api/webhooks/meta/route.ts`
- **Logic**: Meta sends a webhook when a user comments on a post. The webhook parses the event and looks for matching keywords configured in the `automation_rules` table.
- **Deduplication**: To prevent responding to the same comment twice, every processed comment is logged into the `processed_comments` table. If a comment ID exists here, it is ignored.

### B. The "Require Follow" Gate (Follow-Gating)
If an automation rule has `require_follow` enabled, the user MUST follow the creator to get the final link.
- **Instant Graph API Check**: When a comment arrives, the webhook makes an on-the-fly request to `https://graph.facebook.com/v21.0/{commentor_id}?fields=is_user_follow_business`.
- **If Following**: It bypasses the follow prompt and immediately queues the final content link to be sent via Private Reply.
- **If NOT Following**: It sends a Private Reply containing the creator's profile URL and prompts the user to reply "DONE" once they follow.
- **The "DONE" Keyword Handler**: When a user replies "DONE" in the DM, the webhook searches the `processed_comments` table for the user's most recent interaction. It retrieves the associated `rule_id`, extracts the final link, and sends it as a Standard DM (which renders as a rich UI Button).

### C. Message Queue, Delays, & Anti-Spam (Compliance)
Meta aggressively bans accounts that send bulk messages or spam. We bypass this using a queue system.
- **Enqueuing**: Instead of hitting the Meta API directly, the Next.js webhook sends a payload to the Express backend (`POST /api/messaging/enqueue`), which inserts a row into the `message_queue` table in Supabase.
- **Scheduled Follow-ups**: If a user configures a "Follow-up Delay" (e.g., 15 minutes), the webhook calculates `scheduled_send_at` 15 minutes in the future. The queue system strictly marks these as `status: "queued"`.
- **Queue Processor**: `backend/src/services/send-queue.ts` runs a cron job every 5 seconds. It fetches messages where `status = "ready"` OR `(status = "queued" AND scheduled_send_at <= now)`. It processes them and marks them as `sent`.

## 4. Meta API Constraints & Workarounds (CRITICAL)
- **Private Replies**: When replying to a *comment*, Meta requires using the `Private Reply` API using the `comment_id` as the recipient. **Constraint**: Private replies CANNOT contain Buttons, Templates, or Media. They must be plain text strings (which can include naked URLs that generate link preview cards). Only *one* Private Reply is allowed per comment.
- **Standard DMs**: When a user sends a *Direct Message* (like "DONE"), it opens the 24-hour standard messaging window. We can then use the `Standard DM` API using their IG User ID as the recipient. **Benefit**: This API supports rich Buttons and Templates.

## 5. Key Database Tables (Supabase)
- `automation_rules`: Stores user configurations (keywords, messages, follow requirements).
- `connected_accounts`: Stores Meta OAuth access tokens and Page/Instagram IDs.
- `processed_comments`: Vital for deduplication and maintaining state across the "DONE" keyword flow.
- `message_queue`: The central hub for all outgoing messages. Controls rate limits and scheduled follow-ups.

## 6. Where Things Live
- **Webhook Handler**: `frontend/app/api/webhooks/meta/route.ts`
- **Queue Enqueue Endpoint**: `backend/src/routes/messaging.ts`
- **Queue Cron Processor**: `backend/src/services/send-queue.ts`
- **Supabase DB Client Setup**: Used globally across both frontend and backend utilizing service role keys for admin inserts.




Please read PROJECT_CONTEXT.md in the root folder to understand this project, how it's built, the tech stack, the database schema, and all the Meta API logic.