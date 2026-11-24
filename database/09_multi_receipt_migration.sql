-- ============================================================================
-- CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
-- MIGRATION 09: MULTI-RECEIPT IMAGES (ARRAY SUPPORT & ZERO DATA LOSS)
-- ============================================================================

-- 1. Add receipt_urls column (array of text) to material_records
ALTER TABLE public.material_records 
ADD COLUMN IF NOT EXISTS receipt_urls TEXT[] DEFAULT '{}'::TEXT[];

-- 2. Safely migrate existing single receipt_url values into receipt_urls array
UPDATE public.material_records
SET receipt_urls = ARRAY[receipt_url]
WHERE receipt_url IS NOT NULL 
  AND receipt_url <> ''
  AND (receipt_urls IS NULL OR cardinality(receipt_urls) = 0);

-- 3. Update material_records_view to expose both receipt_urls and legacy receipt_url
DROP VIEW IF EXISTS public.material_records_view CASCADE;

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
  m.receipt_url,
  COALESCE(m.receipt_urls, '{}'::TEXT[]) AS receipt_urls,
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

-- 4. Re-grant permissions on the view
GRANT SELECT ON public.material_records_view TO authenticated;
GRANT SELECT ON public.material_records_view TO anon;
