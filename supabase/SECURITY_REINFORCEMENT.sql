-- ==========================================
-- FixLog RLS 정책 총괄 점검 및 보정 (Security Audit Fix)
-- ==========================================

-- 1. 유틸리티 함수: 그룹 접근 권한 체크
-- 관지라(operator, admin)는 모든 그룹 접근 가능
-- 일반 유저(callcenter, field)는 allowed_groups에 포함된 그룹만 접근 가능 (비어있으면 전체 접근)
CREATE OR REPLACE FUNCTION public.check_group_access(target_group_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_allowed_groups UUID[];
    is_approved_user BOOLEAN;
BEGIN
    SELECT role, allowed_groups, is_approved INTO user_role, user_allowed_groups, is_approved_user
    FROM public.profiles WHERE id = auth.uid();

    -- 승인되지 않은 유저는 모든 접근 거부
    IF is_approved_user IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    -- 운영자/관리자는 무조건 허용
    IF user_role IN ('operator', 'admin') THEN
        RETURN TRUE;
    END IF;

    -- 일반 유저는 그룹 체크
    -- 1. 타겟 그룹이 없거나(NULL), 2. 유저의 허용 그룹이 비어있거나(전체 허용), 3. 허용 그룹에 포함된 경우
    RETURN (
        target_group_id IS NULL OR 
        user_allowed_groups IS NULL OR 
        cardinality(user_allowed_groups) = 0 OR 
        target_group_id = ANY(user_allowed_groups)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 서비스 기능별 정책 재설정
-- [profiles] 유저는 본인 것만 선택 가능, 관리자는 전체 관리
DROP POLICY IF EXISTS "Manage all profiles" ON public.profiles;
CREATE POLICY "Manage all profiles" ON public.profiles FOR ALL TO authenticated 
USING (public.check_is_admin());

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated 
USING (auth.uid() = id);

-- [clients] 그룹 권한에 따른 조회 및 관리
DROP POLICY IF EXISTS "Manage clients" ON public.clients;
CREATE POLICY "Manage clients" ON public.clients FOR ALL TO authenticated 
USING (public.check_group_access(group_id));

-- [service_records] 클라이언트의 그룹 권한에 따른 조회 및 관리
DROP POLICY IF EXISTS "Manage records" ON public.service_records;
CREATE POLICY "Manage records" ON public.service_records FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.clients c 
        WHERE c.id = service_records.client_id 
        AND public.check_group_access(c.group_id)
    )
);

-- [client_groups] 관리자만 관리 가능, 일반 유저는 조회만 가능 (자신이 속한 그룹만)
DROP POLICY IF EXISTS "Manage groups" ON public.client_groups;
CREATE POLICY "Select groups" ON public.client_groups FOR SELECT TO authenticated 
USING (public.check_group_access(id));

CREATE POLICY "Admin manage groups" ON public.client_groups FOR INSERT, UPDATE, DELETE TO authenticated 
USING (public.check_is_admin());

-- 3. 승인되지 않은 유저의 접근 통제를 위한 전역 필터 (Profiles)
-- profiles 테이블 자체의 SELECT 정책 강화
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles 
FOR SELECT TO authenticated 
USING (
    auth.uid() = id OR 
    (SELECT is_approved FROM public.profiles WHERE id = auth.uid()) = TRUE
);
