-- ============================================================================
-- CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
-- MIGRATION 08: RECEIPT PHOTO STORAGE & SCHEMA UPDATE
-- ============================================================================

-- 1. Add receipt_url column to material_records
ALTER TABLE public.material_records 
ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- 2. Update material_records_view to include receipt_url
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

-- 3. Create 'receipts' Storage Bucket (Public read for owners, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Enable RLS on storage.objects (if not already enabled)
-- Policies for 'receipts' bucket
DO $$
BEGIN
  -- Insert policy for authenticated owner
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated owners can upload receipts'
  ) THEN
    CREATE POLICY "Authenticated owners can upload receipts"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'receipts');
  END IF;

  -- Select policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Anyone can view receipts'
  ) THEN
    CREATE POLICY "Anyone can view receipts"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'receipts');
  END IF;

  -- Update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated owners can update receipts'
  ) THEN
    CREATE POLICY "Authenticated owners can update receipts"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'receipts');
  END IF;

  -- Delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage' 
    AND policyname = 'Authenticated owners can delete receipts'
  ) THEN
    CREATE POLICY "Authenticated owners can delete receipts"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'receipts');
  END IF;
END $$;
