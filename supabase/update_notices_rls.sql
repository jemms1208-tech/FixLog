-- 공지사항 관리 RLS 정책 고도화
-- 운영자가 작성한 글은 관리자가 수정/삭제할 수 없도록 제한

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Managers can manage notices" ON public.notices;

-- 1. 생성 정책: 운영자(operator)와 관리자(admin) 모두 가능
CREATE POLICY "Managers can insert notices" ON public.notices
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'operator' OR role = 'admin')
  )
);

-- 2. 수정/삭제 정책: 
-- 운영자는 모든 글 관리 가능
-- 관리자는 본인의 글이거나, 다른 관리자의 글만 가능 (운영자 글 제외)
CREATE POLICY "Managers can update/delete notices" ON public.notices
FOR ALL TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'operator' OR
  (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' AND
    (SELECT role FROM public.profiles WHERE id = author_id) != 'operator'
  )
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'operator' OR
  (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' AND
    (SELECT role FROM public.profiles WHERE id = author_id) != 'operator'
  )
);
