/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Google Drive REST API v3 Direct Export Service
 * Uses Google Identity Services (GIS) Token Client for Client-Side OAuth2
 * Scope: https://www.googleapis.com/auth/drive.file (Strictly isolated to app-created files)
 */

// Production Google OAuth Web Client ID for Google Drive Export
const GOOGLE_CLIENT_ID = "767207458104-srq6jskuq2fi6e6abo80jsb7tjne2590.apps.googleusercontent.com";

const GoogleDriveExport = {
  tokenClient: null,
  accessToken: null,
  tokenExpiresAt: 0,
  isUploading: false,

  /**
   * Check if Google Identity Services SDK is loaded
   */
  isGisLoaded() {
    return Boolean(
      typeof window !== "undefined" &&
      window.google &&
      window.google.accounts &&
      window.google.accounts.oauth2
    );
  },

  /**
   * Get configured Google OAuth 2.0 Web Client ID
   */
  getClientId() {
    return (
      (typeof window !== "undefined" && window.ENV?.GOOGLE_CLIENT_ID) ||
      (typeof CONFIG !== "undefined" && CONFIG.GOOGLE_DRIVE?.CLIENT_ID) ||
      GOOGLE_CLIENT_ID
    ).trim();
  },

  /**
   * Check if an active, non-expired Access Token exists
   */
  hasValidToken() {
    return Boolean(this.accessToken && Date.now() < this.tokenExpiresAt - 60000);
  },

  /**
   * Initialize or retrieve GIS Token Client
   */
  initTokenClient(onSuccess, onError) {
    if (!this.isGisLoaded()) {
      throw new Error("Google Identity Services library is not loaded. Please verify your internet connection.");
    }

    const clientId = this.getClientId();
    if (!clientId || clientId.includes("YOUR_")) {
      throw new Error("Google Client ID is not configured. Please add your Client ID to js/config.js.");
    }

    return window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: (typeof CONFIG !== "undefined" && CONFIG.GOOGLE_DRIVE?.SCOPE) || "https://www.googleapis.com/auth/drive.file",
      callback: (response) => {
        if (response.error) {
          console.error("GIS Token Error:", response);
          if (onError) onError(new Error(response.error_description || response.error));
          return;
        }

        this.accessToken = response.access_token;
        const expiresInSec = Number(response.expires_in) || 3599;
        this.tokenExpiresAt = Date.now() + expiresInSec * 1000;

        if (onSuccess) onSuccess(this.accessToken);
      }
    });
  },

  /**
   * Request an OAuth 2.0 Access Token via Google Identity Services
   */
  requestAccessToken() {
    return new Promise((resolve, reject) => {
      try {
        if (this.hasValidToken()) {
          resolve(this.accessToken);
          return;
        }

        const tokenClient = this.initTokenClient(
          (token) => resolve(token),
          (err) => reject(err)
        );

        // Request token with consent prompt if no token previously granted
        tokenClient.requestAccessToken({ prompt: "" });
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Update UI button states during upload
   */
  setLoadingState(isLoading, statusText = "") {
    this.isUploading = isLoading;
    const gdriveBtnHeader = document.getElementById("btn-export-gdrive");
    const gdriveBtnToolbar = document.getElementById("btn-export-gdrive-toolbar");
    const buttons = [gdriveBtnHeader, gdriveBtnToolbar].filter(Boolean);

    buttons.forEach((btn) => {
      btn.disabled = isLoading;
      const label = btn.querySelector(".btn-label-responsive") || btn.querySelector("span");
      if (label) {
        if (isLoading) {
          btn.dataset.originalText = btn.dataset.originalText || label.textContent;
          label.textContent = statusText || "Saving...";
        } else if (btn.dataset.originalText) {
          label.textContent = btn.dataset.originalText;
        }
      }

      if (isLoading) {
        btn.classList.add("btn-loading");
      } else {
        btn.classList.remove("btn-loading");
      }
    });
  },

  /**
   * Main Google Drive Upload Workflow:
   * 1. Authenticate with Google
   * 2. Generate Excel Blob via ExportService
   * 3. Multipart POST directly to Google Drive REST API v3
   * 4. Display success toast with clickable webViewLink
   */
  async saveToGoogleDrive() {
    if (this.isUploading) return;

    const clientId = this.getClientId();
    if (!clientId || clientId.includes("YOUR_")) {
      UI.showToast(
        "Google Client ID is not configured yet. Add your OAuth Client ID into <code>js/config.js</code> or <code>js/env.js</code>. Refer to GOOGLE_DRIVE_SETUP.md for instructions.",
        "warning",
        "Google Drive Setup Required",
        12000
      );
      return;
    }

    if (typeof ExportService === "undefined" || typeof ExportService.generateExcelBlob !== "function") {
      UI.showToast("Export engine is still initializing. Please try again in a moment.", "error", "Export Error");
      return;
    }

    this.setLoadingState(true, "Connecting to Drive...");

    try {
      UI.showToast("Connecting to your Google Drive...", "info", "Google Drive");

      // Step 1: Acquire Google OAuth Access Token
      const token = await this.requestAccessToken();

      this.setLoadingState(true, "Generating Report...");
      UI.showToast("Generating Excel spreadsheet from project data...", "info", "Preparing Report");

      // Step 2: Generate identical Excel workbook blob
      const { blob, filename, materialsCount } = await ExportService.generateExcelBlob();

      this.setLoadingState(true, "Uploading to Drive...");
      UI.showToast("Uploading Excel workbook directly to your Google Drive...", "info", "Uploading");

      // Step 3: Construct multipart/related request payload
      const boundary = "-------ConstructionSystemUpload" + Date.now();
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadata = {
        name: filename,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        description: `Construction Financial Report generated on ${new Date().toLocaleString("en-PK")} (${materialsCount} records).`
      };

      const multipartBody = new Blob(
        [
          delimiter,
          "Content-Type: application/json; charset=UTF-8\r\n\r\n",
          JSON.stringify(metadata),
          delimiter,
          "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n",
          blob,
          closeDelimiter
        ],
        { type: `multipart/related; boundary=${boundary}` }
      );

      // Step 4: Dispatch POST to Google Drive API v3
      const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink";
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: multipartBody
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `Google Drive API returned status ${response.status}`;
        throw new Error(errMsg);
      }

      const fileData = await response.json();
      console.log("Uploaded successfully to Google Drive:", fileData);

      // Step 5: Deliver user success toast with direct link
      const viewUrl = fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`;
      const toastMessage = `
        <span>Excel file <strong>${fileData.name}</strong> successfully saved to your Google Drive!</span>
        <div style="margin-top: 6px;">
          <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" style="color: #60A5FA; text-decoration: underline; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            Open File in Google Drive &rarr;
          </a>
        </div>
      `;

      UI.showToast(toastMessage, "success", "Saved to Google Drive", 12000);

    } catch (err) {
      console.error("Google Drive Upload Error:", err);
      const isUserClosed = err.message?.includes("popup_closed") || err.message?.includes("access_denied");
      if (isUserClosed) {
        UI.showToast("Google authorization request was cancelled.", "info", "Authorization Cancelled");
      } else {
        UI.showToast(
          err.message || "Failed to upload file to Google Drive. Please check your credentials.",
          "error",
          "Google Drive Error"
        );
      }
    } finally {
      this.setLoadingState(false);
    }
  }
};

// Bind to window for global access
if (typeof window !== "undefined") {
  window.GoogleDriveExport = GoogleDriveExport;
}
