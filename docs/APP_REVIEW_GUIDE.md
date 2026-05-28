# Meta App Review — Content Engineer Business App
## App ID: 1502207694092231 | App Name: content engineer business

> **Copy-paste ready text for each permission's "Usage guidelines" in App Review submission.**

---

## How to Submit App Review

1. Go to: [developers.facebook.com/apps/1502207694092231](https://developers.facebook.com/apps/1502207694092231)
2. Left sidebar → **Review** → **App Review**
3. Click **"+ Add to Submission"** or **"Request advanced access"** next to each permission
4. For each permission → click **"Usage guidelines"** → paste the text below
5. After all permissions → upload **one screencast video** (see bottom of this doc)
6. Click **"Next"** → **Submit for Review**

---

## ═══════════════════════════════════════════
## PERMISSION 1: `instagram_manage_messages`
## ═══════════════════════════════════════════

### How will your app use this permission? (paste this)

```
Content Engineer is a social media automation platform for Indian content creators and businesses.

We use instagram_manage_messages to:

1. Read DMs sent to the user's Instagram account via webhooks in real-time
2. Send automated DM replies when a follower comments with a specific keyword
   Example: User creates rule — "If someone comments 'link' on my post → auto-DM them the download link"
3. Send follow-up DMs based on automation rules created by the user in our dashboard
4. All automated messages include opt-out text: "Reply STOP to unsubscribe"
5. We strictly enforce Meta's 24-hour messaging window — no messages are sent outside the allowed window
6. No unsolicited messages are ever sent — only rule-triggered responses to people who have already engaged

The user creates automation rules in Content Engineer dashboard → we execute them via Instagram API → user can pause or delete rules anytime from their dashboard.
```

### Provide step-by-step instructions (paste this)

```
Step 1: Go to https://contentengineer.techaasvik.in and log in with email
Step 2: Click "Connect Instagram" → complete Instagram OAuth → grant all requested permissions
Step 3: Go to Dashboard → Automation → DM Rules → click "New Rule"
Step 4: Set rule:
        - Trigger: "Comment keyword: price"
        - Action: "Send DM: Our pricing starts at ₹999/month. Visit contentengineer.techaasvik.in/pricing"
Step 5: Click "Save Rule"
Step 6: From a test Instagram account, comment "price" on any post of the connected account
Step 7: The test account receives an automated DM:
        "Our pricing starts at ₹999/month. Visit contentengineer.techaasvik.in/pricing
         Reply STOP to unsubscribe from automated messages."
Step 8: In Content Engineer dashboard → Automation History → see the triggered rule with timestamp
```

---

## ═══════════════════════════════════════════
## PERMISSION 2: `instagram_manage_comments`
## ═══════════════════════════════════════════

### How will your app use this permission? (paste this)

```
Content Engineer uses instagram_manage_comments to:

1. Read comments on the user's Instagram posts in real-time via Meta webhooks
2. Auto-reply to comments that match user-defined keyword triggers
   Example: User sets rule — "If comment contains 'interested' → reply 'Thanks! DM sent 🙌'"
3. Hide spam comments containing keywords defined by the user (e.g., offensive words)
4. Analyze comment text for content insights shown in the analytics dashboard

All comment actions (auto-reply, hide) are triggered only by explicit user-created rules.
No comment is modified without a matching rule set up by the account owner.
All rules and their triggered history are visible to the user in their dashboard.
```

### Provide step-by-step instructions (paste this)

```
Step 1: Go to https://contentengineer.techaasvik.in and log in
Step 2: Connect Instagram account via OAuth → grant permissions
Step 3: Go to Dashboard → Automation → Comment Rules → "New Rule"
Step 4: Set rule:
        - Trigger: "Comment keyword: guide"
        - Action: "Reply: Check your DMs for the guide! 📩"
Step 5: Click "Save Rule"
Step 6: From a test Instagram account, comment "I want the guide" on the connected account's post
Step 7: Content Engineer auto-replies: "Check your DMs for the guide! 📩"
Step 8: Dashboard → Automation History → see the triggered comment rule with post ID and timestamp
```

---

## ═══════════════════════════════════════════
## PERMISSION 3: `instagram_content_publish`
## ═══════════════════════════════════════════

### How will your app use this permission? (paste this)

```
Content Engineer uses instagram_content_publish to:

1. Schedule Instagram posts (photos, videos, reels, carousels) at user-defined times
2. Publish posts immediately when the user clicks "Post Now"
3. Allow content creators to plan their entire content calendar in advance
4. The user creates all post content (caption, media, hashtags) — Content Engineer only publishes it at the scheduled time
5. No posts are ever published without explicit user action (scheduling or instant post)
6. All published posts are tracked in the user's Post History with status and publish time

This saves creators hours each week by automating the posting schedule.
```

### Provide step-by-step instructions (paste this)

```
Step 1: Go to https://contentengineer.techaasvik.in and log in
Step 2: Connect Instagram account via OAuth
Step 3: Go to Dashboard → Schedule → "New Post"
Step 4: Write caption, add hashtags, upload image/video
Step 5: Select publish date: tomorrow at 10:00 AM
Step 6: Click "Schedule Post"
Step 7: At 10:00 AM the next day, Content Engineer publishes the post via Instagram Content Publish API
Step 8: Post appears on the connected Instagram account's feed
Step 9: Dashboard → History → Scheduled Posts → post shows status "Published" with timestamp
```

---

## ═══════════════════════════════════════════
## PERMISSION 4: `instagram_manage_insights`
## ═══════════════════════════════════════════

### How will your app use this permission? (paste this)

```
Content Engineer uses instagram_manage_insights to:

1. Fetch post-level analytics: reach, impressions, likes, comments, saves, shares, video views
2. Fetch account-level analytics: follower count, follower growth, profile visits, website clicks
3. Display these insights in the Content Engineer analytics dashboard
4. Identify best-performing posts to help creators plan future content
5. Generate performance reports (weekly/monthly) for the user's Instagram account
6. Show optimal posting times based on follower activity data

All analytics data is fetched only for the user's own connected Instagram account.
Data is displayed only to the account owner — never shared with third parties.
```

### Provide step-by-step instructions (paste this)

```
Step 1: Go to https://contentengineer.techaasvik.in and log in
Step 2: Connect Instagram Business/Creator account via OAuth
Step 3: Go to Dashboard → Analytics
Step 4: Content Engineer fetches last 30 days of insights via instagram_manage_insights API
Step 5: User sees:
        - Line chart: Reach and Impressions over last 30 days
        - Bar chart: Top 5 posts by engagement
        - Metrics: Follower growth, profile visits, website clicks
Step 6: User clicks "View Details" on any post → sees post-specific: reach, impressions, saves, shares
Step 7: User clicks "Download Report" → gets CSV/PDF of monthly analytics
```

---

## ═══════════════════════════════════════════
## PERMISSION 5: `pages_messaging`
## ═══════════════════════════════════════════

### How will your app use this permission? (paste this)

```
Content Engineer uses pages_messaging to:

1. Read messages sent to the user's Facebook Page via Messenger
2. Send automated replies based on keyword triggers set by the user in our dashboard
   Example: Customer messages "pricing" → Content Engineer auto-replies with pricing information
3. Set up welcome messages for new Messenger conversations (first-time contacts only)
4. All automated messages include: "Reply STOP to opt out of automated messages"
5. We follow Meta's 24-hour messaging window strictly
6. No messages are sent outside the allowed window or without matching user-created rules
7. No promotional messages are sent to users who haven't initiated contact

This feature helps small business owners and content creators respond to customer inquiries automatically when they're unavailable (e.g., overnight, on weekends, while filming content).
```

### Provide step-by-step instructions (paste this)

```
Step 1: Go to https://contentengineer.techaasvik.in and log in
Step 2: Click "Connect Facebook Page" → OAuth → select Page → grant permissions
Step 3: Go to Dashboard → Automation → Messenger Rules → "New Rule"
Step 4: Set rule:
        - Trigger: "Message keyword: price"
        - Action: "Reply: Our pricing starts at ₹999/month. Visit contentengineer.techaasvik.in/pricing
                   Reply STOP to opt out."
Step 5: Click "Save Rule"
Step 6: From a test Facebook account, send "What's the price?" to the connected Facebook Page via Messenger
Step 7: Content Engineer auto-replies: "Our pricing starts at ₹999/month... Reply STOP to opt out."
Step 8: Dashboard → Automation History → see triggered Messenger rule with timestamp
```

---

## ═══════════════════════════════════════════
## PERMISSION 6: `pages_manage_metadata`
## ═══════════════════════════════════════════

### How will your app use this permission? (paste this)

```
Content Engineer uses pages_manage_metadata to:

1. Subscribe the connected Facebook Page to real-time webhook events (messages, comments, feed)
2. Read Page settings and configuration details needed for automation rules
3. Display Page information (name, category, follower count) in the Content Engineer dashboard
4. Verify webhook subscription status and health

Without pages_manage_metadata, Content Engineer cannot receive real-time notifications when someone messages or comments on the user's Facebook Page — making automation impossible.
```

### Provide step-by-step instructions (paste this)

```
Step 1: Go to https://contentengineer.techaasvik.in and log in
Step 2: Connect Facebook Page via OAuth → grant all permissions
Step 3: Content Engineer calls Pages API with pages_manage_metadata to:
        - Subscribe to webhook events for the Page
        - Fetch Page name, category, ID for dashboard display
Step 4: Go to Dashboard → Connected Accounts
Step 5: User sees their Page name, category, follower count, and subscription status "Active"
Step 6: Content Engineer webhook at https://contentengineer.techaasvik.in/api/webhooks/meta
        receives real-time events for the subscribed Page
Step 7: When a customer comments or messages the Page → automation rules are evaluated and triggered
```

---

## ═══════════════════════════════════════════
## PERMISSION 7: `pages_read_engagement`
## ═══════════════════════════════════════════

### How will your app use this permission? (paste this)

```
Content Engineer uses pages_read_engagement to:

1. Read posts published on the user's Facebook Page for display in the Content Engineer dashboard
2. Read engagement data (likes, comments, shares, reach) for Facebook Page posts
3. Display Page post analytics to help users understand what content performs best
4. Allow users to select specific Page posts to apply per-post automation rules
   Example: "Apply this comment automation rule only to this specific post"

All data is read only for the user's own connected Facebook Page.
```

### Provide step-by-step instructions (paste this)

```
Step 1: Go to https://contentengineer.techaasvik.in and log in
Step 2: Connect Facebook Page via OAuth
Step 3: Go to Dashboard → Page Posts
Step 4: Content Engineer fetches recent posts via pages_read_engagement
Step 5: User sees a grid of posts with: likes, comments, shares, reach for each
Step 6: User clicks a specific post → clicks "Add Rule to this Post"
Step 7: User sets comment automation: "If someone comments 'interested' on THIS post → DM them"
Step 8: Rule is now per-post (only triggers for comments on that specific post)
```

---

## ═══════════════════════════════════════════
## PERMISSION 8: `pages_show_list`
## ═══════════════════════════════════════════

### How will your app use this permission? (paste this)

```
Content Engineer uses pages_show_list to:

1. Show the user a list of all Facebook Pages they manage during the OAuth connection flow
2. Allow the user to select which specific Page to connect to Content Engineer
3. Store only the selected Page's ID and access token — not all pages

This is critical for users who manage multiple Facebook Pages — they need to choose which Page to connect for automation. Without pages_show_list, we cannot present this selection.
```

### Provide step-by-step instructions (paste this)

```
Step 1: Go to https://contentengineer.techaasvik.in and log in
Step 2: Click "Connect Facebook Page" button → OAuth popup opens
Step 3: User completes Facebook login and grants permissions
Step 4: Content Engineer calls /me/accounts with pages_show_list permission
Step 5: Response: list of Pages the user manages with their IDs and names
Step 6: Content Engineer shows: "Select a Page to connect:"
        - Page Name 1 (category)
        - Page Name 2 (category)
Step 7: User selects desired Page → Content Engineer stores that Page's token
Step 8: Dashboard → Connected Accounts → shows the selected Page as "Connected"
```

---

## ═══════════════════════════════════════════
## 📹 SCREENCAST VIDEO GUIDE
## ═══════════════════════════════════════════

> **One video covers all permissions — record this once and upload for every permission.**

### What to show (2-3 minutes):

```
[0:00 - 0:10]  Open browser → go to https://contentengineer.techaasvik.in
[0:10 - 0:30]  Click "Connect Instagram" → OAuth popup → grant all permissions → redirects back
[0:30 - 0:45]  Dashboard → Connected Accounts → Instagram account + Facebook Page both showing "Connected"

[0:45 - 1:15]  DM Automation demo:
               → Automation → DM Rules → "New Rule"
               → Set: Trigger="comment keyword: guide" | Action="Send DM: Here's your guide!"
               → Save Rule
               → Open another browser/phone → comment "guide" on the connected Instagram post
               → Show DM received: "Here's your guide! Reply STOP to unsubscribe"
               → Dashboard → Automation History → show the triggered rule

[1:15 - 1:35]  Analytics demo:
               → Analytics tab → show reach, impressions, follower growth charts
               → Click a post → show post-level insights

[1:35 - 2:00]  Post Scheduling demo:
               → Schedule → New Post → write caption → select tomorrow 10 AM → Schedule
               → Show post in "Upcoming Posts" list

[2:00 - 2:15]  Messenger automation:
               → Automation → Messenger Rules → show existing rule
               → "This is how Messenger automation works"

[2:15 - 2:30]  Page management:
               → Connected Accounts → show connected Facebook Page
               → Page Posts → show posts with engagement metrics

[2:30 - END]   End on dashboard home screen
```

### Video Requirements:
```
Format:    MP4 preferred
Length:    2-3 minutes max
Language:  English (subtitles optional)
Quality:   720p minimum
Audio:     Optional (narration helpful but not required)
```

---

## ═══════════════════════════════════════════
## BUSINESS VERIFICATION (Required before App Review)
## ═══════════════════════════════════════════

Before submitting App Review, verify your business:

```
1. Go to: https://business.facebook.com
2. Settings → Security Center → Business Verification
3. Submit:
   - Business name: TechAasvik
   - Business website: https://contentengineer.techaasvik.in
   - Business phone: your phone number
   - Business document: GST certificate OR incorporation certificate
4. Verification takes 1-5 business days
```

> ⚠️ Without business verification, some advanced permissions (pages_messaging, instagram_manage_messages) will NOT be approved.

---

## ═══════════════════════════════════════════
## APP REVIEW TIMELINE
## ═══════════════════════════════════════════

| Permission | Review Time | Notes |
|---|---|---|
| `public_profile` | Auto-approved | No review needed |
| `pages_show_list` | Auto-approved | No review needed |
| `pages_read_engagement` | 1-3 days | Usually fast |
| `instagram_manage_insights` | 1-3 days | Usually fast |
| `instagram_content_publish` | 3-7 days | Standard |
| `pages_manage_metadata` | 3-7 days | Standard |
| `instagram_manage_comments` | 7-14 days | Needs screencast |
| `instagram_manage_messages` | 14-30 days | Needs business verification |
| `pages_messaging` | 14-30 days | Needs business verification |

---

## ═══════════════════════════════════════════
## QUICK CHECKLIST BEFORE SUBMITTING
## ═══════════════════════════════════════════

```
☐ App is in Live/Published mode
☐ Privacy Policy URL added: https://contentengineer.techaasvik.in/privacy
☐ Terms of Service URL added: https://contentengineer.techaasvik.in/terms
☐ App icon uploaded (1024x1024 PNG)
☐ App contact email: contact@techaasvik.com
☐ Business Verification submitted/approved at business.facebook.com
☐ Webhook verified: https://contentengineer.techaasvik.in/api/webhooks/meta
☐ At least one Instagram tester account added and accepted
☐ Screencast video recorded (2-3 minutes)
☐ All usage guidelines filled for each permission
☐ Tested all features with tester account before submitting
```
