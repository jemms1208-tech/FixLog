-- ==========================================
-- VAN사 및 장비 유형 관리 테이블 생성
-- ==========================================

-- van_companies 테이블 생성
CREATE TABLE IF NOT EXISTS public.van_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0
);

-- 기본 데이터 삽입
INSERT INTO public.van_companies (name, sort_order) VALUES
  ('KSNET', 1),
  ('KICC', 2),
  ('NICE', 3),
  ('SMARTRO', 4),
  ('KIS', 5),
  ('DAOUDATA', 6)
ON CONFLICT (name) DO NOTHING;

-- RLS 활성화
ALTER TABLE public.van_companies ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자 조회 가능
CREATE POLICY "Authenticated users can view van companies" ON public.van_companies
FOR SELECT TO authenticated USING (true);

-- 관리자만 수정 가능
CREATE POLICY "Admins can manage van companies" ON public.van_companies
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
);

-- ==========================================

-- equipment_types 테이블 생성
CREATE TABLE IF NOT EXISTS public.equipment_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0
);

-- 기본 데이터 삽입
INSERT INTO public.equipment_types (name, sort_order) VALUES
  ('POS', 1),
  ('CAT', 2),
  ('KIOSK', 3),
  ('DID', 4),
  ('MONITOR', 5),
  ('PC', 6),
  ('PRINTER', 7)
ON CONFLICT (name) DO NOTHING;

-- RLS 활성화
ALTER TABLE public.equipment_types ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자 조회 가능
CREATE POLICY "Authenticated users can view equipment types" ON public.equipment_types
FOR SELECT TO authenticated USING (true);

-- 관리자만 수정 가능
CREATE POLICY "Admins can manage equipment types" ON public.equipment_types
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'operator'))
);
