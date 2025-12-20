-- operator와 admin 역할 모두 profiles 전체 조회/관리 가능하도록 RLS 업데이트

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- 새 정책 생성: operator와 admin 역할 모두 전체 profiles 관리 가능
CREATE POLICY "Operators and Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('operator', 'admin')
  )
);
