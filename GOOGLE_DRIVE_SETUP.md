# Google Drive Direct Export Setup Guide

This guide walks you through enabling the **Save to Google Drive** feature for the Construction Material & Payment Management System using **Google Identity Services (GIS)** and the **Google Drive REST API v3**.

---

## 1. Create Google Cloud Project & Enable Google Drive API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select an existing project or click **New Project** (e.g., `Construction Payments Drive`).
3. In the search bar at the top, type **Google Drive API** and click on it.
4. Click **Enable**.

---

## 2. Configure OAuth Consent Screen

1. In the left navigation, go to **APIs & Services** &rarr; **OAuth consent screen**.
2. Select **External** (or **Internal** if using Google Workspace), then click **Create**.
3. Fill in the App Information:
   - **App name**: `Construction Payment Management`
   - **User support email**: Your Gmail address
   - **Developer contact information**: Your Gmail address
4. Click **Save and Continue**.
5. **Scopes**:
   - Click **Add or Remove Scopes**.
   - In the filter box, search for `drive.file`.
   - Check the box for `.../auth/drive.file` (*"See, edit, create, and delete only the specific Google Drive files you use with this app"*).
   - Click **Update** &rarr; **Save and Continue**.
6. **Test Users** (while app is in Testing mode):
   - Click **Add Users**.
   - Add your Google account email (e.g. `dr.nawaz2009@gmail.com`).
   - Click **Save and Continue**.

---

## 3. Create OAuth 2.0 Web Client ID

1. In the left navigation, go to **APIs & Services** &rarr; **Credentials**.
2. Click **+ Create Credentials** at the top &rarr; select **OAuth client ID**.
3. Under **Application type**, choose **Web application**.
4. Set **Name**: `Construction System Web Client`.
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add:
   - `http://localhost:3000` (for local development)
   - `http://localhost:5500` (if using Live Server)
   - `http://127.0.0.1:5500`
   - `https://nawazconstructions.vercel.app` (your production Vercel domain)
6. Leave **Authorized redirect URIs** empty (Google Identity Services Token Client uses in-browser token exchange without requiring server redirects).
7. Click **Create**.
8. Copy the generated **Client ID** (it looks like `1234567890-abcdefg.apps.googleusercontent.com`).

---

## 4. Add Client ID to the Application

Open `js/config.js` and paste your Client ID into `GOOGLE_DRIVE.CLIENT_ID`:

```javascript
  // Google Drive REST API & Google Identity Services (GIS)
  GOOGLE_DRIVE: {
    CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    SCOPE: "https://www.googleapis.com/auth/drive.file"
  },
```

Or, if using a local environment file `js/env.js`:
```javascript
window.ENV = {
  GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
};
```

---

## 5. How It Works

1. On the Dashboard, click **Save to Drive** (located in the top header and above the materials table).
2. A Google account selector popup will appear asking for permission to save files to your Google Drive.
3. Once approved, the system generates the exact same Excel workbook and uploads it directly to your Drive via `multipart/related` POST request.
4. A toast notification appears with a direct link: **"Open File in Google Drive &rarr;"**.
