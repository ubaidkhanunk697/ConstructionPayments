/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Centralized Supabase v2 Client Instance
 * (Ensures lowercase supabase.auth is globally available across desktop & mobile browsers)
 */

(function (window) {
  "use strict";

  function getSupabaseClient() {
    if (window.supabaseClient && window.supabaseClient.auth) {
      return window.supabaseClient;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.warn("Supabase SDK not loaded yet. Ensure @supabase/supabase-js is imported.");
      return null;
    }

    // Resolve Supabase project URL and Anon Key
    const env = window.ENV || {};
    const rawUrl = (env.SUPABASE_URL || (typeof CONFIG !== "undefined" && CONFIG.SUPABASE?.URL) || "https://ofckjnslflkqtdgiikwr.supabase.co").trim();
    const cleanUrl = rawUrl.replace(/\/rest\/v1\/?\.?$/i, "").replace(/[\/\.]+$/, "");
    const anonKey = (env.SUPABASE_ANON_KEY || (typeof CONFIG !== "undefined" && CONFIG.SUPABASE?.ANON_KEY) || "sb_publishable_IvG5xZ7cG7AtZPTbmQhk8A_dmzP85h4").trim();

    try {
      const client = window.supabase.createClient(cleanUrl, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== "undefined" && window.localStorage ? window.localStorage : undefined
        }
      });

      window.supabaseClient = client;
      return client;
    } catch (e) {
      console.error("Failed to create Supabase client in supabaseClient.js:", e);
      return null;
    }
  }

  // Attempt eager initialization
  if (typeof window !== "undefined") {
    // If Supabase SDK is already loaded, instantiate client immediately
    if (window.supabase && typeof window.supabase.createClient === "function") {
      getSupabaseClient();
    } else {
      // Otherwise wait for DOMContentLoaded
      window.addEventListener("DOMContentLoaded", () => {
        getSupabaseClient();
      });
    }

    // Expose helpers globally
    window.getSupabaseClient = getSupabaseClient;
  }
})(typeof window !== "undefined" ? window : globalThis);
