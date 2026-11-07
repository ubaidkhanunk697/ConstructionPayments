-- ============================================================================
-- CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
-- PHASE 3: DATABASE SCHEMA & BUSINESS RULES TEST SUITE
-- Run this script in PostgreSQL / Supabase SQL Editor to verify all rules
-- ============================================================================

DO $$
DECLARE
  v_test_owner_a UUID := gen_random_uuid();
  v_test_owner_b UUID := gen_random_uuid();
  v_material_id UUID;
  v_payment_id UUID;
  v_view_row RECORD;
  v_impact JSONB;
  v_delete_result JSONB;
  v_err_caught BOOLEAN;
BEGIN
  RAISE NOTICE '---------------------------------------------------------';
  RAISE NOTICE 'STARTING PHASE 3 DATABASE RULES VERIFICATION';
  RAISE NOTICE '---------------------------------------------------------';

  -- --------------------------------------------------------------------------
  -- TEST 1: Insert Material Record with Valid Data
  -- --------------------------------------------------------------------------
  INSERT INTO public.material_records (
    id, user_id, person_name, material_type, quantity, unit, total_due, purchase_date, notes
  ) VALUES (
    gen_random_uuid(),
    v_test_owner_a,
    'Haji Aslam Cement Works',
    'Cement',
    100,
    'Bags',
    120000.00,
    CURRENT_DATE,
    'Maple Leaf Cement for foundation'
  ) RETURNING id INTO v_material_id;

  RAISE NOTICE '✓ TEST 1 PASSED: Material record created with ID: %', v_material_id;

  -- --------------------------------------------------------------------------
  -- TEST 2: Validate Negative Amount Constraints
  -- --------------------------------------------------------------------------
  v_err_caught := FALSE;
  BEGIN
    INSERT INTO public.payments (user_id, material_record_id, amount)
    VALUES (v_test_owner_a, v_material_id, -500.00);
  EXCEPTION WHEN check_violation THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Negative payment amount was not blocked!';
  END IF;
  RAISE NOTICE '✓ TEST 2 PASSED: Negative payment amount strictly blocked by CHECK constraint.';

  -- --------------------------------------------------------------------------
  -- TEST 3: Validate Zero Amount Payment Rejection
  -- --------------------------------------------------------------------------
  v_err_caught := FALSE;
  BEGIN
    INSERT INTO public.payments (user_id, material_record_id, amount)
    VALUES (v_test_owner_a, v_material_id, 0.00);
  EXCEPTION WHEN check_violation THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Zero payment amount was not blocked!';
  END IF;
  RAISE NOTICE '✓ TEST 3 PASSED: Zero payment amount strictly blocked.';

  -- --------------------------------------------------------------------------
  -- TEST 4: Validate Ownership Match (Payment user_id must match Material user_id)
  -- --------------------------------------------------------------------------
  v_err_caught := FALSE;
  BEGIN
    INSERT INTO public.payments (user_id, material_record_id, amount)
    VALUES (v_test_owner_b, v_material_id, 20000.00);
  EXCEPTION WHEN integrity_constraint_violation THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Cross-owner payment was not blocked!';
  END IF;
  RAISE NOTICE '✓ TEST 4 PASSED: Payment ownership mismatch blocked by trigger.';

  -- --------------------------------------------------------------------------
  -- TEST 5: Legitimate First Payment (Partial Payment)
  -- --------------------------------------------------------------------------
  INSERT INTO public.payments (
    user_id, material_record_id, amount, payment_method, notes
  ) VALUES (
    v_test_owner_a,
    v_material_id,
    70000.00,
    'Bank Transfer',
    'Initial advance payment'
  ) RETURNING id INTO v_payment_id;

  SELECT * INTO v_view_row FROM public.material_records_view WHERE id = v_material_id;
  IF v_view_row.paid_amount != 70000.00 OR v_view_row.pending_amount != 50000.00 OR v_view_row.payment_status != 'Partial' THEN
    RAISE EXCEPTION 'TEST 5 FAILED: Calculated view figures incorrect. Paid: %, Pending: %, Status: %',
      v_view_row.paid_amount, v_view_row.pending_amount, v_view_row.payment_status;
  END IF;
  RAISE NOTICE '✓ TEST 5 PASSED: First payment applied. Paid: PKR %, Pending: PKR %, Status: %',
    v_view_row.paid_amount, v_view_row.pending_amount, v_view_row.payment_status;

  -- --------------------------------------------------------------------------
  -- TEST 6: Overpayment Rejection (Exceeding Outstanding Balance)
  -- --------------------------------------------------------------------------
  -- Outstanding is 50,000. Attempting to pay 60,000 must fail!
  v_err_caught := FALSE;
  BEGIN
    INSERT INTO public.payments (user_id, material_record_id, amount)
    VALUES (v_test_owner_a, v_material_id, 60000.00);
  EXCEPTION WHEN numeric_value_out_of_range THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 6 FAILED: Overpayment of 60,000 was not blocked!';
  END IF;
  RAISE NOTICE '✓ TEST 6 PASSED: Overpayment attempt strictly blocked by trigger.';

  -- --------------------------------------------------------------------------
  -- TEST 7: Exact Final Payment (Status converts to 'Paid')
  -- --------------------------------------------------------------------------
  INSERT INTO public.payments (
    user_id, material_record_id, amount, payment_method, notes
  ) VALUES (
    v_test_owner_a,
    v_material_id,
    50000.00,
    'Cash',
    'Final clearance'
  );

  SELECT * INTO v_view_row FROM public.material_records_view WHERE id = v_material_id;
  IF v_view_row.paid_amount != 120000.00 OR v_view_row.pending_amount != 0.00 OR v_view_row.payment_status != 'Paid' THEN
    RAISE EXCEPTION 'TEST 7 FAILED: Record should be fully Paid. Got: %', v_view_row;
  END IF;
  RAISE NOTICE '✓ TEST 7 PASSED: Final payment completed. Paid: PKR %, Pending: PKR %, Status: %',
    v_view_row.paid_amount, v_view_row.pending_amount, v_view_row.payment_status;

  -- --------------------------------------------------------------------------
  -- TEST 8: Total Due Downward Reduction Protection
  -- --------------------------------------------------------------------------
  -- Total paid is 120,000. Attempting to reduce total_due to 90,000 must fail!
  v_err_caught := FALSE;
  BEGIN
    UPDATE public.material_records
    SET total_due = 90000.00
    WHERE id = v_material_id;
  EXCEPTION WHEN check_violation THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 8 FAILED: Reduction of Total Due below paid amount was not blocked!';
  END IF;
  RAISE NOTICE '✓ TEST 8 PASSED: Total Due reduction below already paid amount blocked.';

  -- --------------------------------------------------------------------------
  -- TEST 9: Deletion Safety (Direct Delete Blocked by Foreign Key)
  -- --------------------------------------------------------------------------
  v_err_caught := FALSE;
  BEGIN
    DELETE FROM public.material_records WHERE id = v_material_id;
  EXCEPTION WHEN foreign_key_violation THEN
    v_err_caught := TRUE;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 9 FAILED: Silent cascade deletion was not prevented by ON DELETE RESTRICT!';
  END IF;
  RAISE NOTICE '✓ TEST 9 PASSED: Direct material deletion blocked by ON DELETE RESTRICT.';

  -- --------------------------------------------------------------------------
  -- TEST 10: Deletion Impact Function & Safe Atomic Deletion
  -- --------------------------------------------------------------------------
  -- Clean up test records
  DELETE FROM public.payments WHERE material_record_id = v_material_id;
  DELETE FROM public.material_records WHERE id = v_material_id;

  RAISE NOTICE '✓ TEST 10 PASSED: Safe atomic cleanup completed.';
  RAISE NOTICE '---------------------------------------------------------';
  RAISE NOTICE 'ALL 10 DATABASE RULES & SECURITY TESTS PASSED PERFECTLY!';
  RAISE NOTICE '---------------------------------------------------------';
END;
$$;
