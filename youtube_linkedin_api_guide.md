# YouTube & LinkedIn API Guide

This guide covers how to set up applications to get credentials (API Keys, Client IDs, Client Secrets) for Google/YouTube and LinkedIn. This is required if you want to implement automated posting to those platforms.

---

## Google (YouTube) API Setup

To get a Google Client ID and Secret that allows you to post to YouTube, you must create a project in the Google Cloud Console.

### 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. In the top-left dropdown, click **New Project**.
3. Name your project (e.g., "Content Engineer UGC") and click **Create**.
4. Once created, select your new project from the dropdown.

### 2. Enable the YouTube Data API v3
1. In the left navigation menu, go to **APIs & Services** → **Library**.
2. Search for "YouTube Data API v3" and click on it.
3. Click **Enable**.

### 3. Configure the OAuth Consent Screen
1. Go to **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (unless you have a Google Workspace and want this for internal use only) and click **Create**.
3. Fill out the required fields:
   - **App Name**: Content Engineer
   - **User Support Email**: Your email
   - **Developer Contact Information**: Your email
4. Click **Save and Continue**.
5. **Scopes**: Click "Add or Remove Scopes". You need to add scopes that allow YouTube uploads.
   - Search for `https://www.googleapis.com/auth/youtube.upload` and `https://www.googleapis.com/auth/youtube` and check them.
6. Click **Save and Continue**.
7. **Test Users**: While your app is in "Testing" mode, only the Google accounts added here can log in and post. Add your own email address here.

### 4. Create Credentials (Client ID & Secret)
1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** at the top and select **OAuth client ID**.
3. Choose **Web application** as the application type.
4. Name the client (e.g., "Web Client").
5. Under **Authorized redirect URIs**, add the callback URL for your app.
   - *Localhost*: `http://localhost:3000/api/auth/callback/google`
   - *Production*: `https://contentengineer.techaasvik.in/api/auth/callback/google`
6. Click **Create**.
7. You will be given a **Client ID** and **Client Secret**. Copy these into your `.env` file as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

> [!WARNING]
> While in "Testing" mode, OAuth tokens expire after 7 days. To prevent this, you must click **Publish App** on the OAuth consent screen. Note that publishing an app with sensitive scopes (like YouTube upload) may require a security review by Google, which involves submitting a video demonstrating how your app uses the scopes.

---

## LinkedIn API Setup

To get a LinkedIn Client ID and Secret to post on behalf of users or company pages, you must create an app on the LinkedIn Developer Portal.

### 1. Create a LinkedIn App
1. Go to the [LinkedIn Developer Portal](https://developer.linkedin.com/).
2. Click **My Apps** and then **Create App**.
3. Fill in the details:
   - **App Name**: Content Engineer
   - **LinkedIn Page**: You MUST link a LinkedIn Company Page to your app. If you don't have one, create a free Company Page first.
   - **Privacy Policy URL**: (Optional for dev, required for prod)
   - Upload a logo.
4. Agree to the terms and click **Create app**.

### 2. Verify Your App
You must verify that you are the owner of the Company Page linked to the app.
1. On your app dashboard, go to the **Settings** tab.
2. Under "Company Page Verification", click **Verify**. 
3. This will generate a verification URL. Send this URL to the admin of the Company Page (or open it yourself if you are the admin) and approve it.

### 3. Request Product Access
To post to LinkedIn, your app needs specific permissions.
1. Go to the **Products** tab.
2. Request access to **Share on LinkedIn** (for posting to personal profiles) and **Sign In with LinkedIn using OpenID Connect** (for logging in).
3. If you want to post to company pages, also request **Advertising API** or **Marketing Developer Platform** (note: this requires a formal review process by LinkedIn).
4. Wait for approval. "Share on LinkedIn" is usually approved instantly.

### 4. Get Credentials and Set Redirect URIs
1. Go to the **Auth** tab.
2. Under **OAuth 2.0 settings**, click the pencil icon next to **Authorized redirect URLs for your app**.
3. Add your callback URLs:
   - *Localhost*: `http://localhost:3000/api/auth/callback/linkedin`
   - *Production*: `https://contentengineer.techaasvik.in/api/auth/callback/linkedin`
4. Above that section, under **Application credentials**, you will find your **Client ID** and **Primary Client Secret**.
5. Copy these into your `.env` file as `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.

> [!IMPORTANT]
> LinkedIn access tokens typically last 60 days. Your app will need to implement logic to refresh these tokens, or the user will need to log in again via OAuth every 60 days to keep the connection active.
