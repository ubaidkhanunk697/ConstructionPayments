/**
 * Production Readiness & Button Audit Script
 * Validates DOM elements, button bindings, authentication, and configurations for Vercel deployment
 */

const fs = require("fs");
const path = require("path");

function auditProduction() {
  console.log("================================================================================");
  console.log("PRODUCTION DEPLOYMENT & BUTTON AUDIT FOR: https://nawazconstructions.vercel.app/");
  console.log("================================================================================\n");

  const dashHtml = fs.readFileSync(path.join(__dirname, "../dashboard.html"), "utf8");
  const loginHtml = fs.readFileSync(path.join(__dirname, "../login.html"), "utf8");
  const indexHtml = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const appJs = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const dashJs = fs.readFileSync(path.join(__dirname, "../js/dashboard.js"), "utf8");
  const authJs = fs.readFileSync(path.join(__dirname, "../js/auth.js"), "utf8");
  const configJs = fs.readFileSync(path.join(__dirname, "../js/config.js"), "utf8");

  const registerHtml = fs.existsSync(path.join(__dirname, "../register.html")) ? fs.readFileSync(path.join(__dirname, "../register.html"), "utf8") : "";

  const checks = [];

  function check(category, name, condition, details = "") {
    checks.push({ category, name, passed: Boolean(condition), details });
    const status = condition ? "[PASS]" : "[FAIL]";
    console.log(`${status} [${category}] ${name} ${details ? "- " + details : ""}`);
  }

  // 1. Authentication & Route Guards
  console.log("--- 1. Authentication & Security ---");
  check("Auth", "Email Address input exists in login.html", loginHtml.includes('id="login-email"'));
  check("Auth", "Password input exists in login.html", loginHtml.includes('id="login-password"'));
  check("Auth", "Sign In submit button exists in login.html", loginHtml.includes('id="btn-login"'));
  check("Auth", "Link to Register page exists in login.html", loginHtml.includes('href="register.html"'));
  check("Auth", "Register page with Full Name and Email inputs exists", (registerHtml.includes('id="reg-name"') || registerHtml.includes('id="register-name"')) && (registerHtml.includes('id="reg-email"') || registerHtml.includes('id="register-email"')));
  check("Auth", "Dynamic owner auth enabled without hardcoded emails", !configJs.includes("ubaidkhanuk6973937@gmail.com") && !authJs.includes("ubaidkhanuk6973937@gmail.com"));
  check("Auth", "Persistent session enabled in Supabase client", authJs.includes("persistSession: true") && authJs.includes("autoRefreshToken: true"));
  check("Auth", "Logout button exists in sidebar / mobile drawer", dashHtml.includes('id="logout-btn"'));
  check("Auth", "Auth route guard initial check in app.js", appJs.includes("Auth.requireOwnerAuth()"));

  // 2. Action Buttons in Topbar & Sidebar
  console.log("\n--- 2. Header & Navigation Buttons ---");
  check("Buttons", "Topbar Add Material button", dashHtml.includes('id="btn-add-material-header"'));
  check("Buttons", "Empty State Add Material button", dashHtml.includes('id="btn-add-material-empty"'));
  check("Buttons", "Topbar Excel Export button", dashHtml.includes('id="btn-export-excel"'));
  check("Buttons", "Table Toolbar Excel Export button", dashHtml.includes('id="btn-export-excel-toolbar"'));
  check("Buttons", "Sidebar Excel Export link", dashHtml.includes('id="nav-export-link"'));
  check("Buttons", "Mobile menu drawer toggle button", dashHtml.includes('id="btn-mobile-menu-toggle"') || dashHtml.includes('btn-mobile-menu') || dashHtml.includes('data-lucide="menu"'));
  check("Buttons", "Sidebar Mobile Close button", dashHtml.includes('btn-close-sidebar') || dashHtml.includes('data-lucide="x"'));

  // 3. Search & Filter Controls
  console.log("\n--- 3. Search & Filter Controls ---");
  check("Filters", "Live search input element", dashHtml.includes('id="filter-search-input"'));
  check("Filters", "Material type dropdown filter", dashHtml.includes('id="filter-material-type"'));
  check("Filters", "Payment status dropdown filter", dashHtml.includes('id="statusFilter"'));
  check("Filters", "Sorting dropdown filter", dashHtml.includes('id="filter-sort"'));
  check("Filters", "Reset all filters button", dashHtml.includes('id="btn-reset-filters"'));

  // 4. Modals & Forms
  console.log("\n--- 4. Modals, Forms & CRUD Actions ---");
  check("Modals", "Material Record Form Modal", dashHtml.includes('id="modal-material-form"'));
  check("Modals", "Material Form submit button", dashHtml.includes('id="btn-submit-material-form"'));
  check("Modals", "Material Form cancel / close attribute", dashHtml.includes('data-close-modal="modal-material-form"'));
  check("Modals", "Material Form delete button inside footer", dashHtml.includes('id="btn-delete-material-record"'));

  check("Modals", "Edit Confirmation Modal", dashHtml.includes('id="modal-confirm-edit"'));
  check("Modals", "Edit Confirm Save button", dashHtml.includes('id="btn-confirm-save-edit"'));
  check("Modals", "Edit Cancel / close attribute", dashHtml.includes('data-close-modal="modal-confirm-edit"'));

  check("Modals", "Payment Form Modal", dashHtml.includes('id="modal-payment-form"'));
  check("Modals", "Payment Form submit button", dashHtml.includes('id="btn-submit-payment-form"'));
  check("Modals", "Payment Form cancel / close attribute", dashHtml.includes('data-close-modal="modal-payment-form"'));

  check("Modals", "Payment History Modal", dashHtml.includes('id="modal-payment-history"'));
  check("Modals", "Payment History close attribute", dashHtml.includes('data-close-modal="modal-payment-history"'));

  check("Modals", "Delete Material Confirmation Modal", dashHtml.includes('id="modal-confirm-delete"'));
  check("Modals", "Delete Confirm button", dashHtml.includes('id="btn-confirm-delete"'));
  check("Modals", "Delete Cancel / close attribute", dashHtml.includes('data-close-modal="modal-confirm-delete"'));

  check("Modals", "Receipt file input with camera capture", dashHtml.includes('id="receiptFileInput"') && dashHtml.includes('capture="environment"'));
  check("Modals", "Receipt image preview thumbnail", dashHtml.includes('id="receipt-preview-img"'));
  check("Modals", "Receipt remove button", dashHtml.includes('id="btn-remove-receipt"'));
  check("Modals", "Receipt view verification modal", dashHtml.includes('id="modal-receipt-view"'));

  // 5. Assets & Branding
  console.log("\n--- 5. Assets & Branding ---");
  check("Assets", "Favicon vector SVG file exists", fs.existsSync(path.join(__dirname, "../assets/favicon.svg")));
  check("Assets", "Favicon linked in dashboard.html", dashHtml.includes('assets/favicon.svg'));
  check("Assets", "Favicon linked in login.html", loginHtml.includes('assets/favicon.svg'));
  check("Assets", "Favicon linked in index.html", indexHtml.includes('assets/favicon.svg'));

  const total = checks.length;
  const passed = checks.filter(c => c.passed).length;
  const failed = total - passed;

  console.log("\n================================================================================");
  console.log(`PRODUCTION AUDIT RESULT: ${passed} PASSED, ${failed} FAILED (TOTAL: ${total})`);
  console.log("================================================================================");
}

auditProduction();
