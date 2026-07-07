# Meta App Setup — Content Engineer
### Dono Apps ki Complete Setup Guide (Copy-Paste Ready)

> **Domain:** `contentengineer.techaasvik.in`  
> **Contact:** `contact@techaasvik.com`  
> **Privacy:** `https://contentengineer.techaasvik.in/privacy`  
> **Terms:** `https://contentengineer.techaasvik.in/terms`

---

## ⚠️ IMPORTANT: 2 Alag Meta Apps Banana Hai

Meta mein yeh use cases **mutually exclusive** hain — ek app mein dono nahi chalenge:

| App | Naam | App ID | Kya Karta Hai |
|---|---|---|---|
| **App 1** | `Content Engineer - Business` | `1502207694092231` | Instagram API, Page management, Messenger automation |
| **App 2** | `Content Engineer - Login` | `2169224913932416` | User Facebook/Instagram Login (OAuth) |

---
---

# ═══════════════════════════════════════════
# APP 1 — `Content Engineer - Business`
# App ID: 1502207694092231
# ═══════════════════════════════════════════

## APP 1 — Step 1: Basic Settings

**App Dashboard → Settings → Basic**

```
App Name:            Content Engineer - Business
App ID:              1502207694092231
App Secret:          0c9a1f963ec483d87cc7070d9f290921
App Contact Email:   contact@techaasvik.com
App Domains:         contentengineer.techaasvik.in
Privacy Policy URL:  https://contentengineer.techaasvik.in/privacy
Terms of Service:    https://contentengineer.techaasvik.in/terms
Category:            Business & Pages
Sub-Category:        (leave blank)

User Data Deletion:
  → Dropdown mein select karo: "Data deletion callback URL"
  → URL: https://contentengineer.techaasvik.in/api/webhooks/data-deletion
```

**App Icon:**
```
1024 x 1024 PNG upload karo
(Transparent background allowed nahi)
```

Click **"Save Changes"**

---

## APP 1 — Step 2: Use Cases

**Use cases** tab mein yeh 3 select karo (exact names):

```
✅ Manage messaging & content on Instagram
   (Category: Content management)

✅ Manage everything on your Page
   (Category: Content management)

✅ Engage with customers on Messenger from Meta
   (Category: Business messaging)
```

---

## APP 1 — Step 3: Instagram API Setup

**App Dashboard → Products → Instagram → API Setup with Instagram Login**

### 3A — Instagram API → Settings

```
Deauthorize Callback URL:
  https://contentengineer.techaasvik.in/api/webhooks/deauthorize

Data Deletion Request URL:
  https://contentengineer.techaasvik.in/api/webhooks/data-deletion
```


### 3B — Add Instagram Testers

**App Dashboard → Roles → Instagram Testers → Add**

- Apna Instagram username add karo (jis account se test karoge)
- Uske baad Instagram app mein jao: Settings → Apps & Websites → Tester Invites → Accept

---

## APP 1 — Step 4: Permissions Add Karo

**App Dashboard → Use Cases → Manage messaging & content on Instagram → Permissions → Add**

Yeh sab add karo:

```
instagram_basic                  ← Auto-added
instagram_content_publish        ← Add karo
instagram_manage_comments        ← Add karo (needs App Review)
instagram_manage_insights        ← Add karo
instagram_manage_messages        ← Add karo (needs App Review)
```

**Use Cases → Manage everything on your Page → Permissions → Add**

```
pages_show_list                  ← Add karo
pages_read_engagement            ← Add karo
pages_manage_posts               ← Add karo (needs App Review)
pages_read_user_content          ← Add karo
```

**Use Cases → Engage with customers on Messenger → Permissions → Add**

```
pages_messaging                  ← Add karo (needs App Review)
```

---

## APP 1 — Step 5: Webhooks Setup

**App Dashboard → Products → Webhooks → Add → Instagram / Page**

### Instagram Webhooks:

```
Callback URL:   https://contentengineer.techaasvik.in/api/webhooks/meta
Verify Token:   Content Engineer_webhook_verify_2025
```

Click **"Verify and Save"** — then subscribe to:

```
Subscribe karo:
  ✅ comments
  ✅ messages
  ✅ messaging_optins
  ✅ feed
  ✅ mention
```

### Page (Facebook) Webhooks:

**Webhooks → Add → Page**

```
Callback URL:   https://contentengineer.techaasvik.in/api/webhooks/meta
Verify Token:   Content Engineer_webhook_verify_2025
```

Subscribe karo:

```
  ✅ messages
  ✅ messaging_postbacks
  ✅ feed
  ✅ mention
```

---

## APP 1 — Step 6: Deauthorize & Data Deletion URLs

**App Dashboard → Settings → Advanced**

```
Deauthorize Callback URL:
  https://contentengineer.techaasvik.in/api/webhooks/deauthorize

Data Deletion Request URL:
  https://contentengineer.techaasvik.in/api/webhooks/data-deletion
```


---

## APP 1 — Step 7: Switch to Live Mode

1. Top mein **Development → Live** toggle karo
2. Popup aayega — click **"Switch to Live Mode"**
3. App Mode: **Live** dikhe tab hi public users connect kar payenge

> ⚠️ Live mode mein kuch permissions kaam nahi karenge jab tak App Review approve na ho.

---

## APP 1 — Step 8: App Review — Kya Submit Karna Hai

**App Dashboard → App Review → Permissions and Features**

Yeh permissions request karo aur neeche ka exact text paste karo:

---

### 📝 Permission: `instagram_manage_messages`

**How will your app use this permission?**
```
Content Engineer is a social media automation platform for Indian content creators.
We use instagram_manage_messages to:
1. Read DMs sent to the user's Instagram account
2. Send automated DM replies when a follower comments with a specific keyword (e.g., user comments "link" on a post → we automatically DM them the link)
3. Send welcome DMs to new followers (opt-in only)
4. All automated messages include an opt-out option: "Reply STOP to unsubscribe"
5. We strictly follow Meta's 24-hour messaging window policy

The user creates automation rules in our dashboard → Content Engineer sends DMs only based on those rules → no unsolicited messages are ever sent.
```

**Provide step-by-step instructions:**
```
1. User logs into contentengineer.techaasvik.in
2. User connects their Instagram account via OAuth (Instagram Login)
3. User goes to Automation → DM Automation → New Rule
4. User types: Rule Name = "Send guide on link comment", Trigger = "comment keyword: link", Action = "DM message: Here's your guide → [link]"
5. When a follower comments "link" on any post, Content Engineer sends them the guide via DM
6. The DM includes: "Reply STOP to unsubscribe"
```

---

### 📝 Permission: `instagram_manage_comments`

**How will your app use this permission?**
```
Content Engineer uses instagram_manage_comments to:
1. Read comments on the user's Instagram posts in real-time via webhooks
2. Auto-reply to comments that match keyword triggers (e.g., reply "Thanks! DM sent 🙌" when someone comments "link")
3. Hide spam comments that contain user-defined spam keywords
4. Analyze comment sentiment for content insights

The user controls all comment automation rules. No comment is hidden or replied to without the user explicitly setting up a rule.
```

**Provide step-by-step instructions:**
```
1. User logs into contentengineer.techaasvik.in and connects Instagram
2. User goes to Automation → Comment Automation → New Rule
3. User sets: Trigger keyword = "interested", Reply = "Thanks for your interest! DM sent 🙌"
4. When a follower comments "I'm interested" on the user's post → Content Engineer auto-replies
5. User can see all triggered rules in their Automation History
```

---

### 📝 Permission: `pages_messaging`

**How will your app use this permission?**
```
Content Engineer uses pages_messaging to:
1. Read messages sent to the user's Facebook Page via Messenger
2. Send automated replies to Messenger messages based on keyword triggers
3. Set up welcome messages for new conversations
4. All automated messages include opt-out instructions per Meta's policies

This feature helps small business owners and content creators respond to customer inquiries automatically when they cannot reply manually (e.g., overnight or when busy creating content).
```

**Provide step-by-step instructions:**
```
1. User logs into contentengineer.techaasvik.in and connects their Facebook Page
2. User goes to Automation → DM Automation → New Rule
3. User selects Trigger = "Messenger keyword: price" and Action = "Reply: Our pricing starts at ₹999/month. Visit contentengineer.techaasvik.in/pricing"
4. When a customer messages the Page with "price", Content Engineer auto-replies
5. Message ends with: "Reply STOP to opt out of automated messages"
```

---

### 📝 Permission: `pages_manage_posts`

**How will your app use this permission?**
```
Content Engineer uses pages_manage_posts to:
1. Schedule and publish posts to the user's Facebook Page at user-defined times
2. Allow users to plan their content calendar and post automatically
3. The user creates, edits, and schedules all posts in our dashboard — we never post without explicit user action
```

**Provide step-by-step instructions:**
```
1. User logs into contentengineer.techaasvik.in and connects Facebook Page
2. User goes to Schedule → New Post
3. User types post content, adds image, sets publish date/time
4. Content Engineer publishes the post at the scheduled time via Pages API
5. User can see published posts in their History tab
```

---

### 📹 Screencast for App Review (record kar ke upload karo):

```
Video mein yeh dikhao (1-3 minutes):
1. contentengineer.techaasvik.in par login karo
2. Connect Instagram/Facebook Page (show OAuth flow)
3. Automation → New Rule banao (keyword: "guide", action: DM)
4. Test Instagram account se comment karo "guide"
5. DM receive hoti dikho
6. Show the opt-out: "Reply STOP"
7. Automation History mein trigger dikho
```

---
---

# ═══════════════════════════════════════════
# APP 2 — `Content Engineer - Login`
# App ID: 2169224913932416
# ═══════════════════════════════════════════

## APP 2 — Step 1: Basic Settings

**App Dashboard → Settings → Basic**

```
App Name:            Content Engineer - Login
App ID:              2169224913932416
App Secret:          95f6342307516e2ee5a4b81e9d04b944
App Contact Email:   contact@techaasvik.com
App Domains:         contentengineer.techaasvik.in
Privacy Policy URL:  https://contentengineer.techaasvik.in/privacy
Terms of Service:    https://contentengineer.techaasvik.in/terms
Category:            Business & Pages

User Data Deletion:
  → Dropdown mein select karo: "Data deletion callback URL"
  → URL: https://contentengineer.techaasvik.in/api/webhooks/data-deletion
```

**App Icon:**
```
1024 x 1024 PNG upload karo
(Transparent background allowed nahi)
```

Click **"Save Changes"**

---

## APP 2 — Step 2: Use Case

**Use cases** tab mein yeh 1 select karo:

```
✅ Authenticate and request data from users with Facebook Login
   (Category: Others)
```

---

## APP 2 — Step 3: Facebook Login Setup

**App Dashboard → Products → Facebook Login → Settings**

```
Client OAuth Login:                   ✅ ON
Web OAuth Login:                      ✅ ON
Force Web OAuth Reauthentication:     ❌ OFF
Use Strict Mode for Redirect URIs:    ✅ ON
Login with the JavaScript SDK:        ✅ ON
Embedded Browser OAuth Login:         ❌ OFF
```

**Valid OAuth Redirect URIs (copy-paste exactly):**

```
https://contentengineer.techaasvik.in/api/connect/callback/instagram
https://contentengineer.techaasvik.in/api/connect/callback/facebook
http://localhost:3000/api/connect/callback/instagram
http://localhost:3000/api/connect/callback/facebook
```

**Allowed Domains for the JavaScript SDK:**

```
contentengineer.techaasvik.in
localhost
```

Click **"Save Changes"**

---

## APP 2 — Step 4: Site URL Set Karo

**Products → Facebook Login → Quickstart → Web**

```
Site URL:   https://contentengineer.techaasvik.in/
```

---

## APP 2 — Step 5: Permissions

**App Dashboard → Use Cases → Authenticate... → Permissions → Add**

```
email             ← Add karo (auto-granted, no review needed)
public_profile    ← Auto-added
instagram_basic   ← Add karo (for Instagram OAuth)
```

---

## APP 2 — Step 6: Add Testers (Dev Mode mein)

**App Dashboard → Roles → Testers → Add**

```
Apna Facebook account add karo
+ Jinhe test karna ho unke Facebook usernames add karo
```

---

## APP 2 — Step 7: Switch to Live Mode

1. Top mein **Development → Live** toggle karo
2. `email` aur `public_profile` ke liye review ki zarurat nahi — ye auto-approved hain
3. `instagram_basic` ke liye bhi review ki zarurat nahi
4. **Live mode on karo** — users login kar payenge

---

## APP 2 — App Review (Mostly Not Required)

`email`, `public_profile`, `instagram_basic` — yeh sab **basic permissions** hain jinka App Review nahi chahiye. Sirf switch to Live mode karo aur kaam ho jayega.

Agar koi aur advanced permissions chahiye to tabhi submit karo.

---
---

# ═══════════════════════════════════════════
# ENVIRONMENT VARIABLES
# ═══════════════════════════════════════════

## Vercel Dashboard → Settings → Environment Variables

```env
# ── App 1: Content Engineer - Business ──────────────────────────────
META_APP_ID=1502207694092231
META_APP_SECRET=0c9a1f963ec483d87cc7070d9f290921
META_WEBHOOK_VERIFY_TOKEN=Content Engineer_webhook_verify_2025

# ── App 2: Content Engineer - Login ──────────────────────────────────
META_LOGIN_APP_ID=2169224913932416
META_LOGIN_APP_SECRET=95f6342307516e2ee5a4b81e9d04b944

# ── Common ────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://contentengineer.techaasvik.in
```

> ✅ Yeh sab already Vercel pe set hain (auto-updated ho gaye hain)

---

# ═══════════════════════════════════════════
# AUTOMATION MODES — Global vs Per-Post
# ═══════════════════════════════════════════

> **Yeh section explain karta hai ki automation kaise kaam karta hai aur dono modes kya hain.**

### Mode 1: Global Automation (Sab posts par)
- User ek rule banata hai
- Wo rule **sab posts/reels ke comments aur DMs** par apply hoga
- Example: "Agar koi bhi comment mein 'link' likhe → DM bhejo"
- `trigger_config` mein `media_id: null`

### Mode 2: Per-Post Automation (Specific post par)
- User pehle apni **recent posts ki list dekhega** (Instagram se fetch hogi)
- Ek specific post/reel select karega
- Rule **sirf us post ke comments** par trigger hoga
- Example: "Sirf is reel ke comments mein 'price' wale DM bhejo"
- `trigger_config` mein `media_id: "17854360229135492"` (specific post ID)

> **Koi alag use case nahi chahiye** per-post automation ke liye — App 1 ka `Manage messaging & content on Instagram` use case hi cover karta hai dono modes ko.

---

# ═══════════════════════════════════════════
# ALL URLS QUICK REFERENCE
# ═══════════════════════════════════════════

| Purpose | URL |
|---|---|
| **App (Production)** | `https://contentengineer.techaasvik.in` |
| **Webhook Callback** | `https://contentengineer.techaasvik.in/api/webhooks/meta` |
| **Instagram OAuth Callback** | `https://contentengineer.techaasvik.in/api/connect/callback/instagram` |
| **Facebook OAuth Callback** | `https://contentengineer.techaasvik.in/api/connect/callback/facebook` |
| **Deauthorize Callback** | `https://contentengineer.techaasvik.in/api/webhooks/deauthorize` |
| **Data Deletion URL** | `https://contentengineer.techaasvik.in/api/webhooks/data-deletion` |
| **Privacy Policy** | `https://contentengineer.techaasvik.in/privacy` |
| **Terms of Service** | `https://contentengineer.techaasvik.in/terms` |
| **Local Dev Instagram** | `http://localhost:3000/api/connect/callback/instagram` |
| **Local Dev Facebook** | `http://localhost:3000/api/connect/callback/facebook` |

---

# ═══════════════════════════════════════════
# COMMON ERRORS & FIXES
# ═══════════════════════════════════════════

| Error | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` | Redirect URI not in whitelist | App 2 → Facebook Login → Settings → Add exact URL |
| `#10 Permission denied` | App in Dev mode, user not a tester | App Dashboard → Roles → Add user as Tester |
| `Invalid verify token` | Webhook token mismatch | Check `META_WEBHOOK_VERIFY_TOKEN` = `Content Engineer_webhook_verify_2025` |
| `Insufficient permission` | Permission not approved by App Review | Wait for review approval |
| `Error validating access token` | Token expired | Re-authenticate user |
| `(#200) Requires business verification` | Business not verified | business.facebook.com → Security Center → Verify |
| `User not a test user` | OAuth in dev mode for non-tester | Add user as Tester in App Roles |

---

# ═══════════════════════════════════════════
# PERMISSIONS CHECKLIST
# ═══════════════════════════════════════════

## App 1 — Content Engineer Business Permissions

```
Instagram (via use case: Manage messaging & content):
  ☑ instagram_basic                  — No review needed
  ☑ instagram_content_publish        — No review needed
  ☑ instagram_manage_insights        — No review needed
  ☑ instagram_manage_comments        — ⚠️ App Review required (1-2 weeks)
  ☑ instagram_manage_messages        — ⚠️ App Review required (2-4 weeks)

Facebook Page (via use case: Manage everything on your Page):
  ☑ pages_show_list                  — No review needed
  ☑ pages_read_engagement            — No review needed
  ☑ pages_read_user_content          — No review needed
  ☑ pages_manage_posts               — ⚠️ App Review required (1-2 weeks)

Messenger (via use case: Engage with customers on Messenger):
  ☑ pages_messaging                  — ⚠️ App Review required (2-4 weeks)
```

## App 2 — Content Engineer Login Permissions

```
  ☑ public_profile                   — No review needed (auto-approved)
  ☑ email                            — No review needed (auto-approved)
  ☑ instagram_basic                  — No review needed
```
