-- ============================================================================
-- CONSTRUCTION MATERIAL & PAYMENT MANAGEMENT SYSTEM
-- PHASE 3: ROW LEVEL SECURITY (RLS) POLICIES
-- Dynamic auth.uid() enforcement - Zero hardcoded UUIDs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE RLS
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
-- 2. MATERIAL RECORDS TABLE RLS
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
-- 3. PAYMENTS TABLE RLS
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
