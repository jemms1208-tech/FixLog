-- 담당자 전화번호 컬럼 추가
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_phone TEXT;
