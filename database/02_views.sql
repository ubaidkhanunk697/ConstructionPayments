-- ============================================================================
-- CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
-- PHASE 4: DATABASE VIEWS & CALCULATED TOTALS (REFINED FOR NULL TOTAL DUE)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MATERIAL RECORDS VIEW (Calculated Paid, Pending & Status)
-- ----------------------------------------------------------------------------
-- Calculates Paid Amount and Pending Amount dynamically on read.
-- Records without a Total Due (total_due IS NULL) have pending_amount AS NULL
-- so they are never falsely treated as having zero pending debt!
-- Uses security_invoker = true so PostgreSQL respects Row Level Security.
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.material_records_view;

CREATE VIEW public.material_records_view
WITH (security_invoker = true)
AS
SELECT 
  m.id,
  m.user_id,
  m.person_name,
  m.material_type,
  m.quantity,
  m.unit,
  m.total_due,
  COALESCE(p.paid_amount, 0.00) AS paid_amount,
  CASE 
    WHEN m.total_due IS NULL THEN NULL 
    ELSE (m.total_due - COALESCE(p.paid_amount, 0.00))
  END AS pending_amount,
  COALESCE(p.payment_count, 0) AS payment_count,
  CASE 
    WHEN m.total_due IS NULL AND COALESCE(p.paid_amount, 0.00) > 0 THEN 'Partial'
    WHEN m.total_due IS NULL THEN 'Unset'
    WHEN COALESCE(p.paid_amount, 0.00) = 0 THEN 'Pending'
    WHEN COALESCE(p.paid_amount, 0.00) >= m.total_due THEN 'Paid'
    ELSE 'Partial'
  END AS payment_status,
  m.purchase_date,
  TRIM(TO_CHAR(m.purchase_date, 'Day')) AS purchase_day,
  m.notes,
  m.created_at,
  m.updated_at
FROM public.material_records m
LEFT JOIN (
  SELECT 
    material_record_id,
    SUM(amount) AS paid_amount,
    COUNT(id) AS payment_count
  FROM public.payments
  GROUP BY material_record_id
) p ON m.id = p.material_record_id;

-- ----------------------------------------------------------------------------
-- 2. PROJECT FINANCIAL SUMMARY VIEW (Dashboard Aggregates)
-- ----------------------------------------------------------------------------
-- Supplies the 4 core metrics for the project dashboard per owner:
-- Total Due: Sum of known Total Due amounts.
-- Total Paid: Sum of all payment transactions.
-- Total Pending: Sum of outstanding balances only for records with known Total Due.
-- Total Material Records: Count of all material records.
-- Unset Total Due Count: Count of records where Total Due is not specified.
-- ----------------------------------------------------------------------------

DROP VIEW IF EXISTS public.project_financial_summary_view;

CREATE VIEW public.project_financial_summary_view
WITH (security_invoker = true)
AS
SELECT 
  m.user_id,
  COALESCE(SUM(m.total_due), 0.00) AS total_amount_due,
  COALESCE(SUM(p.paid_amount), 0.00) AS total_paid,
  COALESCE(SUM(CASE WHEN m.total_due IS NOT NULL THEN (m.total_due - COALESCE(p.paid_amount, 0.00)) ELSE 0.00 END), 0.00) AS total_pending,
  COUNT(m.id) AS total_material_records,
  COUNT(CASE WHEN m.total_due IS NULL THEN 1 END) AS unset_total_due_count
FROM public.material_records m
LEFT JOIN (
  SELECT 
    material_record_id,
    SUM(amount) AS paid_amount
  FROM public.payments
  GROUP BY material_record_id
) p ON m.id = p.material_record_id
GROUP BY m.user_id;
