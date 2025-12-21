-- 공지사항 테이블 생성
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT, -- 작성자 삭제 시에도 이름 보존
  allowed_roles TEXT[] DEFAULT '{operator,admin,callcenter,field}' -- 기본적으로 전체 공개
);

-- RLS 활성화
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

-- 조회 정책: 
-- 1. 관리자/운영자는 모든 공지 조회 가능
-- 2. 일반 사용자는 자신의 역할이 allowed_roles에 포함된 공지만 조회 가능
DROP POLICY IF EXISTS "Users can view allowed notices" ON public.notices;
CREATE POLICY "Users can view allowed notices" ON public.notices
FOR SELECT TO authenticated
USING (
  public.check_is_admin() OR 
  author_id = auth.uid() OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = ANY(allowed_roles)
);

-- 관리 정책: 관리자/운영자만 생성/수정/삭제 가능
DROP POLICY IF EXISTS "Managers can manage notices" ON public.notices;
CREATE POLICY "Managers can manage notices" ON public.notices
FOR ALL TO authenticated
USING (public.check_is_admin());

-- 트리거로 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notices_updated_at
    BEFORE UPDATE ON notices
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
