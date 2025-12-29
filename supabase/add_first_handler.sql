-- 1차 처리자와 완료 담당자를 구분하기 위해 first_handler_id 컬럼 추가
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS first_handler_id UUID REFERENCES profiles(id);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_service_records_first_handler_id ON service_records(first_handler_id);

-- 코멘트 추가
COMMENT ON COLUMN service_records.first_handler_id IS '1차 처리 담당자 ID';
COMMENT ON COLUMN service_records.handler_id IS '최종 완료 담당자 ID';
