-- 1. profiles 테이블에 승인 여부 및 사용자 ID(username) 컬럼 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. 신규 유저 가입 시 자동으로 profiles 테이블에 데이터 생성하는 트리거 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role, is_approved)
  VALUES (
    new.id, 
    new.email, 
    split_part(new.email, '@', 1), -- email에서 @ 앞부분을 username으로 사용
    'viewer', 
    FALSE
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 호환성을 위해 기존 트리거 삭제 (있다면)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 4. 트리거 생성
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- [ADMIN ONLY] 기존에 이미 생성된 1번 유저(관리자)를 승인 처리 하려면 아래 주석을 풀고 실행하세요.
-- UPDATE public.profiles SET is_approved = TRUE, role = 'admin' WHERE email = '관리자이메일@example.com';
