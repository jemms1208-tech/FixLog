-- ==========================================
-- 장애 유형 관리 테이블 생성
-- ==========================================

-- service_types 테이블 생성
CREATE TABLE IF NOT EXISTS public.service_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0
);

-- 기본 데이터 삽입
INSERT INTO public.service_types (name, sort_order) VALUES
  ('장애', 1),
  ('서비스', 2),
  ('신규', 3),
  ('사업자변경', 4),
  ('용지요청', 5),
  ('메뉴수정', 6),
  ('기타', 99)
ON CONFLICT (name) DO NOTHING;

-- RLS 활성화
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자 조회 가능
CREATE POLICY "Authenticated users can view service types" ON public.service_types
FOR SELECT TO authenticated USING (true);

-- 관리자만 수정 가능 (profiles에서 role 확인)
CREATE POLICY "Admins can manage service types" ON public.service_types
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- service_records의 type CHECK 제약조건 제거 (유연성 위해)
ALTER TABLE public.service_records DROP CONSTRAINT IF EXISTS service_records_type_check;
