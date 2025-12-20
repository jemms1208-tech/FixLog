-- 1. profiles 테이블에 RLS 정책 추가 (로그인한 유저가 자신의 프로필을 읽을 수 있도록)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
    ) THEN
        CREATE POLICY "Users can view own profile" 
        ON public.profiles 
        FOR SELECT 
        TO authenticated 
        USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Admins can manage all profiles'
    ) THEN
        CREATE POLICY "Admins can manage all profiles"
        ON public.profiles
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        );
    END IF;

    -- clients 테이블: 모든 인증된 사용자 읽기 가능, 관리자/편집자 수정 가능
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'Everyone can view clients') THEN
        CREATE POLICY "Everyone can view clients" ON public.clients FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'Admins and Editors can manage clients') THEN
        CREATE POLICY "Admins and Editors can manage clients" ON public.clients FOR ALL TO authenticated 
        USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));
    END IF;

    -- service_records 테이블: 모든 인증된 사용자 읽기 가능, 관리자/편집자 수정 가능
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_records' AND policyname = 'Everyone can view records') THEN
        CREATE POLICY "Everyone can view records" ON public.service_records FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_records' AND policyname = 'Admins and Editors can manage records') THEN
        CREATE POLICY "Admins and Editors can manage records" ON public.service_records FOR ALL TO authenticated 
        USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'editor')));
    END IF;
END $$;

-- 2. 기존 auth.users 중 profiles에 데이터가 없는 유저들을 위해 데이터 생성 (Legacy users sync)
INSERT INTO public.profiles (id, email, username, role, is_approved)
SELECT id, email, split_part(email, '@', 1), 'viewer', FALSE
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 3. 컬럼 보정 (Failsafe)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
