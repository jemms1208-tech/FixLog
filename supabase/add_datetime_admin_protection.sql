-- ============================================================
-- service_records 날짜시간 컬럼 관리자 전용 보호 트리거
-- 일반 사용자(admin/operator 외)는 reception_at/started_at/processed_at을
-- 임의로 지정할 수 없고, 서버 시각(now())/기존값으로 강제된다.
-- 관리자(admin/operator)는 자유롭게 지정 가능.
-- check_is_admin()은 기존 정의(role IN ('admin','operator'))를 사용.
-- 배포: Supabase 대시보드 SQL Editor에서 수동 실행.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_record_datetime_protection()
RETURNS TRIGGER AS $$
BEGIN
    -- 관리자급은 보낸 값 그대로 존중
    IF public.check_is_admin() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.reception_at := now();
        IF NEW.started_at IS NOT NULL THEN
            NEW.started_at := now();
        END IF;
        IF NEW.processed_at IS NOT NULL THEN
            NEW.processed_at := now();
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        -- 접수일시는 변경 금지
        NEW.reception_at := OLD.reception_at;

        -- 1차처리 시각: NULL->값(최초)이면 now(), 값->다른값(변경)이면 무시, 값->NULL(되돌리기)은 허용
        IF OLD.started_at IS NULL AND NEW.started_at IS NOT NULL THEN
            NEW.started_at := now();
        ELSIF OLD.started_at IS NOT NULL
              AND NEW.started_at IS NOT NULL
              AND NEW.started_at <> OLD.started_at THEN
            NEW.started_at := OLD.started_at;
        END IF;

        -- 완료 시각: started_at과 동일 규칙
        IF OLD.processed_at IS NULL AND NEW.processed_at IS NOT NULL THEN
            NEW.processed_at := now();
        ELSIF OLD.processed_at IS NOT NULL
              AND NEW.processed_at IS NOT NULL
              AND NEW.processed_at <> OLD.processed_at THEN
            NEW.processed_at := OLD.processed_at;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_record_datetime ON public.service_records;
CREATE TRIGGER trg_enforce_record_datetime
    BEFORE INSERT OR UPDATE ON public.service_records
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_record_datetime_protection();
