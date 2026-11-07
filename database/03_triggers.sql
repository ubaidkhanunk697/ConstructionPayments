-- ============================================================================
-- CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
-- PHASE 3: DATABASE TRIGGERS & BUSINESS INTEGRITY LOGIC
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PAYMENT INTEGRITY & OVERPAYMENT PREVENTION TRIGGER
-- ----------------------------------------------------------------------------
-- Validates:
-- a) Payment amount is strictly greater than 0
-- b) Payment user_id matches the parent material record owner
-- c) Cumulative payments do not exceed Total Amount Due (Overpayment Prevention)
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

  -- 4. Calculate existing payments for this record (excluding the current row on UPDATE)
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

-- ----------------------------------------------------------------------------
-- 2. MATERIAL RECORD TOTAL DUE PROTECTION TRIGGER
-- ----------------------------------------------------------------------------
-- Prevents reducing Total Due below what has already been disbursed in payments
-- Automatically updates updated_at timestamp
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_material_total_due()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_paid NUMERIC(14, 2);
BEGIN
  -- Update timestamp on modification
  NEW.updated_at := timezone('utc'::text, now());

  -- If total_due is changed, ensure it is not less than already recorded payments
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
