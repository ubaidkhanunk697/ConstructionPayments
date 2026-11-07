# Supabase Google Authentication & Single-Owner Setup Guide

This guide walks you through configuring **Google OAuth** in **Supabase** for the **Construction Material & Payment Management System**, enforcing single-owner access, and configuring your local environment.

---

## 1. Get Supabase API Credentials

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project (e.g. `Construction-Payment-System`) or select an existing one.
3. In the left navigation, navigate to **Project Settings** (gear icon) &rarr; **API**.
4. Locate the following two values under **Project API keys**:
   - **Project URL**: e.g. `https://xyzprojectref.supabase.co`
   - **anon / public key**: Starts with `eyJ...`
   
> [!CAUTION]
> **NEVER USE THE `service_role` KEY!**
> The `service_role` key bypasses Row Level Security (RLS) and gives total superadmin access. It must **never** be placed in frontend code, HTML, CSS, or JavaScript files. Use **only** the `anon` (publishable) key.

---

## 2. Set Up Google Cloud OAuth 2.0 Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `Construction Payment Portal`).
3. In the left menu, select **APIs & Services** &rarr; **OAuth consent screen**:
   - User Type: Choose **External** &rarr; click **Create**.
   - App name: `Construction Material & Payment System`.
   - User support email: Select your email.
   - Developer contact email: Enter your email.
   - Click **Save and Continue** through Scopes (default `email`, `profile`, `openid` are sufficient).
4. Navigate to **APIs & Services** &rarr; **Credentials**:
   - Click **+ CREATE CREDENTIALS** &rarr; **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Supabase Google Auth`.
   - Under **Authorized redirect URIs**, click **+ ADD URI** and enter your Supabase callback URL:
     ```
     https://<YOUR-PROJECT-ID>.supabase.co/auth/v1/callback
     ```
     *(Replace `<YOUR-PROJECT-ID>` with your actual Supabase project reference from Step 1).*
   - Click **Create**.
   - Copy the **Client ID** and **Client Secret**.

---

## 3. Enable Google Provider in Supabase

1. In the Supabase Dashboard, navigate to **Authentication** &rarr; **Providers**.
2. Select **Google** from the list:
   - Toggle **Enable Google provider** to ON.
   - Paste the **Client ID** from Google Cloud.
   - Paste the **Client Secret** from Google Cloud.
   - Click **Save**.
3. In the Supabase Dashboard, navigate to **Authentication** &rarr; **URL Configuration**:
   - **Site URL**: Enter your local dev server or hosting URL (e.g., `http://localhost:3000` or `http://127.0.0.1:5500`).
   - **Redirect URLs**: Add the redirect URLs where you want the user to land after Google OAuth:
     - `http://localhost:3000/dashboard.html`
     - `http://127.0.0.1:5500/dashboard.html`
     - Your production domain URL (e.g., `https://your-domain.com/dashboard.html`).
   - Click **Save**.

---

## 4. Single-Owner Security & Blocking Public Registration

The system enforces strict single-owner protection at two levels:

1. **Client-Side Authorization Guard (`js/auth.js`)**:
   - When any Google account authenticates, `Auth.requireOwnerAuth()` validates the account's email against `CONFIG.AUTH.ALLOWED_OWNER_EMAIL`.
   - If someone signs in with an unapproved Google account, the system **immediately executes `supabase.auth.signOut()`**, invalidates their token, and redirects them to `login.html?error=unauthorized` with an access denied message.
2. **Supabase Provider Restrictions (Recommended)**:
   - In Supabase Dashboard &rarr; **Authentication** &rarr; **Settings**:
   - Under **Sign Up**, once you have logged in once and created your owner account, you can toggle **"Allow new users to sign up"** to **OFF** to prevent any third-party accounts from even being created in your Supabase Auth table.

---

## 5. Configure Your Local Environment

1. In the project folder, locate the template file in `js/`:
   ```
   js/env.template.js
   ```
2. Copy this file to a new file named `env.js` inside the `js/` directory:
   ```powershell
   Copy-Item js/env.template.js js/env.js
   ```
3. Open `js/env.js` and update it with your actual settings:
   ```javascript
   window.ENV = {
     SUPABASE_URL: "https://your-project-id.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     ALLOWED_OWNER_EMAIL: "your-exact-email@gmail.com",
     ALLOWED_OWNER_UUID: "" // Optional: populate after first login
   };
   ```

---

## 6. Verification and Testing

### A. Testing Unauthenticated Access
1. Try navigating directly to `dashboard.html` in an incognito window without signing in.
2. **Expected Result**: You are automatically redirected to `login.html?reason=unauthenticated`.

### B. Testing Unauthorized Google Account
1. On `login.html`, click **Continue with Google** and select a Google account that is *different* from `ALLOWED_OWNER_EMAIL`.
2. **Expected Result**: 
   - Authentication succeeds with Google, but the app's authorization guard detects that the email does not match `ALLOWED_OWNER_EMAIL`.
   - The session is immediately terminated (`supabase.auth.signOut()`).
   - You are redirected to `login.html?error=unauthorized&attempted=...` showing the red banner:
     *"Access Denied: Google account ... is not approved to access this system. Only the designated project owner has access."*

### C. Testing Authorized Owner Login
1. On `login.html`, click **Continue with Google** and choose the approved owner email.
2. **Expected Result**:
   - The user is authenticated and authorized.
   - Redirected to `dashboard.html`.
   - Sidebar displays the owner's name, email, and avatar initial.

### D. Testing Session Persistence
1. Refresh `dashboard.html`.
2. **Expected Result**: You remain logged in without any re-prompting.

### E. Testing Secure Logout
1. In the sidebar footer, click the **Sign Out** button (log-out icon).
2. Confirm the prompt.
3. **Expected Result**: Session is destroyed in Supabase Auth, and you are redirected to `login.html?notice=logged_out` with the notification: *"You have been successfully and securely logged out."*
