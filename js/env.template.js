/**
 * CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
 * Environment Configuration Template
 * 
 * Instructions:
 * 1. Copy this file and rename it to 'env.js' in the same 'js/' directory.
 * 2. Replace the placeholder values below with your actual Supabase project settings.
 * 3. Never commit 'env.js' with sensitive keys if using a public repository.
 * 4. NEVER use the 'service_role' secret key here - ONLY use the publishable 'anon' key!
 */

window.ENV = {
  // Your Supabase Project URL (found in Supabase Settings -> API)
  // e.g. "https://abcdefghijklm.supabase.co"
  SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",

  // Your Supabase Publishable / Anon Key (found in Supabase Settings -> API)
  // Starts with 'eyJ...'
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",

  // The ONE approved Google Account email for the project owner
  // Only this exact email address will be permitted to access the application
  ALLOWED_OWNER_EMAIL: "owner@example.com",

  // (Optional) The Supabase Auth UUID of the owner (if you know it)
  ALLOWED_OWNER_UUID: ""
};
