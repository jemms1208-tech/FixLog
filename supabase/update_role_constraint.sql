-- 기존 role check constraint 삭제 후 새로운 역할로 재생성
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('operator', 'admin', 'callcenter', 'field'));

-- 기존 역할을 새 역할로 변환 (필요시)
-- UPDATE public.profiles SET role = 'callcenter' WHERE role = 'editor';
-- UPDATE public.profiles SET role = 'field' WHERE role = 'viewer';
