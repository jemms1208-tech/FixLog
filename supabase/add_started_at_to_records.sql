-- service_records 테이블에 started_at 컬럼 추가
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- 기존 데이터 마이그레이션 (status가 processing이거나 completed이면 reception_at을 기준으로 혹은 임의 시간으로 설정 가능)
-- 여기서는 단순히 컬럼만 추가합니다.
