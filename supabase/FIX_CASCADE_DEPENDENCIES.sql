-- ==========================================
-- CASCADE 삭제 의존성 수정 및 참조 데이터 보존
-- ==========================================
-- 이 스크립트는 부모 레코드가 삭제되어도 자식 레코드가 유지되도록 합니다.
-- 삭제된 레코드의 이름/정보를 보존하기 위해 텍스트 컬럼을 추가합니다.

-- ==========================================
-- 1. service_records 테이블 수정 (거래처 삭제 시 기록 보존)
-- ==========================================

-- 1-1. 거래처 이름 저장 컬럼 추가
ALTER TABLE public.service_records 
ADD COLUMN IF NOT EXISTS client_name TEXT;

-- 1-2. 기존 기록에 거래처 이름 채우기
UPDATE public.service_records sr
SET client_name = c.name
FROM public.clients c
WHERE sr.client_id = c.id AND sr.client_name IS NULL;

-- 1-3. 기사 이름 저장 컬럼 추가
ALTER TABLE public.service_records 
ADD COLUMN IF NOT EXISTS technician_name TEXT;

-- 1-4. 기존 기록에 기사 이름 채우기
UPDATE public.service_records sr
SET technician_name = p.display_name
FROM public.profiles p
WHERE sr.technician_id = p.id AND sr.technician_name IS NULL;

-- 1-5. client_id 외래키 CASCADE -> SET NULL 변경
ALTER TABLE public.service_records 
DROP CONSTRAINT IF EXISTS service_records_client_id_fkey;

ALTER TABLE public.service_records 
ADD CONSTRAINT service_records_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- 1-6. technician_id 외래키 CASCADE -> SET NULL 변경 (이미 SET NULL일 수 있음)
ALTER TABLE public.service_records 
DROP CONSTRAINT IF EXISTS service_records_technician_id_fkey;

ALTER TABLE public.service_records 
ADD CONSTRAINT service_records_technician_id_fkey 
FOREIGN KEY (technician_id) REFERENCES auth.users(id) ON DELETE SET NULL;


-- ==========================================
-- 2. clients 테이블 수정 (그룹 삭제 시 거래처 보존)
-- ==========================================

-- 2-1. 그룹 이름 저장 컬럼 추가
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS group_name TEXT;

-- 2-2. 기존 거래처에 그룹 이름 채우기
UPDATE public.clients c
SET group_name = cg.name
FROM public.client_groups cg
WHERE c.group_id = cg.id AND c.group_name IS NULL;

-- 2-3. group_id 외래키 SET NULL로 변경
ALTER TABLE public.clients 
DROP CONSTRAINT IF EXISTS clients_group_id_fkey;

ALTER TABLE public.clients 
ADD CONSTRAINT clients_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES client_groups(id) ON DELETE SET NULL;


-- ==========================================
-- 3. notices 테이블 수정 (작성자 삭제 시 공지 보존)
-- ==========================================

-- 3-1. 작성자 이름 저장 컬럼 추가
ALTER TABLE public.notices 
ADD COLUMN IF NOT EXISTS author_name TEXT;

-- 3-2. 기존 공지에 작성자 이름 채우기
UPDATE public.notices n
SET author_name = p.display_name
FROM public.profiles p
WHERE n.author_id = p.id AND n.author_name IS NULL;

-- 3-3. author_id 외래키 CASCADE -> SET NULL 변경
ALTER TABLE public.notices 
DROP CONSTRAINT IF EXISTS notices_author_id_fkey;

ALTER TABLE public.notices 
ADD CONSTRAINT notices_author_id_fkey 
FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ==========================================
-- 4. activity_logs 테이블 (이미 SET NULL이므로 확인만)
-- ==========================================
-- activity_logs.user_id는 이미 ON DELETE SET NULL로 설정됨
-- user_email, user_display_name 컬럼도 이미 존재하여 사용자 삭제 후에도 정보 유지


-- ==========================================
-- 5. 데이터 보존을 위한 트리거 함수 (삭제 전 이름 자동 저장)
-- ==========================================

-- 5-1. 거래처 삭제 전 service_records에 이름 저장
CREATE OR REPLACE FUNCTION public.preserve_client_name_before_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.service_records 
    SET client_name = OLD.name 
    WHERE client_id = OLD.id AND client_name IS NULL;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS preserve_client_name ON public.clients;
CREATE TRIGGER preserve_client_name
    BEFORE DELETE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.preserve_client_name_before_delete();

-- 5-2. 그룹 삭제 전 clients에 이름 저장
CREATE OR REPLACE FUNCTION public.preserve_group_name_before_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.clients 
    SET group_name = OLD.name 
    WHERE group_id = OLD.id AND group_name IS NULL;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS preserve_group_name ON public.client_groups;
CREATE TRIGGER preserve_group_name
    BEFORE DELETE ON public.client_groups
    FOR EACH ROW EXECUTE FUNCTION public.preserve_group_name_before_delete();

-- 5-3. 사용자/프로필 삭제 전 관련 기록에 이름 저장
CREATE OR REPLACE FUNCTION public.preserve_user_name_before_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- 서비스 기록에 기사 이름 저장
    UPDATE public.service_records 
    SET technician_name = OLD.display_name 
    WHERE technician_id = OLD.id AND technician_name IS NULL;
    
    -- 공지사항에 작성자 이름 저장
    UPDATE public.notices 
    SET author_name = OLD.display_name 
    WHERE author_id = OLD.id AND author_name IS NULL;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS preserve_user_name ON public.profiles;
CREATE TRIGGER preserve_user_name
    BEFORE DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.preserve_user_name_before_delete();


-- ==========================================
-- 6. 새 레코드 생성 시 이름 자동 저장 트리거
-- ==========================================

-- 6-1. 서비스 기록 생성/수정 시 거래처 및 기사 이름 자동 저장
CREATE OR REPLACE FUNCTION public.auto_fill_record_names()
RETURNS TRIGGER AS $$
BEGIN
    -- 거래처 이름 저장
    IF NEW.client_id IS NOT NULL AND NEW.client_name IS NULL THEN
        SELECT name INTO NEW.client_name FROM public.clients WHERE id = NEW.client_id;
    END IF;
    
    -- 기사 이름 저장
    IF NEW.technician_id IS NOT NULL AND NEW.technician_name IS NULL THEN
        SELECT display_name INTO NEW.technician_name FROM public.profiles WHERE id = NEW.technician_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_fill_record_names ON public.service_records;
CREATE TRIGGER auto_fill_record_names
    BEFORE INSERT OR UPDATE ON public.service_records
    FOR EACH ROW EXECUTE FUNCTION public.auto_fill_record_names();

-- 6-2. 거래처 생성/수정 시 그룹 이름 자동 저장
CREATE OR REPLACE FUNCTION public.auto_fill_client_group_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.group_id IS NOT NULL AND NEW.group_name IS NULL THEN
        SELECT name INTO NEW.group_name FROM public.client_groups WHERE id = NEW.group_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_fill_client_group_name ON public.clients;
CREATE TRIGGER auto_fill_client_group_name
    BEFORE INSERT OR UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.auto_fill_client_group_name();

-- 6-3. 공지사항 생성/수정 시 작성자 이름 자동 저장
CREATE OR REPLACE FUNCTION public.auto_fill_notice_author_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.author_id IS NOT NULL AND NEW.author_name IS NULL THEN
        SELECT display_name INTO NEW.author_name FROM public.profiles WHERE id = NEW.author_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_fill_notice_author_name ON public.notices;
CREATE TRIGGER auto_fill_notice_author_name
    BEFORE INSERT OR UPDATE ON public.notices
    FOR EACH ROW EXECUTE FUNCTION public.auto_fill_notice_author_name();


-- ==========================================
-- 완료 메시지
-- ==========================================
-- 이 스크립트 실행 후:
-- 1. 거래처 삭제 시 서비스 기록은 보존됨 (client_name에 이름 저장)
-- 2. 그룹 삭제 시 거래처는 보존됨 (group_name에 이름 저장)
-- 3. 사용자 삭제 시 서비스 기록/공지는 보존됨 (technician_name, author_name에 이름 저장)
-- 4. 새로운 레코드 생성 시 자동으로 이름이 저장됨
