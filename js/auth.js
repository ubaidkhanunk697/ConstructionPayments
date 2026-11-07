/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Centralized Supabase Authentication Service & Route Guards
 */

const Auth = {
  client: null,
  currentUser: null,
  currentSession: null,

  /**
   * Initialize Supabase Client
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
          detectSessionInUrl: true
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
   * Authenticate using Google OAuth
   */
  async signInWithGoogle() {
    const supabase = this.init();
    if (!supabase) {
      throw new Error("Supabase is not configured. Please add your credentials in js/env.js.");
    }

    // Dynamically construct redirect URL to dashboard.html based on active server origin
    const redirectTo = `${window.location.origin}/dashboard.html`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
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

    // Redirect to login page with logout notice
    const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
    window.location.href = `${currentDir}login.html?notice=logged_out`;
  },

  /**
   * Retrieve active session
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
   * If unauthorized, signs out immediately and redirects to login.html
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
      console.warn("Unauthorized Google account detected:", user.email);
      // Immediately terminate session
      await supabase.auth.signOut();
      const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
      const attempted = encodeURIComponent(user.email || "unknown");
      window.location.replace(`${currentDir}login.html?error=unauthorized&attempted=${attempted}`);
      return { status: "unauthorized", user };
    }

    this.currentUser = user;
    this.currentSession = session;

    // Listen for auth state changes (e.g. cross-tab signout, token expiry)
    supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === "SIGNED_OUT" || !currentSession) {
        const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
        window.location.replace(`${currentDir}login.html?reason=session_expired`);
      } else if (currentSession && !this.isAuthorizedOwner(currentSession.user)) {
        await supabase.auth.signOut();
        const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
        window.location.replace(`${currentDir}login.html?error=unauthorized`);
      }
    });

    return { status: "authorized", user, session };
  },

  /**
   * Guard for Public / Gateway Pages (e.g. login.html, index.html)
   * If already logged in as authorized owner, redirects directly to dashboard.html
   */
  async redirectIfAuthenticated() {
    if (!CONFIG.isConfigured()) return;

    const supabase = this.init();
    if (!supabase) return;

    // Check URL parameters for OAuth errors
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.get("error") || (hash && hash.includes("error="))) {
      return; // Do not auto-redirect if an error is present
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

