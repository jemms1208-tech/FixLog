-- 1. check_is_admin 함수 업데이트 (operator와 admin 권한 통합)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('operator', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. profiles 테이블 RLS 업데이트
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Operators and Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Manage all profiles" ON public.profiles;

CREATE POLICY "Manage all profiles" ON public.profiles 
FOR ALL TO authenticated 
USING (public.check_is_admin());

-- 3. service_types RLS 업데이트 (하드코딩된 'admin' 제거)
DROP POLICY IF EXISTS "Admins can manage service types" ON public.service_types;
DROP POLICY IF EXISTS "Manage service types" ON public.service_types;

CREATE POLICY "Manage service types" ON public.service_types
FOR ALL TO authenticated
USING (public.check_is_admin());

-- 4. clients RLS 업데이트 (콜센터 및 현장 역할 반영)
DROP POLICY IF EXISTS "Admins and Editors can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Manage clients" ON public.clients;

CREATE POLICY "Manage clients" ON public.clients FOR ALL TO authenticated 
USING (
  public.check_is_admin() OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('callcenter', 'field'))
);

-- 5. service_records RLS 업데이트 (콜센터 및 현장 역할 반영)
DROP POLICY IF EXISTS "Admins and Editors can manage records" ON public.service_records;
DROP POLICY IF EXISTS "Manage records" ON public.service_records;

CREATE POLICY "Manage records" ON public.service_records FOR ALL TO authenticated 
USING (
  public.check_is_admin() OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('callcenter', 'field'))
);

-- 6. client_groups RLS 업데이트 (이미 check_is_admin을 사용하므로 함수 업데이트로 해결됨)
DROP POLICY IF EXISTS "Admins have full access" ON public.client_groups;
DROP POLICY IF EXISTS "Manage groups" ON public.client_groups;
CREATE POLICY "Manage groups" ON public.client_groups FOR ALL TO authenticated 
USING (public.check_is_admin());
