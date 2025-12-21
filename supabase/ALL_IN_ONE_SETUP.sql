-- ==========================================
-- FixLog 전체 DB 초기화 및 설정 (Full Setup)
-- ==========================================

-- 1. 기존 테이블 정리 (필요시 사용, 주의!)
-- DROP TABLE IF EXISTS public.service_records;
-- DROP TABLE IF EXISTS public.clients;
-- DROP TABLE IF EXISTS public.profiles;
-- DROP TABLE IF EXISTS public.client_groups;

-- 2. 기본 테이블 생성
CREATE TABLE IF NOT EXISTS public.client_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  email TEXT NOT NULL,
  username TEXT,
  role TEXT CHECK (role IN ('admin', 'editor', 'viewer')) DEFAULT 'viewer',
  is_approved BOOLEAN DEFAULT FALSE,
  allowed_groups UUID[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  biz_reg_no TEXT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  contact_person TEXT,
  van_company TEXT,
  equipment TEXT,
  group_id UUID REFERENCES client_groups(id) ON DELETE SET NULL,
  group_name TEXT -- 그룹 삭제 시에도 이름 보존
);

CREATE TABLE IF NOT EXISTS public.service_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT, -- 거래처 삭제 시에도 이름 보존
  reception_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  type TEXT CHECK (type IN ('신규', '사업자변경', '장애', '용지요청', '메뉴수정', '기타')),
  details TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  result TEXT,
  technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  technician_name TEXT -- 기사 삭제 시에도 이름 보존
);

-- 3. RLS 활성화
ALTER TABLE public.client_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;

-- 5. 비재귀적 권한 체크를 위한 보안 함수 (Security Definier로 RLS 우회)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. RLS 정책 설정 (재수정)
-- Profiles 정책
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL TO authenticated 
USING (public.check_is_admin());

-- Clients 정책
DROP POLICY IF EXISTS "Everyone can view clients" ON public.clients;
CREATE POLICY "Everyone can view clients" ON public.clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and Editors can manage clients" ON public.clients;
CREATE POLICY "Admins and Editors can manage clients" ON public.clients FOR ALL TO authenticated 
USING (
  public.check_is_admin() OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'editor')
);

-- Service Records 정책
DROP POLICY IF EXISTS "Everyone can view records" ON public.service_records;
CREATE POLICY "Everyone can view records" ON public.service_records FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and Editors can manage records" ON public.service_records;
CREATE POLICY "Admins and Editors can manage records" ON public.service_records FOR ALL TO authenticated 
USING (
  public.check_is_admin() OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'editor')
);

-- Client Groups 정책
DROP POLICY IF EXISTS "Admins have full access" ON public.client_groups;
CREATE POLICY "Admins have full access" ON public.client_groups FOR ALL TO authenticated 
USING (public.check_is_admin());

-- 5. 트리거 및 함수 설정 (자동 프로필 생성)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role, is_approved)
  VALUES (
    new.id, 
    new.email, 
    split_part(new.email, '@', 1), 
    'viewer', 
    FALSE
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. 기존 유저 싱크 (Failsafe)
INSERT INTO public.profiles (id, email, username, role, is_approved)
SELECT id, email, split_part(email, '@', 1), 'viewer', FALSE
FROM auth.users
ON CONFLICT (id) DO NOTHING;
