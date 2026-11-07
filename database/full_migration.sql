-- ============================================================================
-- CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
-- COMPLETE DATABASE MIGRATION SCRIPT (PHASE 3)
-- Run this complete script in the Supabase SQL Editor
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABLE DEFINITIONS
-- ----------------------------------------------------------------------------

-- A. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- B. MATERIAL RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.material_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name TEXT,
  material_type TEXT,
  quantity NUMERIC(12, 3) CHECK (quantity IS NULL OR quantity >= 0),
  unit TEXT,
  total_due NUMERIC(14, 2) CHECK (total_due IS NULL OR total_due >= 0),
  purchase_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_material_records_user_id ON public.material_records(user_id);
CREATE INDEX IF NOT EXISTS idx_material_records_purchase_date ON public.material_records(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_material_records_material_type ON public.material_records(material_type);
CREATE INDEX IF NOT EXISTS idx_material_records_person_name ON public.material_records(person_name);

-- C. PAYMENTS TABLE
-- Note: ON DELETE RESTRICT prevents silent deletion when material has payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_record_id UUID NOT NULL REFERENCES public.material_records(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_material_record_id ON public.payments(material_record_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date DESC);

-- ----------------------------------------------------------------------------
-- 2. AUTOMATIC PROFILE TRIGGER ON AUTH
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. BUSINESS LOGIC & OVERPAYMENT PREVENTION TRIGGERS
-- ----------------------------------------------------------------------------

-- A. Payment Validation Trigger (Amount > 0, User ID match, Overpayment block)
CREATE OR REPLACE FUNCTION public.validate_payment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_owner UUID;
  v_parent_total_due NUMERIC(14, 2);
  v_existing_paid NUMERIC(14, 2);
  v_new_total_paid NUMERIC(14, 2);
  v_outstanding_balance NUMERIC(14, 2);
BEGIN
  -- 1. Validate payment amount is positive
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero. Received: %', NEW.amount
      USING ERRCODE = 'check_violation';
  END IF;

  -- 2. Fetch parent material record details
  SELECT user_id, COALESCE(total_due, 0.00)
    INTO v_parent_owner, v_parent_total_due
  FROM public.material_records
  WHERE id = NEW.material_record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent material record with ID % does not exist', NEW.material_record_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- 3. Verify payment ownership matches parent material record owner
  IF NEW.user_id != v_parent_owner THEN
    RAISE EXCEPTION 'Security violation: Payment user_id (%) does not match material record owner (%)',
      NEW.user_id, v_parent_owner
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- 4. Calculate existing payments for this record (excluding current row on update)
  SELECT COALESCE(SUM(amount), 0.00)
    INTO v_existing_paid
  FROM public.payments
  WHERE material_record_id = NEW.material_record_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- 5. Calculate new projected total and outstanding balance
  v_new_total_paid := v_existing_paid + NEW.amount;
  v_outstanding_balance := v_parent_total_due - v_existing_paid;

  -- 6. Strictly block overpayments beyond outstanding balance
  IF v_parent_total_due > 0 AND v_new_total_paid > v_parent_total_due THEN
    RAISE EXCEPTION 'Overpayment prohibited: Payment of PKR % exceeds the outstanding balance of PKR % (Total Due: PKR %, Already Paid: PKR %)',
      NEW.amount, v_outstanding_balance, v_parent_total_due, v_existing_paid
      USING ERRCODE = 'numeric_value_out_of_range';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment ON public.payments;
CREATE TRIGGER trg_validate_payment
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payment_integrity();

-- B. Total Due Protection Trigger (Cannot decrease below paid amount)
CREATE OR REPLACE FUNCTION public.protect_material_total_due()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_paid NUMERIC(14, 2);
BEGIN
  NEW.updated_at := timezone('utc'::text, now());

  IF TG_OP = 'UPDATE' AND NEW.total_due IS DISTINCT FROM OLD.total_due THEN
    SELECT COALESCE(SUM(amount), 0.00)
      INTO v_existing_paid
    FROM public.payments
    WHERE material_record_id = NEW.id;

    IF NEW.total_due < v_existing_paid THEN
      RAISE EXCEPTION 'Cannot reduce Total Due to PKR % because PKR % has already been disbursed in payments',
        NEW.total_due, v_existing_paid
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_material_total_due ON public.material_records;
CREATE TRIGGER trg_protect_material_total_due
  BEFORE UPDATE ON public.material_records
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_material_total_due();

-- ----------------------------------------------------------------------------
-- 4. DATABASE VIEWS (AUTOMATED CALCULATIONS)
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

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "owner_profiles_policy" ON public.profiles;

CREATE POLICY "owner_profiles_policy"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = '55a43065-dcb8-450a-a68f-d05fd221a5bb'::uuid AND auth.uid() = id)
  WITH CHECK (auth.uid() = '55a43065-dcb8-450a-a68f-d05fd221a5bb'::uuid AND auth.uid() = id);

-- MATERIAL RECORDS
ALTER TABLE public.material_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materials_select_own" ON public.material_records;
DROP POLICY IF EXISTS "materials_insert_own" ON public.material_records;
DROP POLICY IF EXISTS "materials_update_own" ON public.material_records;
DROP POLICY IF EXISTS "materials_delete_own" ON public.material_records;
DROP POLICY IF EXISTS "owner_materials_policy" ON public.material_records;

CREATE POLICY "owner_materials_policy"
  ON public.material_records
  FOR ALL
  TO authenticated
  USING (auth.uid() = '55a43065-dcb8-450a-a68f-d05fd221a5bb'::uuid AND auth.uid() = user_id)
  WITH CHECK (auth.uid() = '55a43065-dcb8-450a-a68f-d05fd221a5bb'::uuid AND auth.uid() = user_id);

-- PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;
DROP POLICY IF EXISTS "payments_update_own" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_own" ON public.payments;
DROP POLICY IF EXISTS "owner_payments_policy" ON public.payments;

CREATE POLICY "owner_payments_policy"
  ON public.payments
  FOR ALL
  TO authenticated
  USING (auth.uid() = '55a43065-dcb8-450a-a68f-d05fd221a5bb'::uuid AND auth.uid() = user_id)
  WITH CHECK (auth.uid() = '55a43065-dcb8-450a-a68f-d05fd221a5bb'::uuid AND auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. DELETION SAFETY FUNCTIONS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_material_deletion_impact(p_material_record_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID;
  v_person_name TEXT;
  v_material_type TEXT;
  v_total_due NUMERIC(14, 2);
  v_payment_count INT;
  v_total_paid NUMERIC(14, 2);
BEGIN
  SELECT user_id, person_name, material_type, COALESCE(total_due, 0.00)
    INTO v_user_id, v_person_name, v_material_type, v_total_due
  FROM public.material_records
  WHERE id = p_material_record_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material record not found or access denied.'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0.00)
    INTO v_payment_count, v_total_paid
  FROM public.payments
  WHERE material_record_id = p_material_record_id AND user_id = auth.uid();

  RETURN jsonb_build_object(
    'material_record_id', p_material_record_id,
    'person_name', v_person_name,
    'material_type', v_material_type,
    'total_due', v_total_due,
    'payment_count', v_payment_count,
    'total_paid', v_total_paid,
    'has_payments', (v_payment_count > 0),
    'can_delete_directly', (v_payment_count = 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_material_record_explicit(
  p_material_record_id UUID,
  p_confirm_payment_deletion BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID;
  v_person_name TEXT;
  v_material_type TEXT;
  v_payment_count INT;
  v_total_paid NUMERIC(14, 2);
BEGIN
  SELECT user_id, person_name, material_type
    INTO v_user_id, v_person_name, v_material_type
  FROM public.material_records
  WHERE id = p_material_record_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material record not found or access denied.'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0.00)
    INTO v_payment_count, v_total_paid
  FROM public.payments
  WHERE material_record_id = p_material_record_id AND user_id = auth.uid();

  IF v_payment_count > 0 AND p_confirm_payment_deletion IS NOT TRUE THEN
    RAISE EXCEPTION 'Deletion blocked: This record has % payment transaction(s) totaling PKR %. Explicit confirmation is required to delete.',
      v_payment_count, v_total_paid
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF v_payment_count > 0 THEN
    DELETE FROM public.payments
    WHERE material_record_id = p_material_record_id AND user_id = auth.uid();
  END IF;

  DELETE FROM public.material_records
  WHERE id = p_material_record_id AND user_id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'deleted_material_id', p_material_record_id,
    'material_type', v_material_type,
    'deleted_payments_count', v_payment_count,
    'deleted_payments_amount', v_total_paid,
    'timestamp', timezone('utc'::text, now())
  );
END;
$$;

COMMIT;
