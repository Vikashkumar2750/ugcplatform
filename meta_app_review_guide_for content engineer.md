# Meta App Review Submission Guide — Content Engineer

> [!IMPORTANT]
> This document contains everything you need to submit your Meta App Review: permission descriptions, screencast recording guides, data handling answers, and compliance checklist.

---

## 📋 Quick Answer to Your Question

**What should you show in the screencast?**

You need to show **EVERYTHING that uses the permission you're requesting** — not just DM automation. For each permission, Meta wants to see the **complete end-to-end user flow** of how your app uses that specific permission.

Here's what to show per permission:

| Permission | What to Show |
|---|---|
| `instagram_business_manage_messages` | OAuth → Connect IG → Create DM rule → Trigger DM → Auto-reply sent |
| `instagram_manage_comments` | OAuth → Connect IG → Create comment rule → Comment trigger → Auto-reply + DM sent |
| `pages_show_list` | OAuth → Facebook login → Pages listed → User selects a page |
| `pages_manage_metadata` | OAuth → Page connected → Webhook subscription working |
| `pages_messaging` | OAuth → Page connected → Messenger automation → Auto-reply sent |
| `business_management` | OAuth → Business accounts listed → User connects business page/IG |
| `instagram_business_basic` | OAuth → Profile data shown on Insights dashboard |
| `public_profile` | No screencast needed — just agree to comply |

> [!TIP]
> You should record **one unified screencast** (~3-5 minutes) that covers the full flow: Login → Connect Platform (OAuth) → Show Insights/Analytics working → Create DM Automation → Trigger it → Create Comment Automation → Trigger it → Show Messenger automation. Then upload the same video (or trimmed clips) for each permission.

---

## 🔐 Permission Descriptions (Copy-Paste Ready)

### 1. `instagram_business_manage_messages`

**Description:**
> Content Engineer is a social media management platform for Instagram creators and businesses. We use `instagram_business_manage_messages` to power our DM Automation feature, which allows users to:
>
> 1. **Keyword-based Auto-Replies**: Users create automation rules with specific trigger keywords. When a follower sends a DM containing those keywords, our app automatically sends a pre-configured reply via the Instagram Messaging API (`POST /{ig-user-id}/messages`).
>
> 2. **New Follower Welcome Messages**: When a new user messages the account for the first time (first-contact detection), our app sends a personalized welcome DM.
>
> 3. **Comment-to-DM Flows**: When a user comments a keyword on a post, our app sends them a private DM with additional information (e.g., a link, coupon, or resource).
>
> 4. **AI-Powered Smart Replies**: Our AI inbox reviews incoming DMs, generates draft replies with confidence scoring, and either auto-sends (high confidence) or escalates to the user for manual approval before sending.
>
> **Compliance**: All automated messages include an opt-out option ("Reply STOP to unsubscribe"). We enforce Meta's 24-hour messaging window policy — messages are only sent in response to user-initiated conversations. We track `last_user_interaction_at` for every conversation and reject any message outside the 24h window. Opted-out users are permanently excluded from automation.
>
> **Data Handling**: Message content is stored in our Supabase database to track conversations, enforce rate limits, and support the opt-out system. We do not share message data with third parties.

---

### 2. `instagram_manage_comments`

**Description:**
> Content Engineer uses `instagram_manage_comments` to power our Comment Automation feature:
>
> 1. **Auto-Reply to Comments**: Users create rules with trigger keywords. When a follower comments on a specific post (or any post) with a matching keyword, our app automatically replies to the comment via the Instagram Graph API (`POST /{comment-id}/replies`).
>
> 2. **Comment-to-DM**: Along with (or instead of) a public reply, our app can send a private DM to the commenter with additional information like links, discount codes, or lead magnets.
>
> 3. **Comment Hiding**: Users can optionally hide spam or unwanted comments that match certain keywords using `POST /{comment-id}` with `hide=true`.
>
> 4. **Comment Deduplication**: We maintain a `processed_comments` table to prevent double-processing of the same comment.
>
> **How it works**: We receive comment notifications via Meta webhooks (subscribed to the `comments` field). Our webhook handler matches the comment text against active automation rules, then executes the configured actions (reply, DM, hide).
>
> **Data Handling**: Comment IDs and text are stored temporarily for deduplication and automation rule matching. We do not republish or redistribute comment data.

---

### 3. `pages_show_list`

**Description:**
> Content Engineer uses `pages_show_list` to display the list of Facebook Pages the user administrates during the account connection flow:
>
> 1. After the user completes OAuth login, we call `GET /me/accounts` to retrieve the list of Pages they manage.
> 2. We display these Pages in our "Connect Platform" UI so the user can select which Page to connect to our app.
> 3. The selected Page's access token and ID are stored to enable downstream features (Messenger automation, post scheduling, Page insights).
>
> This is a prerequisite permission — without it, we cannot identify which Facebook Page the user wants to connect. We only store the Page ID, name, and access token for the Page the user explicitly selects.

---

### 4. `pages_manage_metadata`

**Description:**
> Content Engineer uses `pages_manage_metadata` to subscribe to webhooks for the connected Facebook Page:
>
> 1. **Webhook Subscription**: After a user connects their Page, we call `POST /{page-id}/subscribed_apps` to subscribe our app to receive real-time webhook notifications for the Page's feed, messages, and comments.
>
> 2. **Webhook Fields**: We subscribe to `messages`, `feed`, `comments`, and `messaging_postbacks` to power our automation features (DM auto-replies, comment automation, Messenger automation).
>
> Without this permission, our app cannot receive real-time notifications from Meta, which means automation rules would not trigger. This is essential infrastructure for all our automation features.
>
> **Data Handling**: We log webhook events in our database for debugging and automation rule matching. Raw webhook payloads are stored temporarily and pruned regularly.

---

### 5. `pages_messaging`

**Description:**
> Content Engineer uses `pages_messaging` to enable Facebook Messenger automation for connected Pages:
>
> 1. **Auto-Replies via Messenger**: When a user sends a message to the connected Facebook Page via Messenger, our app can automatically reply based on keyword-matching rules (similar to Instagram DM automation).
>
> 2. **Welcome Messages**: First-time Messenger contacts receive a configurable welcome message.
>
> 3. **Keyword Triggers**: Users create automation rules with trigger keywords. Incoming Messenger messages are matched against these rules, and the appropriate auto-reply is sent via `POST /me/messages`.
>
> **Compliance**: Same compliance measures as Instagram DMs — opt-out support, 24-hour messaging window enforcement, and rate limiting. All automated messages are clearly from the Page (not impersonating a human).
>
> **Data Handling**: Messenger message data is stored in our database to track conversations, enforce opt-outs, and support automation rule matching. We do not share this data with third parties.

**Instructions to reproduce:**
> 1. Log in to Content Engineer at [your-app-url]
> 2. Go to "Connect" page and connect your Facebook Page via OAuth
> 3. Go to "Automation" → "DM Rules" and create a new rule with type "Keyword in DM"
> 4. Set trigger keyword (e.g., "info") and auto-reply message
> 5. Send a message containing "info" to your Page via Messenger from a different account
> 6. The auto-reply should be sent within a few seconds
> 7. Send "STOP" to test opt-out — future automation messages will be blocked for that user

---

### 6. `business_management`

**Description:**
> Content Engineer uses `business_management` to access business-level information during the account connection process:
>
> 1. **Business Account Discovery**: We use this permission to identify Instagram Business/Creator accounts connected to the user's Facebook Business portfolio, enabling proper account linking.
>
> 2. **Page-to-Instagram Mapping**: We call `GET /{page-id}?fields=instagram_business_account` to find the Instagram Business account linked to the user's Facebook Page. This mapping is essential for our Instagram features (insights, DM automation, comment automation).
>
> 3. **Token Management**: Business-level access enables long-lived page access tokens, which are required for webhook subscriptions and background automation to function reliably.
>
> **Data Handling**: We store only the business account ID and the Page-to-Instagram mapping. We do not access or store any business-level financial, ad, or employee data.

---

### 7. `public_profile`

**Description:**
> Content Engineer uses `public_profile` to identify the user during the Facebook Login flow. We access the user's name and profile picture to personalize the app experience (display name in the dashboard navigation). This is the default permission granted with Facebook Login.

---

### 8. `instagram_business_basic` (Required dependency)

**Description:**
> Content Engineer uses `instagram_business_basic` to access the connected Instagram Business/Creator account's profile information and media:
>
> 1. **Profile Data**: Username, follower count, following count, media count, profile picture — displayed on our Insights dashboard.
>
> 2. **Media Access**: We fetch the user's recent posts (via `GET /{ig-user-id}/media`) to display them in our Post Picker when creating automation rules (so users can target automation to specific posts).
>
> 3. **Insights & Analytics**: We use this in conjunction with `instagram_manage_insights` to show engagement analytics, top posts, audience demographics, and week-over-week performance comparisons on our Insights dashboard.
>
> **Data Handling**: Profile and media data is cached in our Supabase database (with daily cache for insights) to minimize API calls and provide fast dashboard loading.

---

## 🎬 Screencast Recording Guide

### What Meta Wants to See
Meta reviewers need to see a **real, working demonstration** of how your app uses each permission. They want to verify:
1. The user **explicitly grants** permission via OAuth
2. The app **actually uses** the permission for a legitimate purpose
3. The app **handles data responsibly**

### Recommended Screencast Structure (~4-5 minutes)

> [!IMPORTANT]
> Record this with a **clean test account** (not your personal account). Use screen recording software (OBS, Loom, or Windows Game Bar). Show the browser URL bar at all times.

#### Scene 1: Login & OAuth (45 seconds)
1. Open Content Engineer landing page
2. Click "Get Started" / "Login"
3. Log in with email (show the signup/login flow)
4. Navigate to **Connect** page
5. Click "Connect Instagram" button
6. Show the **Facebook OAuth dialog** — highlight the permissions being requested
7. Approve permissions
8. Show redirect back to app with ✅ "Connected successfully"
9. Show the connected account card with profile picture, username, and permissions listed

#### Scene 2: Instagram Insights & Analytics (45 seconds)
> Shows: `instagram_business_basic`, `instagram_manage_insights`, `business_management`

1. Navigate to **Insights** page
2. Show profile data loaded (followers, following, media count)
3. Show engagement analytics (reach, impressions, engagement rate)
4. Show 7-day comparison metrics (week-over-week changes)
5. Show Top Posts section with engagement data
6. Show Audience Demographics (age, gender, location)
7. Briefly show the **Analyze** page if it pulls API data

#### Scene 3: DM Automation (60 seconds)
> Shows: `instagram_business_manage_messages`, `pages_manage_metadata`

1. Navigate to **Automation** → **DM Rules**
2. Click "Create New Rule"
3. Set type to "Keyword in DM"
4. Enter keyword: e.g., `"link"` or `"info"`
5. Enter auto-reply message: e.g., `"Here's the link you requested: https://example.com"`
6. Save and activate the rule
7. **Switch to a different device/account** — send a DM to your business account containing the keyword
8. **Switch back** — show the DM was sent automatically (check Instagram inbox or show webhook logs)
9. Show the rule's trigger count incremented

#### Scene 4: Comment Automation (60 seconds)
> Shows: `instagram_manage_comments`

1. Navigate to **Automation** → **Comment Rules**
2. Click "Create New Rule"
3. Select type "Comment Automation"
4. Enter keyword: e.g., `"interested"`
5. Configure actions: auto-reply text + DM message
6. Optionally select a specific post from the Post Picker
7. Save and activate the rule
8. **Switch to another account** — comment the keyword on the target post
9. **Switch back** — show the auto-reply was posted and/or DM was sent
10. Show the processed_comments dedup in action

#### Scene 5: Messenger Automation (45 seconds)
> Shows: `pages_messaging`, `pages_show_list`

1. Navigate to **Connect** → show Facebook Page connection
2. Show the Pages list (from `pages_show_list`)
3. Go to **Automation** → create a DM rule that also applies to Facebook Page
4. **Switch to another account** — send a Messenger message to the Page with the keyword
5. Show the auto-reply was sent

#### Scene 6: Compliance Features (30 seconds)
1. Show the **opt-out** flow — send "STOP" from the test account
2. Show that subsequent automation messages are blocked
3. Show the **AI Inbox** — demonstrate the human review queue for low-confidence AI replies
4. Show the **Compliance** section or privacy policy page
5. Show **Data Deletion** page (navigate to `/data-deletion-status`)

---

## 📊 Data Handling Answers

### Do you have data processors or service providers?

**Answer: Yes**

**Processors to list:**
| Processor | Purpose |
|---|---|
| **Supabase** (Supabase Inc.) | Database hosting — stores connected account data, automation rules, webhook events, and conversation tracking |
| **Vercel** (Vercel Inc.) | Application hosting — runs frontend and API routes that process webhook data |
| **Render** (Render Services Inc.) | Backend worker hosting — processes message queue and sends automated replies |
| **Amazon Web Services (AWS)** | AI model hosting via Amazon Bedrock — processes AI-generated draft replies (if using Bedrock) |

> [!NOTE]
> Only list processors you're **actually using**. If you're not using AWS Bedrock, remove it. If you're self-hosting the backend, remove Render. Check your `.env` file for which services are active.

---

### Who is the person or entity responsible for all Platform Data?

**Answer:** `Vikas Dhiman` (or your business entity name if you have one registered)

> [!TIP]
> If you operate as a sole proprietor, use your full legal name. If you have a registered company (e.g., "Content Engineer Technologies" or similar), use that name.

---

### Select the country where this person or entity is located.

**Answer:** `India`

---

### Have you provided personal data to public authorities in response to national security requests?

**Answer:** `No`

---

### Which policies or processes do you have in place regarding requests from public authorities?

**Answer:** Check ALL of these:
- ✅ Required review of the legality of these requests
- ✅ Provisions for challenging these requests if they are considered unlawful
- ✅ Data minimization policy — the ability to disclose the minimum information necessary
- ✅ Documentation of these requests, including your responses and legal reasoning

---

## ✅ Pre-Submission Checklist

### API Test Calls (from your screenshots)

| Permission | Status | Action Required |
|---|---|---|
| `instagram_business_manage_insights` | ⚠️ 0 of 1 API calls required | **Make at least 1 test call** — visit your Insights page |
| `instagram_business_content_publish` | ⚠️ 0 of 1 API calls required | **Make at least 1 test call** — schedule a test post |
| `instagram_business_manage_messages` | ✅ 84 API test calls | Done |
| `instagram_business_manage_comments` | ✅ Completed | Done |
| `instagram_business_basic` | ⚠️ 92 API test calls | Verify it shows "Completed" |
| `pages_read_engagement` | ✅ Completed | Done |
| `public_profile` | ⚠️ 0 API test calls | **Make at least 1 test call** |
| `pages_manage_metadata` | ✅ Completed | Done |
| `pages_messaging` | ✅ Completed | Done |
| `instagram_manage_messages` | ⚠️ 57 API test calls | Verify it shows "Completed" |
| `pages_show_list` | ✅ 1735 API test calls | Done |
| `instagram_basic` | ✅ Completed | Done |
| `business_management` | ✅ Completed | Done |
| `instagram_manage_comments` | ✅ Completed | Done |
| `instagram_manage_insights` | ✅ Completed | Done |

> [!WARNING]
> You need to **complete the required API test calls** for `instagram_business_manage_insights` and `instagram_business_content_publish` before submitting. Visit your Insights page and schedule a test post to trigger these calls.

### Required Dependencies
- ✅ `instagram_business_basic` is included (required by `instagram_business_manage_messages`)
- ✅ `instagram_basic` is included (required by `instagram_manage_comments`)
- ✅ `pages_show_list` is included (required by `pages_manage_metadata`)

### Pages to Have Ready
- ✅ Privacy Policy page: `/privacy`
- ✅ Terms of Service page: `/terms`
- ✅ Data Deletion callback: `/api/webhooks/data-deletion`
- ✅ Data Deletion status page: `/data-deletion-status`
- ✅ Deauthorize callback: `/api/webhooks/deauthorize`

---

## 🎯 Summary: What to Show vs. What NOT to Show

### ✅ MUST Show (directly uses Meta APIs)
- **OAuth Login Flow** (Facebook Login dialog with permissions)
- **Platform Connection** (Connect page showing account linking)
- **DM Automation** (creating rules, keyword triggers, auto-replies)
- **Comment Automation** (auto-reply to comments, comment-to-DM)
- **Messenger Automation** (Facebook Page messaging)
- **Instagram Insights** (profile data, engagement analytics)
- **Compliance** (opt-out, 24h window, AI review inbox)

### ❌ Don't Need to Show (doesn't use Meta APIs)
- **Analyze page** (uses Apify scraping, not Meta API — unless it pulls from connected account data)
- **YouTube connection** (separate Google OAuth, not Meta)
- **Settings page** (API key management is internal)
- **Pricing/Payment** (Razorpay, not Meta)
- **Landing page** (marketing, not functional)

### ⚠️ Show If Relevant
- **Post Scheduling** (if you're requesting `instagram_content_publish` / `instagram_business_content_publish`)
- **Facebook Insights** (if you're requesting Facebook-specific insights permissions)

---

> [!CAUTION]
> **Before recording the screencast**: Make sure your app is deployed and publicly accessible (Meta reviewers may try to access it). Your webhook endpoints must be live and responding. Test the entire flow end-to-end at least once before recording.
