-- profiles 테이블에 phone, team_name 컬럼 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_name TEXT;
