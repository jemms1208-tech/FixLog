-- 공지사항 테이블에 allowed_groups 컬럼 추가
-- 빈 배열 = 전체 그룹에게 공개

ALTER TABLE public.notices 
ADD COLUMN IF NOT EXISTS allowed_groups UUID[] DEFAULT '{}';

-- ============================================
-- 충돌하는 기존 RLS 정책들 삭제
-- ============================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.notices;
DROP POLICY IF EXISTS "View notices" ON public.notices;
DROP POLICY IF EXISTS "Users can view allowed notices" ON public.notices;

-- ============================================
-- 통합된 조회 정책 생성
-- ============================================
-- 조회 정책: 
-- 1. 관리자/운영자(admin, operator)는 모든 공지 조회 가능 (그룹 무시)
-- 2. 작성자 본인은 조회 가능
-- 3. 일반 사용자(callcenter, field)는:
--    - 자신의 역할이 allowed_roles에 포함되어야 함
--    - 그리고 그룹 조건:
--      * allowed_groups가 비어있으면 → 전체 공개 (OK)
--      * allowed_groups가 설정되어 있으면 → 사용자의 그룹과 교집합 있어야 함
CREATE POLICY "Users can view allowed notices" ON public.notices
FOR SELECT TO authenticated
USING (
  -- 관리자/운영자는 모든 공지 조회 (그룹 제한 무시)
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'operator')
  OR 
  -- 작성자 본인
  author_id = auth.uid() 
  OR
  (
    -- 역할 체크: 사용자의 역할이 allowed_roles에 포함
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = ANY(allowed_roles)
    AND
    -- 그룹 체크: allowed_groups가 비어있거나, 사용자 그룹과 겹쳐야 함
    (
      -- 공지가 전체 그룹 대상 (빈 배열이면 그룹 제한 없음)
      (allowed_groups IS NULL OR cardinality(allowed_groups) = 0)
      OR
      -- 사용자의 그룹과 공지의 그룹이 겹침 (&& 연산자: 배열 교집합 확인)
      ((SELECT COALESCE(allowed_groups, '{}') FROM public.profiles WHERE id = auth.uid()) && allowed_groups)
    )
  )
);

COMMENT ON COLUMN public.notices.allowed_groups IS 'Allowed group IDs. Empty array means visible to all groups. When set, only users in these groups can see (except admin/operator).';
