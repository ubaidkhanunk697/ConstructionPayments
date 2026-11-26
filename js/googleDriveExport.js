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
   * Find or Create a folder in Google Drive (Singleton root support)
   */
  async findOrCreateFolder(token, folderName, parentId = null) {
    let q = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentId) {
      q += ` and '${parentId}' in parents`;
    }
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&spaces=drive`;
    const res = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to search folder: ${res.status}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return await this.createFolder(token, folderName, parentId);
  },

  /**
   * Create a folder in Google Drive API v3
   */
  async createFolder(token, folderName, parentId = null) {
    const metadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder"
    };
    if (parentId) {
      metadata.parents = [parentId];
    }

    const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify(metadata)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create folder '${folderName}': ${res.status}`);
    }
    return await res.json();
  },

  /**
   * Upload binary file blob to a specific Google Drive folder using RFC 2387 multipart
   */
  async uploadFileToFolder(token, blob, filename, mimeType, parentId) {
    const boundary = "-------ConstructionSystemUpload" + Date.now() + Math.random().toString(36).substring(2, 6);
    const delimiter = `--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: filename,
      mimeType: mimeType,
      parents: [parentId]
    };

    const metadataPart =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      "\r\n" +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n`;

    const multipartBlob = new Blob([metadataPart, blob, closeDelimiter], {
      type: `multipart/related; boundary=${boundary}`
    });

    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body: multipartBlob
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to upload '${filename}': ${response.status}`);
    }
    return await response.json();
  },

  /**
   * Main Google Drive Upload Workflow (Hierarchical Backup):
   * 1. Authenticate with Google (GIS)
   * 2. Find or create singleton root folder: 'Nawaz Constructions Backups'
   * 3. Create date-wise subfolder: 'Backup_YYYY-MM-DD_HH-mm'
   * 4. Create 'Excel' and 'Photos' subfolders inside date folder
   * 5. Upload Material_Records.xlsx into 'Excel'
   * 6. Upload all filtered receipt images into 'Photos'
   * 7. Display success toast with clickable webViewLink to the date folder
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

      // Step 2: Synchronize with currently active on-screen filtered records
      const filteredRecords = typeof Dashboard !== "undefined" ? Dashboard.filteredMaterials : null;
      const materials = filteredRecords || (typeof Dashboard !== "undefined" ? Dashboard.cachedMaterials : []);

      // Collect receipt photos belonging to currently active filtered records
      const { photoList, photosByRecordId } = ExportService.collectReceiptPhotos(materials);

      // Step 3: Locate or Create Singleton Root Folder ("Nawaz Constructions Backups")
      this.setLoadingState(true, "Creating Drive folders...");
      UI.showToast("Setting up backup folder structure in Google Drive...", "info", "Google Drive");

      const rootFolder = await this.findOrCreateFolder(token, "Nawaz Constructions Backups");

      // Step 4: Create timestamped Date-Wise Backup Folder
      const now = new Date();
      const dateStr = now.toISOString().split("T")[0];
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const dateFolderName = `Backup_${dateStr}_${hours}-${minutes}`;

      const dateFolder = await this.createFolder(token, dateFolderName, rootFolder.id);

      // Step 5: Create distinct "Excel" and "Photos" subfolders inside Date Folder
      const excelFolder = await this.createFolder(token, "Excel", dateFolder.id);
      const photosFolder = await this.createFolder(token, "Photos", dateFolder.id);

      // Step 6: Generate and Upload Material_Records.xlsx into "Excel" folder
      this.setLoadingState(true, "Generating Excel report...");
      const { blob: excelBlob, materialsCount } = await ExportService.generateExcelBlob(materials, {
        includeReceipts: photoList.length > 0,
        photosByRecordId
      });

      this.setLoadingState(true, "Uploading Excel to Drive...");
      await this.uploadFileToFolder(
        token,
        excelBlob,
        "Material_Records.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        excelFolder.id
      );

      // Step 7: Upload all attached receipt photos into "Photos" folder with live progress
      let uploadedPhotosCount = 0;
      if (photoList.length > 0) {
        for (let i = 0; i < photoList.length; i++) {
          const photo = photoList[i];
          this.setLoadingState(true, `Uploading photos (${i + 1}/${photoList.length})...`);
          UI.showToast(`Uploading photo ${i + 1} of ${photoList.length} to Drive...`, "info", "Uploading Photos", 1200);

          const photoBlob = await ExportService.fetchImageBlob(photo.url);
          if (photoBlob) {
            await this.uploadFileToFolder(
              token,
              photoBlob,
              photo.filename,
              "image/jpeg",
              photosFolder.id
            );
            uploadedPhotosCount++;
          }
        }
      }

      // Step 8: User Feedback with Direct Google Drive Folder Link
      const folderViewUrl = dateFolder.webViewLink || `https://drive.google.com/drive/folders/${dateFolder.id}`;
      const toastMessage = `
        <span>Backup saved to Google Drive! (${materialsCount} records, ${uploadedPhotosCount} photos)</span>
        <div style="margin-top: 6px;">
          <a href="${folderViewUrl}" target="_blank" rel="noopener noreferrer" style="color: #60A5FA; text-decoration: underline; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            Open Backup Folder in Google Drive &rarr;
          </a>
        </div>
      `;

      UI.showToast(toastMessage, "success", "Saved to Google Drive", 12000);

    } catch (err) {
      console.error("Google Drive Backup Error:", err);
      const isUserClosed = err.message?.includes("popup_closed") || err.message?.includes("access_denied");
      if (isUserClosed) {
        UI.showToast("Google authorization request was cancelled.", "info", "Authorization Cancelled");
      } else if (err.name === "TypeError" && err.message?.includes("Failed to fetch")) {
        UI.showToast(
          "Network request to Google Drive was blocked. Please ensure 'https://nawazconstructions.vercel.app' is added to Authorized JavaScript origins and Google Drive API is enabled in your Google Cloud Console.",
          "error",
          "Google Drive Connection Error",
          10000
        );
      } else {
        UI.showToast(
          err.message || "Failed to upload backup to Google Drive. Please check your credentials.",
          "error",
          "Google Drive Error",
          9000
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
