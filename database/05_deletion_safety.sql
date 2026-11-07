-- ============================================================================
-- CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
-- PHASE 3: DELETION SAFETY & TRANSACTIONAL PROCEDURES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DELETION IMPACT PREVIEW FUNCTION
-- ----------------------------------------------------------------------------
-- Inspects a material record prior to deletion to report associated payments
-- Used by the UI deletion modal to show exact financial impact
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
  -- Verify record exists and belongs to current user
  SELECT user_id, person_name, material_type, COALESCE(total_due, 0.00)
    INTO v_user_id, v_person_name, v_material_type, v_total_due
  FROM public.material_records
  WHERE id = p_material_record_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material record not found or access denied.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Count associated payment transactions
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

-- ----------------------------------------------------------------------------
-- 2. EXPLICIT CONFIRMED DELETION PROCEDURE
-- ----------------------------------------------------------------------------
-- Prevents silent cascade deletions.
-- If payments exist, p_confirm_payment_deletion must be explicitly set to TRUE.
-- Executes in a single atomic transaction.
-- ----------------------------------------------------------------------------

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
  -- Verify ownership
  SELECT user_id, person_name, material_type
    INTO v_user_id, v_person_name, v_material_type
  FROM public.material_records
  WHERE id = p_material_record_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material record not found or access denied.'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Check existing payments
  SELECT COUNT(*), COALESCE(SUM(amount), 0.00)
    INTO v_payment_count, v_total_paid
  FROM public.payments
  WHERE material_record_id = p_material_record_id AND user_id = auth.uid();

  -- If payments exist but explicit confirmation was not given, abort
  IF v_payment_count > 0 AND p_confirm_payment_deletion IS NOT TRUE THEN
    RAISE EXCEPTION 'Deletion blocked: This record has % payment transaction(s) totaling PKR %. Explicit confirmation is required to delete.',
      v_payment_count, v_total_paid
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Atomically delete payments first (if any)
  IF v_payment_count > 0 THEN
    DELETE FROM public.payments
    WHERE material_record_id = p_material_record_id AND user_id = auth.uid();
  END IF;

  -- Delete the material record
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
