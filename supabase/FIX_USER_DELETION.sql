-- 사용자 삭제(Auth) 시 발생하는 외래 키 제약 조건 오류 해결을 위한 스크립트

-- 1. profiles 테이블의 id 외래 키에 ON DELETE CASCADE 추가
-- (auth.users에서 삭제되면 대응하는 profiles 행도 자동 삭제됨)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey,
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- 2. service_records 테이블의 technician_id 외래 키에 ON DELETE SET NULL 추가
-- (담당 직원이 삭제되어도 서비스 기록 데이터는 보존하되, 담당자만 공란으로 변경)
ALTER TABLE public.service_records
DROP CONSTRAINT IF EXISTS service_records_technician_id_fkey,
ADD CONSTRAINT service_records_technician_id_fkey 
FOREIGN KEY (technician_id) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- 3. (추가) activity_logs 테이블 확인 (이미 반영되어 있을 수 있지만 확실히 적용)
ALTER TABLE public.activity_logs
DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey,
ADD CONSTRAINT activity_logs_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;
