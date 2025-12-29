-- ==========================================
-- 담당자/접수자 이름 표시 오류 수정 (Participant Visibility Fix)
-- 현장(field), 콜센터(callcenter) 등급에서도 타 유저의 이름을 볼 수 있도록 허용
-- ==========================================

-- 1. 유저의 승인 여부를 체크하는 보안 함수 (Recursion 방지)
CREATE OR REPLACE FUNCTION public.check_is_approved()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND is_approved = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. profiles 테이블 RLS 정책 업데이트
-- 기존 SELECT 정책들 정리
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Approved staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Approved users can view all profiles" ON public.profiles;

-- 새로운 SELECT 정책: 승인된 사용자라면 모든 프로필의 기본 정보(이름, 역할 등) 조회 가능
CREATE POLICY "Approved users can view all profiles for selection"
ON public.profiles
FOR SELECT 
TO authenticated 
USING (
    auth.uid() = id OR -- 본인 프로필
    public.check_is_approved() OR -- 승인된 모든 스태프
    public.check_is_admin() -- 관리자
);

-- 3. (참고) 현재 모든 스태프를 승인 상태로 전환 (필요한 경우에만 실행)
-- UPDATE public.profiles SET is_approved = TRUE WHERE role IN ('field', 'callcenter', 'operator', 'admin') AND is_approved = FALSE;

COMMENT ON POLICY "Approved users can view all profiles for selection" ON public.profiles IS 'Allows staff to see names of other staff to display participants in records.';
