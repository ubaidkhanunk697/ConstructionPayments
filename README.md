# Construction Material & Payment Management System

> Production-ready, secure, and responsive web application designed for managing construction material procurement, supplier disbursements, and pending balances with strict single-owner Row Level Security (RLS).

---

## 🌟 Key Features

* **Strict Single-Owner Authentication**: Google OAuth powered by Supabase Auth with hardcoded owner UUID allowlisting. Unauthorized accounts are automatically ejected upon sign-in.
* **Real-Time Financial Calculations**: Automatically calculates `Total Amount Due`, `Paid Amount`, and `Pending Amount` in Pakistani Rupees (PKR: `Rs.`).
* **Automated Payment Statuses**: Visual status badges (`Paid` in emerald green, `Partial` in amber, and `Pending` in rose) computed automatically when outstanding balances reach Rs. 0.
* **Overpayment Prevention**: Database-level and client-side triggers block disbursements exceeding the contract due amount.
* **Multi-Worksheet Excel Export**: Built-in SheetJS engine exports all procurement records, complete payment history, and KPI financial summaries into a stylized multi-tab `.xlsx` file.
* **Responsive Architecture**: Fully optimized for desktop, laptops, tablets, and mobile devices with touch navigation bars and adaptive card layouts.
* **Database Views & Deletion Safety**: Backed by PostgreSQL 15 views (`material_records_view`, `project_financial_summary_view`) and deletion protection RPC functions with foreign key restriction (`ON DELETE RESTRICT`).

---

## 🛠️ Tech Stack

* **Frontend**: Pure Vanilla JavaScript (ES6+), HTML5, CSS3 Custom Properties
* **Backend & Auth**: [Supabase](https://supabase.com/) (PostgreSQL 15, Row Level Security, Google OAuth)
* **Icons**: [Lucide Icons](https://lucide.dev/)
* **Data Visualization**: [Chart.js](https://www.chartjs.org/)
* **Spreadsheet Engine**: [SheetJS (xlsx)](https://sheetjs.com/)
* **Deployment**: Ready for Vercel, Netlify, or local hosting.

---

## 🚀 Quick Start (Local Development)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ubaidkhanunk697/ConstructionPayments.git
   cd ConstructionPayments
   ```

2. **Configure Environment**:
   Copy `js/env.template.js` to `js/env.js` and enter your Supabase credentials:
   ```javascript
   window.ENV = {
     SUPABASE_URL: "https://your-project.supabase.co",
     SUPABASE_ANON_KEY: "your-anon-publishable-key",
     ALLOWED_OWNER_EMAIL: "owner@example.com",
     ALLOWED_OWNER_UUID: "your-supabase-user-uuid"
   };
   ```

3. **Start Local Server**:
   ```bash
   node server.js
   ```
   Open [http://127.0.0.1:5500/](http://127.0.0.1:5500/) or [http://localhost:5500/](http://localhost:5500/) in your browser.

---

## 🗄️ Database Setup

Run the SQL migration script located in [`database/full_migration.sql`](database/full_migration.sql) inside your Supabase **SQL Editor**. This will automatically create:
* Tables: `public.profiles`, `public.material_records`, `public.payments`
* Views: `material_records_view`, `project_financial_summary_view`
* Strict Row Level Security (RLS) policies locked to the owner UUID
* Business integrity and overpayment validation triggers

---

## 🚢 Deployment

* **Vercel**: Pre-configured with [`vercel.json`](vercel.json) (Clean URLs, SPA route rewrites, CSP security headers).
* **Netlify**: Pre-configured with [`netlify.toml`](netlify.toml) (Redirect rules and cache headers).

---

## 📄 License

This project is released for private and commercial use in construction project accounting.
