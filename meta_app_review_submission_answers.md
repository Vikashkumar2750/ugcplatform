# Meta App Review — Submission Answers

Use this document to copy-paste the exact answers for the final submission form in the Meta App Dashboard.

---

## instructions-web-2 (Provide instructions for accessing the app)

Our application "Content Engineer" is a web-based SaaS platform for Instagram and Facebook content creators. It is accessible at:
https://contentengineer.techaasvik.in

=== FACEBOOK LOGIN INTEGRATION ===
We use Email/Password as the primary authentication method for our platform. Facebook Login is used exclusively in our dashboard to allow users to connect their Instagram Business accounts and Facebook Pages via OAuth.

Meta APIs used:
- Facebook Login (email, public_profile)
- Instagram Graph API (media, comments, messaging)
- Facebook Pages API (page management)

=== STEP-BY-STEP TESTING INSTRUCTIONS ===

1. SIGN UP / LOGIN (Email):
   - Go to https://contentengineer.techaasvik.in
   - Sign in using the following test credentials:
     Email: smused3@gmail.com
     Password: test@123

2. CONNECT INSTAGRAM ACCOUNT (Facebook Login):
   - After login, go to https://contentengineer.techaasvik.in/connect (or Settings)
   - Click "Connect" to trigger the Facebook OAuth flow.
   - Now log into the Facebook Test Account (provided below) to link an Instagram Business account and Facebook Page.
   - The connected accounts will appear in the dashboard

3. TEST INSTAGRAM INSIGHTS:
   - Go to https://contentengineer.techaasvik.in/insights
   - View follower growth, engagement metrics, and top posts

4. TEST AUTOMATION — DM RULES:
   - Go to https://contentengineer.techaasvik.in/automation/dm
   - Click "Create New Rule"
   - Enter trigger keyword (e.g., "test")
   - Enter auto-reply text
   - Click Save
   - Send a DM containing "test" to the connected Instagram account to verify the auto-reply

5. TEST AUTOMATION — COMMENT RULES:
   - Go to https://contentengineer.techaasvik.in/automation/comments
   - Click "Create New Rule"
   - Enter keyword "test", and enter Reply text & DM text
   - Comment "test" on any post of the connected account to see the auto-reply and auto-DM working

6. TEST AUTOMATION — FLOWS:
   - Go to https://contentengineer.techaasvik.in/automation/flows
   - Click "Templates" tab to see pre-built automation templates
   - Click "Use" on any template to create a pre-filled automation

=== PERMISSIONS USED ===
- email: To identify the user and create their account
- public_profile: To display user name and profile picture
- pages_show_list: To list user's Facebook Pages for connection
- pages_manage_metadata: To subscribe Pages to webhooks for real-time updates
- pages_messaging: To send automated DMs via Facebook Page inbox
- business_management: To access business-level metadata and link Pages to IG
- instagram_basic & instagram_business_basic: To read Instagram profile info and media
- instagram_manage_comments: To read/reply to comments on Instagram posts
- instagram_business_manage_messages: To send/receive Instagram DMs for automation

All permissions are essential for the core functionality of the platform as described above.

---

## accesscode-web-1 (Test Credentials)

No payment is required to access the platform. It is free to use during review.

Test Login Credentials for Web App:
- Email: smused3@gmail.com
- Password: test@123

Test Credentials for Facebook / Instagram:
(Meta Reviewers MUST use this account to test the Instagram integration. It already has an IG Business Account connected to a FB Page).
- Facebook Email: smuserd3@gmail.com
- Facebook Password: Smuserd3@2706

To test:
1. Log into the web app using the Email and Password above.
2. Go to the "Connect" page inside the app and click "Connect".
3. When prompted by Facebook OAuth, log in using the Facebook Email and Password provided above.
4. The test user has full access to all features. No subscription is required.

---

## accesscode-web-2 (Gift codes)

Not applicable. This is a web-based application accessible at https://contentengineer.techaasvik.in — no download or payment is required.

---

## geo-web-5 (Geo-restrictions)

There are no geographic restrictions, geo-blocking, or geo-fencing on this application. It is accessible from any location worldwide. The application is hosted globally and is accessible from all regions without any restrictions.

---

## fblogin-web-1 (Is Facebook Login integrated?)

Yes (It is used for connecting the business accounts in the dashboard, though the main app login is email-based).
