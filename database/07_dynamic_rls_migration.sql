-- ============================================================================
-- DYNAMIC SECURITY & SINGLE-OWNER AUTHENTICATION MIGRATION
-- Purges all hardcoded UUIDs and static allowlist assumptions.
-- Enforces dynamic, production-grade Row Level Security via Supabase auth.uid().
-- Single transaction (idempotent, atomic).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE RLS (DYNAMIC auth.uid() = id)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "owner_profiles_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_policy" ON public.profiles;

CREATE POLICY "profiles_owner_policy"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 2. MATERIAL RECORDS TABLE RLS (DYNAMIC auth.uid() = user_id)
-- ----------------------------------------------------------------------------
ALTER TABLE public.material_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materials_select_own" ON public.material_records;
DROP POLICY IF EXISTS "materials_insert_own" ON public.material_records;
DROP POLICY IF EXISTS "materials_update_own" ON public.material_records;
DROP POLICY IF EXISTS "materials_delete_own" ON public.material_records;
DROP POLICY IF EXISTS "owner_materials_policy" ON public.material_records;
DROP POLICY IF EXISTS "material_records_owner_policy" ON public.material_records;

CREATE POLICY "material_records_owner_policy"
  ON public.material_records
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. PAYMENTS TABLE RLS (DYNAMIC auth.uid() = user_id)
-- ----------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;
DROP POLICY IF EXISTS "payments_update_own" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_own" ON public.payments;
DROP POLICY IF EXISTS "owner_payments_policy" ON public.payments;
DROP POLICY IF EXISTS "payments_owner_policy" ON public.payments;

CREATE POLICY "payments_owner_policy"
  ON public.payments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. PROFILE SYNCHRONIZATION TRIGGER (handle_new_user)
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
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. PAYMENT INTEGRITY & OVERPAYMENT PREVENTION TRIGGER
-- ----------------------------------------------------------------------------
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

  -- 4. Verify caller matches payment user_id if executed from an authenticated session
  IF auth.uid() IS NOT NULL AND NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Security violation: Caller UID (%) does not match payment user_id (%)',
      auth.uid(), NEW.user_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- 5. Calculate existing payments for this record (excluding current row on UPDATE)
  SELECT COALESCE(SUM(amount), 0.00)
    INTO v_existing_paid
  FROM public.payments
  WHERE material_record_id = NEW.material_record_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- 6. Calculate projected new total
  v_new_total_paid := v_existing_paid + NEW.amount;
  v_outstanding_balance := v_parent_total_due - v_existing_paid;

  -- 7. Strictly block overpayments beyond outstanding balance
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

-- ----------------------------------------------------------------------------
-- 6. MATERIAL TOTAL DUE PROTECTION TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_material_total_due()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_paid NUMERIC(14, 2);
BEGIN
  NEW.updated_at := timezone('utc'::text, now());

  -- If total_due is reduced, verify it does not fall below disbursed payments
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
-- 7. DYNAMIC DELETION SAFETY PROCEDURES (SECURITY INVOKER + auth.uid())
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
  -- Verify record exists and dynamically belongs to current user
  SELECT user_id, person_name, material_type, COALESCE(total_due, 0.00)
    INTO v_user_id, v_person_name, v_material_type, v_total_due
  FROM public.material_records
  WHERE id = p_material_record_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material record not found or access denied.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Count associated payments belonging to current user
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
  -- Verify record exists and dynamically belongs to current user
  SELECT user_id, person_name, material_type
    INTO v_user_id, v_person_name, v_material_type
  FROM public.material_records
  WHERE id = p_material_record_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material record not found or access denied.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Count existing payments
  SELECT COUNT(*), COALESCE(SUM(amount), 0.00)
    INTO v_payment_count, v_total_paid
  FROM public.payments
  WHERE material_record_id = p_material_record_id AND user_id = auth.uid();

  -- Require explicit confirmation if payments exist
  IF v_payment_count > 0 AND p_confirm_payment_deletion IS NOT TRUE THEN
    RAISE EXCEPTION 'Deletion blocked: This record has % payment transaction(s) totaling PKR %. Explicit confirmation is required to delete.',
      v_payment_count, v_total_paid
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- If confirmed, delete payments first to respect foreign keys
  IF v_payment_count > 0 THEN
    DELETE FROM public.payments
    WHERE material_record_id = p_material_record_id AND user_id = auth.uid();
  END IF;

  -- Delete the parent material record
  DELETE FROM public.material_records
  WHERE id = p_material_record_id AND user_id = auth.uid();

  RETURN jsonb_build_object(
    'success', TRUE,
    'deleted_material_record_id', p_material_record_id,
    'person_name', v_person_name,
    'material_type', v_material_type,
    'deleted_payments_count', v_payment_count,
    'deleted_payments_total_pkr', v_total_paid
  );
END;
$$;

COMMIT;
