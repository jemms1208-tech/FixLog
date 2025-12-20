-- service_records 테이블에 status 컬럼 추가
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed'));

-- 기존 데이터 마이그레이션 (processed_at이 있으면 completed, 없으면 pending)
UPDATE public.service_records 
SET status = CASE 
    WHEN processed_at IS NOT NULL THEN 'completed' 
    ELSE 'pending' 
END
WHERE status = 'pending';
