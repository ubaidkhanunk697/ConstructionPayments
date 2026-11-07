# Construction Material & Payment Management System
## Production Deployment, Configuration & Handover Guide

This document provides complete, step-by-step instructions for deploying and maintaining the **Construction Material & Payment Management System** in production using **Vercel** or **Netlify** with a **Supabase** backend.

---

## 1. System Architecture Overview

```
                                  +-------------------------------------+
                                  |         Authorized Owner            |
                                  |      (Desktop / Tablet / Phone)     |
                                  +------------------+------------------+
                                                     |
                                            HTTPS (Encrypted)
                                                     |
                                                     v
                                  +-------------------------------------+
                                  |     Vercel / Netlify CDN            |
                                  |  - Static HTML5, CSS3, ES6+ JS      |
                                  |  - SheetJS (XLSX) Excel Engine      |
                                  |  - Strict Security Headers (HSTS)   |
                                  +------------------+------------------+
                                                     |
                                   REST / WebSocket (Anon Key + JWT)
                                                     |
                                                     v
          +------------------------------------------+------------------------------------------+
          |                                  Supabase Cloud                                     |
          |                                                                                     |
          |  +--------------------+   +--------------------------------+   +-----------------+  |
          |  |    Google OAuth    |   |     PostgreSQL 15 Database     |   |  Row Level      |  |
          |  |  Single Authorized |   | - profiles                     |   |  Security (RLS) |  |
          |  |  Owner Allowlist   |   | - material_records             |   | - auth.uid()    |  |
          |  |  Auto-ejection     |   | - payments                     |   |   UUID Check    |  |
          |  +--------------------+   | - Views, Triggers & Safety RPC |   +-----------------+  |
          |                           +--------------------------------+                        |
          +-------------------------------------------------------------------------------------+
```

---

## 2. Step 1: Supabase Database Migration

1. Log in to [Supabase](https://supabase.com) and create or open your project.
2. In the left navigation, click on **SQL Editor**.
3. Click **New Query**.
4. Open the master migration file in this repository:
   `database/full_migration.sql`
5. Copy the entire contents of `database/full_migration.sql` and paste them into the Supabase SQL editor.
6. Click **Run** (or press `Ctrl+Enter`).
7. **Verification**:
   - Go to **Table Editor**: verify `profiles`, `material_records`, and `payments` tables exist.
   - Go to **Database &rarr; Roles &rarr; Policies**: verify that Row Level Security (RLS) is **Enabled** and **Forced** on all 3 tables with `auth.uid() = user_id` policies.
   - Go to **Database &rarr; Functions**: verify `validate_payment_integrity`, `protect_material_total_due`, `get_material_deletion_impact`, and `delete_material_record_explicit` exist.

---

## 3. Step 2: Google OAuth Configuration

### A. Google Cloud Console
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project (or create a new project, e.g. `House-Construction-System`).
3. In the left menu, go to **APIs & Services &rarr; OAuth consent screen**.
   - User Type: **External**.
   - App Name: `House Construction Management`.
   - User support email: Select your email.
   - Developer contact email: Enter your email.
   - Save and continue through Scopes (default openid, profile, email).
4. In the left menu, go to **Credentials &rarr; Create Credentials &rarr; OAuth client ID**.
   - Application type: **Web application**.
   - Name: `House Construction Web App`.
   - **Authorized JavaScript origins**:
     - `https://<YOUR-PROJECT-REF>.supabase.co`
     - `https://<YOUR-APP-SUBDOMAIN>.vercel.app` (or your Netlify URL)
     - `http://localhost:5500` (optional, for local testing)
   - **Authorized redirect URIs**:
     - `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`
5. Click **Create**. Copy your **Client ID** and **Client Secret**.

### B. Supabase Auth Configuration
1. Open your Supabase Dashboard &rarr; **Authentication &rarr; Providers**.
2. Select **Google** and toggle it **Enabled**.
3. Paste the **Client ID** and **Client Secret** obtained from Google Cloud Console.
4. Click **Save**.
5. In the Supabase left menu, go to **Authentication &rarr; URL Configuration**:
   - **Site URL**: `https://<YOUR-APP-SUBDOMAIN>.vercel.app/dashboard.html`
   - **Redirect URLs**: Add:
     - `https://<YOUR-APP-SUBDOMAIN>.vercel.app/**`
     - `https://<YOUR-APP-SUBDOMAIN>.netlify.app/**`
     - `http://localhost:5500/**` (optional)
6. Click **Save**.

---

## 4. Step 3: Frontend Environment Configuration

In your project directory, copy `js/env.template.js` to `js/env.js`:

```javascript
// js/env.js
window.ENV = {
  // Your Supabase Project URL (from Project Settings -> API)
  SUPABASE_URL: "https://your-project-ref.supabase.co",

  // Your Publishable 'anon' Key (from Project Settings -> API)
  // NEVER use the 'service_role' secret key!
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",

  // Your Authorized Owner Google Account Email
  ALLOWED_OWNER_EMAIL: "your.google.account@gmail.com",

  // Optional: Authorized Owner UUID (leave blank to auto-detect from email)
  ALLOWED_OWNER_UUID: ""
};
```

> [!CAUTION]
> **CRITICAL SECURITY RULE**: Never place the Supabase `service_role` secret key anywhere in frontend code, HTML, CSS, or JavaScript files. The frontend only requires the public `anon` key. All database actions are strictly guarded by Row Level Security (RLS).

---

## 5. Step 4: Production Deployment

### Option A: Deploy to Vercel (Recommended)

#### Method 1: Vercel CLI (Fastest)
1. Install Vercel CLI (if not already installed):
   ```bash
   npm install -g vercel
   ```
2. In the project directory (`f:\Construction Payment System`), run:
   ```bash
   vercel
   ```
3. Follow the CLI prompts:
   - Set up and deploy: **Yes**
   - Which scope: Select your personal account
   - Link to existing project: **No**
   - Project name: `house-construction-ledger` (or your preferred name)
   - Directory: `./`
   - Modify settings: **No**
4. For production deployment, run:
   ```bash
   vercel --prod
   ```
5. Your production URL will be displayed: `https://house-construction-ledger.vercel.app`.

#### Method 2: Vercel Dashboard (GitHub / Git)
1. Push your project code to a private GitHub repository.
2. Go to [vercel.com](https://vercel.com) and click **Add New &rarr; Project**.
3. Import your GitHub repository.
4. Framework Preset: **Other** (Static HTML).
5. Build Command: Leave blank (Zero build required).
6. Output Directory: Leave blank (`.` root).
7. Click **Deploy**.

---

### Option B: Deploy to Netlify

#### Method 1: Netlify Drag-and-Drop
1. Log in to [Netlify](https://app.netlify.com).
2. Go to **Sites** and scroll to the bottom: **"Need to deploy a new site without connecting to Git? Drag and drop your site output folder here."**
3. Drag the entire `Construction Payment System` project folder into the browser window.
4. Netlify will deploy instantly and provide an active URL (e.g. `https://house-payments-123.netlify.app`).

#### Method 2: Netlify CLI
1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```
2. In the project directory, run:
   ```bash
   netlify deploy --prod --dir=.
   ```

---

## 6. Step 5: Post-Deployment Verification Checklist

Complete the following verification steps on your live production URL:

- [ ] **HTTPS Enforcement**: Ensure the URL begins with `https://` and has a valid SSL certificate.
- [ ] **Security Headers**: Inspect browser DevTools &rarr; Network &rarr; Response Headers to confirm:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=63072000`
- [ ] **Google OAuth Login**:
  1. Click **"Sign in with Google"** on `login.html`.
  2. Log in using your authorized Google account.
  3. Verify you are automatically redirected to `dashboard.html` with your name and avatar displayed.
- [ ] **Unauthorized Account Rejection**:
  1. Open an Incognito window.
  2. Sign in with any Google account **not** matching `ALLOWED_OWNER_EMAIL`.
  3. Verify the system rejects the session, immediately logs out, and displays the crimson alert banner.
- [ ] **Material Records Operations**:
  1. Click **"Add Material"**, fill out supplier, quantity, and PKR amount.
  2. Save and verify live update on the 4 dashboard summary cards.
  3. Click **"Edit"**, update notes or quantity, review the **"Confirm Record Changes"** modal, and save.
- [ ] **Payment Transactions Operations**:
  1. Click **"Pay"** on a material record.
  2. Enter payment amount, date, method (`Cash`, `Bank Transfer`, etc.), and notes.
  3. Verify overpayment (> pending balance) is strictly blocked.
  4. Save and verify Paid Amount increases and Pending Amount decreases.
  5. Click **"History"**, review transactions, and test editing/deleting a payment.
- [ ] **Excel Download**:
  1. Click **"Download Excel"** in the topbar or material toolbar.
  2. Open the downloaded `.xlsx` file in Excel, Google Sheets, or LibreOffice.
  3. Verify all 3 worksheets exist: `Material Records`, `Payment History`, and `Summary`.
  4. Confirm frozen header rows and auto-formatted column widths.
- [ ] **Mobile Responsiveness**:
  1. Open the website on an iPhone or Android phone.
  2. Verify sidebar collapses to a sliding menu drawer.
  3. Verify the wide table transforms into touch-friendly cards.
  4. Verify bottom navigation bar provides 1-tap access to Dashboard, Materials, Payments, and Security.

---

## 7. Automated Backups & Disaster Recovery

### A. Supabase Cloud Automated Backups
- Supabase automatically performs **Daily Backups** of your PostgreSQL database.
- Backups are retained according to your Supabase project tier (7 days on Free tier, 30 days on Pro tier).
- To access backups: Supabase Dashboard &rarr; **Project Settings &rarr; Database &rarr; Backups**.

### B. Manual Offline Backup (Recommended Weekly / Monthly)
To maintain an independent offline SQL backup on your local machine:

1. Install PostgreSQL client tools (`pg_dump`).
2. Run the following command (substituting your Supabase connection string from **Project Settings &rarr; Database &rarr; Connection string &rarr; URI**):
   ```bash
   pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
     --clean --if-exists --quote-all-identifiers \
     --file="backup_construction_ledger_$(date +%Y%m%d).sql"
   ```

### C. Restoring from Backup
If disaster strikes:
1. Open Supabase Dashboard &rarr; **SQL Editor**.
2. Run `database/full_migration.sql` to recreate tables, triggers, and views.
3. Import your offline SQL dump or restore the daily snapshot from Supabase **Backups** tab.

---

## 8. Ongoing Maintenance & Customization

- **Adding New Material Types**:
  Open `js/config.js` and add items to `CONFIG.MATERIAL_TYPES`:
  ```javascript
  MATERIAL_TYPES: [
    "Cement",
    "Steel / Sariya",
    "Sand / Rait",
    "Bricks / Eint",
    "Solar Panels & Inverters", // New category
    ...
  ]
  ```
- **Adding New Measurement Units**:
  Open `js/config.js` and add items to `CONFIG.QUANTITY_UNITS`:
  ```javascript
  QUANTITY_UNITS: ["Bags", "Tons", "Senkrra", "Bricks", "Sariya", "Meters", "Other"]
  ```
- **Updating Authorized Owner**:
  If the owner changes their Google email, update `ALLOWED_OWNER_EMAIL` in `js/env.js`.

---

## 9. Final QA Test Suite Verification

Run the master automated QA suite anytime to verify database constraints, business math, and security rules:

```bash
node tests/run_full_audit.js
```

**Output**:
```
================================================================
AUDIT RESULTS: 42 PASSED, 0 FAILED (TOTAL: 42)
STATUS: ALL AUDIT TESTS PASSED WITH ZERO UNRESOLVED ISSUES.
================================================================
```
