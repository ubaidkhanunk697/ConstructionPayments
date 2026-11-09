/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Application Configuration & Constants
 */

// Allow environment overrides if window.ENV exists (loaded via js/env.js)
const env = (typeof window !== "undefined" && window.ENV) || {};

// Clean and normalize Supabase URL (strip trailing /rest/v1 or trailing slashes/dots if user pasted REST URL)
const rawUrl = (env.SUPABASE_URL || "https://ofckjnslflkqtdgiikwr.supabase.co").trim();
const normalizedUrl = rawUrl.replace(/\/rest\/v1\/?\.?$/i, "").replace(/[\/\.]+$/, "");

const CONFIG = {
  APP_NAME: "Construction Material & Payment Management System",
  PROJECT_NAME: "House Construction Project",
  CURRENCY: {
    CODE: "PKR",
    SYMBOL: "Rs.",
    LOCALE: "en-PK"
  },
  QUANTITY_UNITS: [
    { value: "Bags", label: "Bags" },
    { value: "Tons", label: "Tons" },
    { value: "Senkrra", label: "Senkrra" },
    { value: "Bricks", label: "Bricks" },
    { value: "Sariya", label: "Sariya" },
    { value: "Other", label: "Other (Specify Custom Unit)" }
  ],
  MATERIAL_TYPES: [
    "Cement",
    "Steel / Sariya",
    "Sand / Rait",
    "Bricks / Eint",
    "Gravel / Bajri",
    "Tiles & Marble",
    "Sanitary & Plumbing",
    "Electrical Conduit & Wiring",
    "Wood & Carpentry",
    "Paint & Finish",
    "Labor & Masonry",
    "Other Material"
  ],
  
  // Supabase Configuration (Strictly Publishable / Anon Key only)
  SUPABASE: {
    URL: normalizedUrl,
    ANON_KEY: (env.SUPABASE_ANON_KEY || "sb_publishable_IvG5xZ7cG7AtZPTbmQhk8A_dmzP85h4").trim()
  },

  // Authentication & Dynamic Authorization (Zero Hardcoded Identities)
  AUTH: {
    ALLOWED_OWNER_EMAIL: (env.ALLOWED_OWNER_EMAIL || "").trim().toLowerCase(),
    ALLOWED_OWNER_UUID: (env.ALLOWED_OWNER_UUID || "").trim()
  },

  // Google Drive REST API & Google Identity Services (GIS)
  GOOGLE_DRIVE: {
    CLIENT_ID: (env.GOOGLE_CLIENT_ID || "767207458104-srq6jskuq2fi6e6abo80jsb7tjne2590.apps.googleusercontent.com").trim(),
    SCOPE: "https://www.googleapis.com/auth/drive.file"
  },

  /**
   * Check if Google Drive Client ID has been configured
   */
  isGoogleDriveConfigured() {
    return Boolean(
      this.GOOGLE_DRIVE?.CLIENT_ID &&
      !this.GOOGLE_DRIVE.CLIENT_ID.includes("YOUR_")
    );
  },

  /**
   * Check if Supabase credentials have been configured
   */
  isConfigured() {
    return Boolean(
      this.SUPABASE.URL &&
      this.SUPABASE.URL.startsWith("https://") &&
      !this.SUPABASE.URL.includes("YOUR_PROJECT") &&
      this.SUPABASE.ANON_KEY &&
      !this.SUPABASE.ANON_KEY.includes("YOUR_KEY")
    );
  },

  /**
   * Helper to dynamically populate any Unit select dropdown from CONFIG.QUANTITY_UNITS
   */
  populateUnitDropdown(selectElement, selectedValue = "Bags") {
    if (!selectElement) return;
    selectElement.innerHTML = this.QUANTITY_UNITS.map(
      (u) => `<option value="${u.value}" ${u.value === selectedValue ? "selected" : ""}>${u.label}</option>`
    ).join("");
  },

  /**
   * Helper to dynamically populate any Material Type select dropdown
   */
  populateMaterialTypeDropdown(selectElement, selectedValue = "Cement", includeAllOption = false) {
    if (!selectElement) return;
    let html = includeAllOption ? `<option value="">All Material Types</option>` : "";
    html += this.MATERIAL_TYPES.map(
      (m) => `<option value="${m}" ${m === selectedValue ? "selected" : ""}>${m}</option>`
    ).join("");
    selectElement.innerHTML = html;
  }
};

// Freeze configuration sub-objects to prevent accidental runtime modifications
Object.freeze(CONFIG.CURRENCY);

// Explicitly bind to window for global access
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
}

