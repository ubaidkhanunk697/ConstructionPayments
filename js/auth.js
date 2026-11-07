/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Centralized Supabase Authentication Service & Route Guards
 * (Supabase Email & Password Authentication)
 */

const Auth = {
  client: null,
  currentUser: null,
  currentSession: null,

  /**
   * Initialize Supabase Client with persistent session and auto-refresh
   */
  init() {
    if (this.client) return this.client;

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.warn("Supabase SDK not detected. Ensure @supabase/supabase-js is loaded.");
      return null;
    }

    if (!CONFIG.isConfigured()) {
      console.warn("Supabase credentials not fully configured in js/config.js or js/env.js.");
      return null;
    }

    try {
      this.client = window.supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: typeof window !== "undefined" ? window.localStorage : undefined
        }
      });
      return this.client;
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
      return null;
    }
  },

  /**
   * Determine if a user matches the authorized owner allowlist
   */
  isAuthorizedOwner(user) {
    if (!user) return false;

    const userEmail = (user.email || "").trim().toLowerCase();
    const ownerEmail = (CONFIG.AUTH.ALLOWED_OWNER_EMAIL || "").trim().toLowerCase();
    const ownerUUID = (CONFIG.AUTH.ALLOWED_OWNER_UUID || "").trim();

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
   * Register a new user with Email and Password
   */
  async signUp({ fullName, email, password }) {
    const supabase = this.init();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please check your credentials.");
    }

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanName = (fullName || "").trim();

    // Single-Owner Registration Security Check:
    // If an owner email is specified, enforce that only this email can register
    const ownerEmail = (CONFIG.AUTH.ALLOWED_OWNER_EMAIL || "").trim().toLowerCase();
    if (ownerEmail && cleanEmail !== ownerEmail) {
      const approvedEmails = [
        ownerEmail,
        "ubaidkhanuk6973937@gmail.com",
        "ubaidkhanunk697@gmail.com"
      ];
      if (!approvedEmails.includes(cleanEmail)) {
        throw new Error("Registration is restricted to the authorized project owner. Public registration is closed.");
      }
    }

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

    // Check if user already exists (Supabase obfuscation check)
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      const err = new Error("User already registered");
      err.code = "user_already_exists";
      throw err;
    }

    // If a session was returned immediately (email confirmation disabled in Supabase)
    if (data.session && data.user) {
      this.currentUser = data.user;
      this.currentSession = data.session;

      // Attempt to save profile record if profiles table exists
      try {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: cleanEmail,
          full_name: cleanName
        });
      } catch (profileErr) {
        console.warn("Profile table upsert non-critical warning:", profileErr);
      }
    }

    return data;
  },

  /**
   * Authenticate using Email and Password
   */
  async signIn({ email, password }) {
    const supabase = this.init();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please check your credentials.");
    }

    const cleanEmail = (email || "").trim().toLowerCase();

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

    // Verify authorized single-owner status
    if (!this.isAuthorizedOwner(data.user)) {
      await supabase.auth.signOut();
      throw new Error("Access denied: This email is not authorized as the project owner.");
    }

    this.currentUser = data.user;
    this.currentSession = data.session;

    return data;
  },

  /**
   * Request password reset email
   */
  async resetPassword(email) {
    const supabase = this.init();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please check your credentials.");
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
    if (this.client) {
      try {
        await this.client.auth.signOut();
      } catch (err) {
        console.error("Error during Supabase signOut:", err);
      }
    }

    this.currentUser = null;
    this.currentSession = null;

    // Clear any cached credentials from storage
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        // Leave any offline non-auth caches intact if present
      }
    } catch (e) {}

    // Redirect to login page with logout notice
    const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
    window.location.href = `${currentDir}login.html?notice=logged_out`;
  },

  /**
   * Retrieve active session from Supabase client
   */
  async getSession() {
    const supabase = this.init();
    if (!supabase) return null;

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
   * Enforces:
   * 1. Active session exists
   * 2. User identity matches authorized owner allowlist
   * If unauthorized or not logged in, redirects immediately to login.html
   */
  async requireOwnerAuth() {
    if (!CONFIG.isConfigured()) {
      return { status: "unconfigured" };
    }

    const supabase = this.init();
    if (!supabase) {
      return { status: "unconfigured" };
    }

    const session = await this.getSession();

    if (!session || !session.user) {
      // Unauthenticated visitor -> redirect to login
      const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
      window.location.replace(`${currentDir}login.html?reason=unauthenticated`);
      return { status: "unauthenticated" };
    }

    // Verify authorized owner allowlist
    const user = session.user;
    if (!this.isAuthorizedOwner(user)) {
      console.warn("Unauthorized account detected:", user.email);
      // Immediately terminate session
      await supabase.auth.signOut();
      const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
      const attempted = encodeURIComponent(user.email || "unknown");
      window.location.replace(`${currentDir}login.html?error=unauthorized&attempted=${attempted}`);
      return { status: "unauthorized", user };
    }

    this.currentUser = user;
    this.currentSession = session;

    // Listen for auth state changes (e.g. cross-tab signout, token expiry, refresh)
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
   * Guard for Public / Gateway Pages (e.g. login.html, register.html, index.html)
   * If already logged in as authorized owner, redirects directly to dashboard.html
   */
  async redirectIfAuthenticated() {
    if (!CONFIG.isConfigured()) return;

    const supabase = this.init();
    if (!supabase) return;

    // Check URL parameters for explicit errors
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      return; // Do not auto-redirect if an error param is present
    }

    const session = await this.getSession();
    if (session && session.user) {
      if (this.isAuthorizedOwner(session.user)) {
        const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
        window.location.replace(`${currentDir}dashboard.html`);
      } else {
        // Sign out unauthorized lingering session
        await supabase.auth.signOut();
      }
    }
  }
};

// Explicitly bind to window for global access
if (typeof window !== "undefined") {
  window.Auth = Auth;
}
