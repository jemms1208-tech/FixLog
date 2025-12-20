-- ==========================================
-- 회원가입 오류 수정 및 프로필 구조 현대화
-- ==========================================

-- 1. 기존 제약 조건 제거 (역할 제약 조건 등)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. 새로운 역할 체계로 제약 조건 업데이트
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('operator', 'admin', 'callcenter', 'field'));

-- 3. 부족한 컬럼 추가 (Failsafe)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 4. 트리거 함수 업데이트: 새로운 역할('field') 및 display_name 반영
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_name TEXT;
BEGIN
    default_name := split_part(new.email, '@', 1);
    
    INSERT INTO public.profiles (
        id, 
        email, 
        username, 
        display_name, 
        role, 
        is_approved, 
        allowed_groups
    )
    VALUES (
        new.id, 
        new.email, 
        default_name, 
        default_name, -- 초기 표시 이름은 이메일 앞부분
        'field',     -- 'viewer' 대신 'field'를 기본값으로 사용
        FALSE,       -- 승인 대기 상태
        '{}'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 기존에 'viewer' 또는 'editor'로 되어있는 유저들 마이그레이션 (필요시)
UPDATE public.profiles SET role = 'field' WHERE role = 'viewer';
UPDATE public.profiles SET role = 'callcenter' WHERE role = 'editor';
