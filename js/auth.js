/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Centralized Supabase Authentication Service & Route Guards
 * (Supabase Email & Password Authentication - v2 API)
 */

const Auth = {
  client: null,
  currentUser: null,
  currentSession: null,

  /**
   * Initialize Supabase Client with persistent session and auto-refresh
   */
  init() {
    if (this.client && this.client.auth) {
      return this.client;
    }

    // 1. Check globally exported client instance
    if (typeof window !== "undefined" && window.supabaseClient && window.supabaseClient.auth) {
      this.client = window.supabaseClient;
      return this.client;
    }

    // 2. Check getSupabaseClient helper
    if (typeof window !== "undefined" && typeof window.getSupabaseClient === "function") {
      const existing = window.getSupabaseClient();
      if (existing && existing.auth) {
        this.client = existing;
        return this.client;
      }
    }

    // 3. Fallback to window.supabase.createClient if SDK is available
    if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
      const url = (window.ENV?.SUPABASE_URL || (typeof CONFIG !== "undefined" && CONFIG.SUPABASE?.URL) || "https://ofckjnslflkqtdgiikwr.supabase.co").trim();
      const cleanUrl = url.replace(/\/rest\/v1\/?\.?$/i, "").replace(/[\/\.]+$/, "");
      const anonKey = (window.ENV?.SUPABASE_ANON_KEY || (typeof CONFIG !== "undefined" && CONFIG.SUPABASE?.ANON_KEY) || "sb_publishable_IvG5xZ7cG7AtZPTbmQhk8A_dmzP85h4").trim();

      try {
        this.client = window.supabase.createClient(cleanUrl, anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: typeof window !== "undefined" && window.localStorage ? window.localStorage : undefined
          }
        });
        window.supabaseClient = this.client;
        return this.client;
      } catch (err) {
        console.error("Failed to initialize Supabase client:", err);
        return null;
      }
    }

    return null;
  },

  /**
   * Determine if a user matches the authorized owner allowlist
   */
  isAuthorizedOwner(user) {
    if (!user) return false;

    const userEmail = (user.email || "").trim().toLowerCase();
    const ownerEmail = (typeof CONFIG !== "undefined" && CONFIG.AUTH?.ALLOWED_OWNER_EMAIL || "").trim().toLowerCase();
    const ownerUUID = (typeof CONFIG !== "undefined" && CONFIG.AUTH?.ALLOWED_OWNER_UUID || "").trim();

    // Known approved owner email identities
    const approvedEmails = [
      ownerEmail,
      "ubaidkhanuk6973937@gmail.com",
      "ubaidkhanunk697@gmail.com"
    ].filter(Boolean);

    // If an owner allowlist is explicitly defined, enforce it strictly.
    if (approvedEmails.length > 0 || ownerUUID) {
      const emailMatches = approvedEmails.includes(userEmail);
      const uuidMatches = Boolean(ownerUUID && user.id === ownerUUID);
      return emailMatches || uuidMatches;
    }

    // Default: If no owner allowlist is set yet, permit the authenticated project user
    return true;
  },

  /**
   * Register a new user with Email and Password using Supabase v2 API
   */
  async signUp({ fullName, email, password }) {
    const supabase = this.init();
    if (!supabase || !supabase.auth) {
      throw new Error("Supabase client is not available. Please verify your connection.");
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanName = (fullName || "").trim();

    // Supabase JS v2 Registration API
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          full_name: cleanName
        }
      }
    });

    if (error) {
      throw error;
    }

    // Check if user already exists (Supabase identity obfuscation check)
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      const err = new Error("This email is already registered. Please log in instead.");
      err.code = "user_already_exists";
      throw err;
    }

    // If session returned immediately (Email confirmations disabled)
    if (data.session && data.user) {
      this.currentUser = data.user;
      this.currentSession = data.session;
    }

    return data;
  },

  /**
   * Authenticate using Email and Password (Supabase v2 standard method)
   */
  async signInWithPassword({ email, password }) {
    const supabase = this.init();
    if (!supabase || !supabase.auth) {
      throw new Error("Supabase client is not available. Please verify your connection.");
    }

    const cleanEmail = (email || "").trim().toLowerCase();

    // Supabase JS v2 Login API
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("Login failed. No user record returned.");
    }

    this.currentUser = data.user;
    this.currentSession = data.session;

    return data;
  },

  /**
   * Alias for backward compatibility
   */
  async signIn({ email, password }) {
    return this.signInWithPassword({ email, password });
  },

  /**
   * Request password reset email
   */
  async resetPassword(email) {
    const supabase = this.init();
    if (!supabase || !supabase.auth) {
      throw new Error("Supabase client is not available. Please verify your connection.");
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    const redirectTo = `${window.location.origin}/login.html`;

    const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo
    });

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Terminate user session and redirect to login
   */
  async signOut() {
    const supabase = this.init();
    if (supabase && supabase.auth) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Error during Supabase signOut:", err);
      }
    }

    this.currentUser = null;
    this.currentSession = null;

    // Clear any local storage auth tokens
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const keys = Object.keys(window.localStorage);
        keys.forEach((key) => {
          if (key.includes("supabase.auth.token") || key.includes("sb-") && key.includes("-auth-token")) {
            window.localStorage.removeItem(key);
          }
        });
      }
    } catch (e) {}

    // Redirect to login page with notice
    const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
    window.location.href = `${currentDir}login.html?notice=logged_out`;
  },

  /**
   * Retrieve active session from Supabase client
   */
  async getSession() {
    const supabase = this.init();
    if (!supabase || !supabase.auth) return null;

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (err) {
      console.error("Error retrieving Supabase session:", err);
      return null;
    }
  },

  /**
   * Route Guard for Protected Pages (e.g. dashboard.html)
   */
  async requireOwnerAuth() {
    const supabase = this.init();
    if (!supabase || !supabase.auth) {
      return { status: "unconfigured" };
    }

    const session = await this.getSession();

    if (!session || !session.user) {
      const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
      window.location.replace(`${currentDir}login.html?reason=unauthenticated`);
      return { status: "unauthenticated" };
    }

    const user = session.user;
    if (!this.isAuthorizedOwner(user)) {
      console.warn("Unauthorized account detected:", user.email);
      await supabase.auth.signOut();
      const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
      const attempted = encodeURIComponent(user.email || "unknown");
      window.location.replace(`${currentDir}login.html?error=unauthorized&attempted=${attempted}`);
      return { status: "unauthorized", user };
    }

    this.currentUser = user;
    this.currentSession = session;

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === "SIGNED_OUT" || !currentSession) {
        this.currentUser = null;
        this.currentSession = null;
        const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
        window.location.replace(`${currentDir}login.html?reason=session_expired`);
      } else if (currentSession && !this.isAuthorizedOwner(currentSession.user)) {
        await supabase.auth.signOut();
        const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
        window.location.replace(`${currentDir}login.html?error=unauthorized`);
      } else if (currentSession) {
        this.currentSession = currentSession;
        this.currentUser = currentSession.user;
      }
    });

    return { status: "authorized", user, session };
  },

  /**
   * Guard for Public Pages (login.html, register.html, index.html)
   */
  async redirectIfAuthenticated() {
    const supabase = this.init();
    if (!supabase || !supabase.auth) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      return;
    }

    const session = await this.getSession();
    if (session && session.user) {
      if (this.isAuthorizedOwner(session.user)) {
        window.location.replace("./dashboard.html");
      } else {
        await supabase.auth.signOut();
      }
    }
  }
};

/**
 * ============================================================================
 * UNIFIED DOM EVENT LISTENERS & FORM HANDLERS
 * Automatically synchronizes #register-form and #login-form
 * ============================================================================
 */
function setupAuthForms() {
  if (typeof document === "undefined") return;

  // Initialize client early
  Auth.init();

  const alertContainer = document.getElementById("auth-alert-container");

  function showAlert(type, title, message) {
    if (!alertContainer) return;
    const iconName = type === "danger" ? "alert-circle" : (type === "warning" ? "alert-triangle" : (type === "success" ? "check-circle-2" : "info"));
    alertContainer.innerHTML = `
      <div class="auth-alert auth-alert-${type}">
        <i data-lucide="${iconName}" class="auth-alert-icon" style="width: 16px; height: 16px;"></i>
        <div>
          <strong style="display: block; margin-bottom: 2px;">${title}</strong>
          <span>${message}</span>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  function clearAlert() {
    if (alertContainer) alertContainer.innerHTML = "";
  }

  // --------------------------------------------------------------------------
  // 1. REGISTRATION FORM HANDLER
  // Target: #register-form, inputs: #reg-name, #reg-email, #reg-password
  // --------------------------------------------------------------------------
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    // Check if already authenticated
    Auth.redirectIfAuthenticated();

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      const nameEl = document.getElementById("reg-name") || document.getElementById("register-name") || registerForm.querySelector('input[name="name"]');
      const emailEl = document.getElementById("reg-email") || document.getElementById("register-email") || registerForm.querySelector('input[type="email"]');
      const passwordEl = document.getElementById("reg-password") || document.getElementById("register-password") || registerForm.querySelector('input[type="password"]');
      const confirmPasswordEl = document.getElementById("reg-confirm-password") || document.getElementById("register-confirm-password");

      const fullName = (nameEl ? nameEl.value : "").trim();
      const email = (emailEl ? emailEl.value : "").trim().toLowerCase();
      const password = passwordEl ? passwordEl.value : "";
      const confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : "";

      const registerBtn = document.getElementById("btn-register") || registerForm.querySelector('button[type="submit"]');
      const btnText = document.getElementById("btn-register-text");
      const btnSpinner = document.getElementById("btn-register-spinner");

      // Validations
      if (!fullName) {
        showAlert("danger", "Name Required", "Please enter your full name.");
        if (nameEl) nameEl.focus();
        return;
      }

      if (!email) {
        showAlert("danger", "Email Required", "Please enter your email address.");
        if (emailEl) emailEl.focus();
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showAlert("danger", "Invalid Email", "Please enter a valid email address (e.g. owner@example.com).");
        if (emailEl) emailEl.focus();
        return;
      }

      if (!password || password.length < 6) {
        showAlert("danger", "Password Too Short", "Password must be at least 6 characters long.");
        if (passwordEl) passwordEl.focus();
        return;
      }

      if (confirmPasswordEl && password !== confirmPassword) {
        showAlert("danger", "Password Mismatch", "Password and Confirm Password do not match. Please re-enter.");
        confirmPasswordEl.focus();
        return;
      }

      try {
        if (registerBtn) registerBtn.disabled = true;
        if (btnText) btnText.textContent = "Creating Account...";
        if (btnSpinner) btnSpinner.style.display = "block";

        const supabase = Auth.init();
        if (!supabase || !supabase.auth) {
          throw new Error("Supabase client is not available.");
        }

        // Strict Supabase v2 registration call
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName
            }
          }
        });

        if (error) {
          throw error;
        }

        // Check if user already exists
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          throw new Error("This email is already registered. Please log in instead.");
        }

        // Active session acquired (Confirm email is OFF in Supabase)
        if (data && data.session) {
          Auth.currentUser = data.user;
          Auth.currentSession = data.session;

          showAlert(
            "success",
            "Account Created Successfully!",
            "Your owner account has been registered. Redirecting to dashboard..."
          );

          setTimeout(() => {
            window.location.replace("./dashboard.html");
          }, 500);
          return;
        }

        // Email confirmation notice if Confirm Email was enabled
        showAlert(
          "success",
          "Verification Email Sent",
          `Account registered successfully! A confirmation link has been sent to <strong>${email}</strong>. Please check your inbox and verify your email, then <a href="login.html" style="font-weight: 600; text-decoration: underline;">log in here</a>.`
        );
        registerForm.reset();
        if (registerBtn) registerBtn.disabled = false;
        if (btnText) btnText.textContent = "Create Owner Account";
        if (btnSpinner) btnSpinner.style.display = "none";

      } catch (err) {
        console.error("Registration error:", err);
        if (registerBtn) registerBtn.disabled = false;
        if (btnText) btnText.textContent = "Create Owner Account";
        if (btnSpinner) btnSpinner.style.display = "none";

        const errorMsg = err?.message || "An unexpected error occurred during registration.";
        const lowerMsg = errorMsg.toLowerCase();

        if (lowerMsg.includes("already registered") || lowerMsg.includes("already exists") || err.code === "user_already_exists") {
          showAlert(
            "warning",
            "Email Already Registered",
            `The email <strong>${email}</strong> is already registered. Please <a href="login.html" style="font-weight: 600; text-decoration: underline;">click here to log in</a> with your password.`
          );
        } else {
          showAlert("danger", "Registration Failed", errorMsg);
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 2. LOGIN FORM HANDLER
  // Target: #login-form, inputs: #login-email, #login-password
  // --------------------------------------------------------------------------
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    // Check if already authenticated
    Auth.redirectIfAuthenticated();

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      const emailEl = document.getElementById("login-email") || loginForm.querySelector('input[type="email"]');
      const passwordEl = document.getElementById("login-password") || loginForm.querySelector('input[type="password"]');

      const email = (emailEl ? emailEl.value : "").trim().toLowerCase();
      const password = passwordEl ? passwordEl.value : "";

      const loginBtn = document.getElementById("btn-login") || loginForm.querySelector('button[type="submit"]');
      const btnText = document.getElementById("btn-login-text");
      const btnSpinner = document.getElementById("btn-login-spinner");

      if (!email) {
        showAlert("danger", "Email Required", "Please enter your registered email address.");
        if (emailEl) emailEl.focus();
        return;
      }

      if (!password) {
        showAlert("danger", "Password Required", "Please enter your password.");
        if (passwordEl) passwordEl.focus();
        return;
      }

      try {
        if (loginBtn) loginBtn.disabled = true;
        if (btnText) btnText.textContent = "Authenticating...";
        if (btnSpinner) btnSpinner.style.display = "block";

        const supabase = Auth.init();
        if (!supabase || !supabase.auth) {
          throw new Error("Supabase client is not available.");
        }

        // Strict Supabase v2 signInWithPassword call
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          throw error;
        }

        if (data && data.session) {
          Auth.currentUser = data.user;
          Auth.currentSession = data.session;

          showAlert("success", "Login Successful", "Welcome back! Loading your project dashboard...");

          setTimeout(() => {
            window.location.replace("./dashboard.html");
          }, 400);
        } else {
          showAlert("warning", "Email Verification Required", `Please verify your email address at <strong>${email}</strong> before logging in.`);
          if (loginBtn) loginBtn.disabled = false;
          if (btnText) btnText.textContent = "Sign In to Dashboard";
          if (btnSpinner) btnSpinner.style.display = "none";
        }

      } catch (err) {
        console.error("Login error:", err);
        if (loginBtn) loginBtn.disabled = false;
        if (btnText) btnText.textContent = "Sign In to Dashboard";
        if (btnSpinner) btnSpinner.style.display = "none";

        const errorMsg = err?.message || "An unexpected error occurred during login.";
        const lowerMsg = errorMsg.toLowerCase();

        if (lowerMsg.includes("invalid login credentials") || lowerMsg.includes("invalid_grant") || lowerMsg.includes("invalid username or password")) {
          showAlert(
            "danger",
            "Incorrect Email or Password",
            "The email address or password you entered is incorrect. Please verify your credentials and try again."
          );
          if (passwordEl) passwordEl.focus();
        } else if (lowerMsg.includes("email not confirmed") || lowerMsg.includes("email unconfirmed")) {
          showAlert(
            "warning",
            "Email Not Verified",
            `Your email address has not been confirmed yet. Please check your inbox at <strong>${email}</strong> for the verification email.`
          );
        } else if (lowerMsg.includes("network error") || lowerMsg.includes("failed to fetch")) {
          showAlert(
            "danger",
            "Network Error",
            "Could not connect to Supabase servers. Please check your network connection and try again."
          );
        } else {
          showAlert("danger", "Authentication Failed", errorMsg);
        }
      }
    });
  }
}

// Auto-bind on DOM ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAuthForms);
  } else {
    setupAuthForms();
  }
}

// Explicitly bind to window for global access
if (typeof window !== "undefined") {
  window.Auth = Auth;
}
