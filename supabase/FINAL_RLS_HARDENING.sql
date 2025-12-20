-- ==========================================
-- FixLog RLS 보안 강화 (Final Security Hardening)
-- ==========================================

-- 1. [clients] 테이블 권한 세분화
-- 기존: Manage clients (FOR ALL) -> 모든 권한 허용
-- 변경: 조회는 그룹원 전체, 관리(추가/수정/삭제)는 운영자/관리자만

DROP POLICY IF EXISTS "Manage clients" ON public.clients;
DROP POLICY IF EXISTS "View clients" ON public.clients;
DROP POLICY IF EXISTS "Admin manage clients" ON public.clients;

-- 조회: 그룹 접근이 가능한 모든 승인된 사용자
CREATE POLICY "View clients" ON public.clients FOR SELECT TO authenticated 
USING (public.check_group_access(group_id));

-- 관리: 운영자 및 관리자만 (INSERT, UPDATE, DELETE)
CREATE POLICY "Admin manage clients" ON public.clients FOR ALL TO authenticated 
USING (public.check_is_admin());


-- 2. [service_records] 테이블 권한 세분화
-- 기존: Manage records (FOR ALL)
-- 변경: 삭제는 관리자만, 추가/수정은 현장/콜센터 포함

DROP POLICY IF EXISTS "Manage records" ON public.service_records;
DROP POLICY IF EXISTS "View records" ON public.service_records;
DROP POLICY IF EXISTS "Insert records" ON public.service_records;
DROP POLICY IF EXISTS "Update records" ON public.service_records;
DROP POLICY IF EXISTS "Delete records" ON public.service_records;
DROP POLICY IF EXISTS "Insert/Update records" ON public.service_records; -- 이전 오타 정책 삭제용

-- 조회: 자신이 속한 그룹의 클라이언트 레코드만
CREATE POLICY "View records" ON public.service_records FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.clients c 
        WHERE c.id = service_records.client_id 
        AND public.check_group_access(c.group_id)
    )
);

-- 추가: 승인된 모든 사용자 (자신이 접근 가능한 그룹의 것만)
CREATE POLICY "Insert records" ON public.service_records FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.clients c 
        WHERE c.id = service_records.client_id 
        AND public.check_group_access(c.group_id)
    )
);

-- 수정: 승인된 모든 사용자
CREATE POLICY "Update records" ON public.service_records FOR UPDATE TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.clients c 
        WHERE c.id = service_records.client_id 
        AND public.check_group_access(c.group_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.clients c 
        WHERE c.id = service_records.client_id 
        AND public.check_group_access(c.group_id)
    )
);

-- 삭제: 운영자 및 관리자만
CREATE POLICY "Delete records" ON public.service_records FOR DELETE TO authenticated 
USING (public.check_is_admin());


-- 3. [notices] 테이블 권한 점검
-- 이미 Author 체크가 되어있을 수 있으나 명확히 설정
DROP POLICY IF EXISTS "Anyone can view notices" ON public.notices;
CREATE POLICY "View notices" ON public.notices FOR SELECT TO authenticated 
USING (
    (allowed_roles IS NULL) OR 
    (allowed_roles = '{}') OR 
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = ANY(notices.allowed_roles) OR role IN ('operator', 'admin'))))
);

DROP POLICY IF EXISTS "Admins can manage notices" ON public.notices;
CREATE POLICY "Manage notices" ON public.notices FOR ALL TO authenticated 
USING (public.check_is_admin());


-- 4. [profiles] 보안 강화
-- 관리자는 본인을 제외한 타인의 Role을 수정할 수 있지만, Operator 수준으로 올리는 것은 Operator만 가능하도록 로직 보강 가능 (SQL 수준)
-- 현재는 check_is_admin()이 operator/admin 통합이라 UI에서 제어 중. 
-- 더 강력한 보호를 위해 update 정책에 check를 넣을 수도 있음.
