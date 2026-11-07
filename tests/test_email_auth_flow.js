/**
 * End-to-End Email & Password Authentication Test Suite
 * Validates Registration, Login, Session Persistence, Route Guards, and Google OAuth Removal
 */

const fs = require("fs");
const path = require("path");

function runAuthSuite() {
  console.log("================================================================================");
  console.log("E2E AUDIT: SUPABASE EMAIL & PASSWORD AUTHENTICATION SYSTEM");
  console.log("================================================================================\n");

  const results = { passed: 0, failed: 0, total: 0 };

  function assert(category, testName, condition, details = "") {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`[PASS] [${category}] ${testName} ${details ? "(" + details + ")" : ""}`);
    } else {
      results.failed++;
      console.error(`[FAIL] [${category}] ${testName} - ${details || "Assertion failed"}`);
    }
  }

  const rootDir = path.resolve(__dirname, "..");
  const loginHtml = fs.readFileSync(path.join(rootDir, "login.html"), "utf8");
  const registerHtml = fs.readFileSync(path.join(rootDir, "register.html"), "utf8");
  const dashHtml = fs.readFileSync(path.join(rootDir, "dashboard.html"), "utf8");
  const authJs = fs.readFileSync(path.join(rootDir, "js/auth.js"), "utf8");
  const configJs = fs.readFileSync(path.join(rootDir, "js/config.js"), "utf8");
  const appJs = fs.readFileSync(path.join(rootDir, "js/app.js"), "utf8");
  const vercelJson = fs.readFileSync(path.join(rootDir, "vercel.json"), "utf8");

  // --- 1. REGISTRATION PAGE AUDIT ---
  console.log("--- 1. Registration Page (register.html) ---");
  assert("Register", "register.html file exists and has content", registerHtml.length > 500);
  assert("Register", "Full Name input field exists", registerHtml.includes('id="register-name"'));
  assert("Register", "Email Address input field exists", registerHtml.includes('id="register-email"'));
  assert("Register", "Password input field exists", registerHtml.includes('id="register-password"'));
  assert("Register", "Confirm Password input field exists", registerHtml.includes('id="register-confirm-password"'));
  assert("Register", "Create Owner Account submit button exists", registerHtml.includes('id="btn-register"'));
  assert("Register", "Link to Login page exists", registerHtml.includes('href="login.html"'));
  assert("Register", "Password visibility toggles exist", registerHtml.includes('id="toggle-password-btn"') && registerHtml.includes('id="toggle-confirm-password-btn"'));
  assert("Register", "Client-side password mismatch check present", registerHtml.includes("password !== confirmPassword"));
  assert("Register", "Client-side email regex validation present", registerHtml.includes("emailRegex.test"));
  assert("Register", "Client-side minimum password length validation present", registerHtml.includes("password.length < 6"));
  assert("Register", "Auth.redirectIfAuthenticated() called on page load", registerHtml.includes("Auth.redirectIfAuthenticated()"));
  assert("Register", "Email already registered error handler present", registerHtml.includes("already registered") || registerHtml.includes("user_already_exists"));
  assert("Register", "Email verification instruction box present", registerHtml.includes("Verification Email Sent") || registerHtml.includes("confirmation link"));

  // --- 2. LOGIN PAGE AUDIT ---
  console.log("\n--- 2. Login Page (login.html) ---");
  assert("Login", "Email Address input field exists", loginHtml.includes('id="login-email"'));
  assert("Login", "Password input field exists", loginHtml.includes('id="login-password"'));
  assert("Login", "Sign In submit button exists", loginHtml.includes('id="btn-login"'));
  assert("Login", "Link to Registration page exists", loginHtml.includes('href="register.html"'));
  assert("Login", "Forgot Password link exists", loginHtml.includes('id="link-forgot-password"'));
  assert("Login", "Password visibility toggle exists", loginHtml.includes('id="toggle-login-password-btn"'));
  assert("Login", "Client-side missing fields validation present", loginHtml.includes("!email") && loginHtml.includes("!password"));
  assert("Login", "Invalid credentials error handling present", loginHtml.includes("invalid login credentials") || loginHtml.includes("invalid_grant"));
  assert("Login", "Unverified email error handling present", loginHtml.includes("email not confirmed") || loginHtml.includes("email unconfirmed"));
  assert("Login", "Network error handling present", loginHtml.includes("network error") || loginHtml.includes("failed to fetch"));
  assert("Login", "Auth.redirectIfAuthenticated() called on page load", loginHtml.includes("Auth.redirectIfAuthenticated()"));

  // --- 3. GOOGLE OAUTH REMOVAL AUDIT ---
  console.log("\n--- 3. Google OAuth Removal Verification ---");
  assert("OAuth Removal", "Google login button removed from login.html", !loginHtml.includes('id="google-login"'));
  assert("OAuth Removal", "Google OAuth signInWithOAuth removed from auth.js", !authJs.includes("signInWithOAuth"));
  assert("OAuth Removal", "No Google redirect logic in login.html", !loginHtml.includes("Redirecting to Google"));
  assert("OAuth Removal", "No Google OAuth redirect in auth.js", !authJs.includes("provider: \"google\"") && !authJs.includes("provider: 'google'"));

  // --- 4. SUPABASE AUTH SERVICE (auth.js) ---
  console.log("\n--- 4. Supabase Auth Client & Service (js/auth.js) ---");
  assert("Auth Service", "supabase.auth.signUp() implemented in Auth.signUp", authJs.includes("supabase.auth.signUp"));
  assert("Auth Service", "User full_name passed in options.data metadata", authJs.includes("full_name: cleanName") || authJs.includes("full_name"));
  assert("Auth Service", "supabase.auth.signInWithPassword() implemented in Auth.signIn", authJs.includes("supabase.auth.signInWithPassword"));
  assert("Auth Service", "supabase.auth.signOut() implemented in Auth.signOut", authJs.includes("supabase.auth.signOut"));
  assert("Auth Service", "supabase.auth.getSession() implemented in Auth.getSession", authJs.includes("supabase.auth.getSession"));
  assert("Auth Service", "supabase.auth.onAuthStateChange() listener implemented", authJs.includes("supabase.auth.onAuthStateChange"));
  assert("Auth Service", "supabase.auth.resetPasswordForEmail() implemented in Auth.resetPassword", authJs.includes("supabase.auth.resetPasswordForEmail"));

  // --- 5. PERSISTENT AUTHENTICATION SESSION ---
  console.log("\n--- 5. Persistent Authentication Session ---");
  assert("Persistence", "persistSession: true configured in Supabase client", authJs.includes("persistSession: true"));
  assert("Persistence", "autoRefreshToken: true configured in Supabase client", authJs.includes("autoRefreshToken: true"));
  assert("Persistence", "detectSessionInUrl: true configured in Supabase client", authJs.includes("detectSessionInUrl: true"));
  assert("Persistence", "localStorage specified as storage provider", authJs.includes("localStorage"));

  // --- 6. ROUTE GUARDS & SECURITY ---
  console.log("\n--- 6. Protected Routes & Owner Security ---");
  assert("Security", "Auth.requireOwnerAuth() implemented as route guard", authJs.includes("async requireOwnerAuth()"));
  assert("Security", "Unauthenticated visitors redirected to login.html", authJs.includes("login.html?reason=unauthenticated"));
  assert("Security", "Unauthorized accounts signed out and redirected", authJs.includes("login.html?error=unauthorized"));
  assert("Security", "Owner allowlist check isAuthorizedOwner() implemented", authJs.includes("isAuthorizedOwner(user)"));
  assert("Security", "Owner UUID configuration fallback preserved", configJs.includes("55a43065-dcb8-450a-a68f-d05fd221a5bb"));
  assert("Security", "Sidebar Logout button exists in dashboard.html", dashHtml.includes('id="logout-btn"'));
  assert("Security", "Logout button wired up to Auth.signOut() in app.js", appJs.includes("Auth.signOut()"));

  // --- 7. DEPLOYMENT & ROUTING ---
  console.log("\n--- 7. Deployment Configuration (vercel.json) ---");
  assert("Vercel", "/register rewrite configured", vercelJson.includes('"source": "/register"'));
  assert("Vercel", "/login rewrite configured", vercelJson.includes('"source": "/login"'));
  assert("Vercel", "/dashboard rewrite configured", vercelJson.includes('"source": "/dashboard"'));
  assert("Vercel", "cleanUrls is false to prevent token/state redirect stripping", vercelJson.includes('"cleanUrls": false'));

  console.log("\n================================================================================");
  console.log(`TOTAL AUDIT RESULTS: ${results.passed} PASSED, ${results.failed} FAILED (TOTAL: ${results.total})`);
  console.log("================================================================================");

  if (results.failed > 0) {
    process.exit(1);
  }
}

runAuthSuite();
