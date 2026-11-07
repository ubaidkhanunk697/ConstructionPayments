-- ============================================================================
-- CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
-- SEED SCRIPT: 5 DUMMY RECORDS FOR DESIGN, EDIT & DELETE TESTING
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_mat1_id UUID;
  v_mat2_id UUID;
  v_mat3_id UUID;
  v_mat4_id UUID;
  v_mat5_id UUID;
BEGIN
  -- Select the first authenticated user in profiles (or fallback to auth.users)
  SELECT id INTO v_user_id FROM public.profiles LIMIT 1;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found in auth.users or profiles. Please sign up or log in first before running this seed script.';
    RETURN;
  END IF;

  -- 1. Record 1: Fauji Cement (Partial Payment - 2 Payments recorded)
  INSERT INTO public.material_records (
    user_id, person_name, material_type, quantity, unit, total_due, purchase_date, notes
  ) VALUES (
    v_user_id,
    'Haji Aslam (Fauji Cement Dealer)',
    'Cement (Fauji, Maple Leaf, Lucky, etc.)',
    250.000,
    'Bags',
    325000.00,
    '2026-11-01',
    '250 bags Fauji Cement for basement slab casting delivered via Hino Truck LES-4412. Bilty #8821.'
  ) RETURNING id INTO v_mat1_id;

  INSERT INTO public.payments (user_id, material_record_id, amount, payment_date, payment_method, notes)
  VALUES 
    (v_user_id, v_mat1_id, 100000.00, '2026-11-01', 'Bank Transfer', 'Initial 50% advance for dispatch via Meezan Bank'),
    (v_user_id, v_mat1_id, 100000.00, '2026-11-03', 'Cash', 'Second installment paid to truck driver upon delivery verification');

  -- 2. Record 2: Tariq Steel Mills (Fully Paid - 2 Payments recorded)
  INSERT INTO public.material_records (
    user_id, person_name, material_type, quantity, unit, total_due, purchase_date, notes
  ) VALUES (
    v_user_id,
    'Tariq Steel Mills (Mian Tariq)',
    'Steel / Sariya (Grade 60 / Grade 40)',
    3.500,
    'Tons',
    910000.00,
    '2026-10-25',
    'Grade 60 deformed steel bars (1/2 inch & 3/4 inch) for ground floor pillars. Weighbridge slip #4102. Fully settled.'
  ) RETURNING id INTO v_mat2_id;

  INSERT INTO public.payments (user_id, material_record_id, amount, payment_date, payment_method, notes)
  VALUES 
    (v_user_id, v_mat2_id, 500000.00, '2026-10-25', 'Bank Transfer', 'Advance payment via online transfer'),
    (v_user_id, v_mat2_id, 410000.00, '2026-10-28', 'Cash', 'Final clearance upon steel bundle unloading');

  -- 3. Record 3: Chenab Sand Supply (Partial Payment - 1 Payment recorded)
  INSERT INTO public.material_records (
    user_id, person_name, material_type, quantity, unit, total_due, purchase_date, notes
  ) VALUES (
    v_user_id,
    'Chaudhry Riasat (Chenab Sand Supply)',
    'Sand / Rait (Chenab, Ravi, Lawrencepur)',
    4.000,
    'Trucks',
    180000.00,
    '2026-11-02',
    'Chenab river washed coarse sand for roof screening and masonry work. 4 Dumper trucks unloaded.'
  ) RETURNING id INTO v_mat3_id;

  INSERT INTO public.payments (user_id, material_record_id, amount, payment_date, payment_method, notes)
  VALUES 
    (v_user_id, v_mat3_id, 60000.00, '2026-11-02', 'Cash', 'Cash paid to dumper driver Rashid');

  -- 4. Record 4: Bismillah Bhatta (Unpaid - 0 Payments recorded, ideal for clean deletion/add payment testing)
  INSERT INTO public.material_records (
    user_id, person_name, material_type, quantity, unit, total_due, purchase_date, notes
  ) VALUES (
    v_user_id,
    'Bismillah Bhatta (Ustad Munir)',
    'Bricks / Eint (Awwal, Doem, Bhatta)',
    15.000,
    'Senkrra',
    240000.00,
    '2026-11-04',
    'Awwal grade baked red clay bricks (15,000 bricks). Payment committed by coming Friday.'
  ) RETURNING id INTO v_mat4_id;

  -- 5. Record 5: Al-Madina Marble & Tiles (Partial Payment - 1 Payment recorded)
  INSERT INTO public.material_records (
    user_id, person_name, material_type, quantity, unit, total_due, purchase_date, notes
  ) VALUES (
    v_user_id,
    'Al-Madina Marble & Tiles (Haji Qasim)',
    'Tiles & Marble',
    1800.000,
    'Sq. Feet',
    450000.00,
    '2026-11-05',
    'Sunny White marble slabs and kitchen porcelain tiles 24x24 inches. Invoice #1042.'
  ) RETURNING id INTO v_mat5_id;

  INSERT INTO public.payments (user_id, material_record_id, amount, payment_date, payment_method, notes)
  VALUES 
    (v_user_id, v_mat5_id, 150000.00, '2026-11-05', 'Bank Transfer', 'Online bank transfer via Allied Bank ref #992182');

  RAISE NOTICE 'Successfully seeded 5 dummy material records and 6 payment transactions for user %!', v_user_id;
END $$;
