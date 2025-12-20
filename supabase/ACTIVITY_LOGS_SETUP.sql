-- ==========================================
-- FixLog 활동 로그 및 보안 강화 (Activity Logs & Hardening)
-- ==========================================

-- 1. 활동 로그 테이블 생성
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_email TEXT,
    user_display_name TEXT,
    action TEXT NOT NULL, -- e.g., 'CREATE_CLIENT', 'UPDATE_RECORD', 'DELETE_USER', 'PASSWORD_CHANGE'
    target_type TEXT,     -- e.g., 'client', 'record', 'profile'
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT
);

-- RLS 활성화
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 관리자/운영자만 로그 조회 가능
CREATE POLICY "Admins/Operators can view logs" ON public.activity_logs
    FOR SELECT TO authenticated
    USING (public.check_is_admin());

-- 로그 생성은 인증된 사용자 누구나 가능 (서버 액션/트리거용)
CREATE POLICY "Authenticated users can insert logs" ON public.activity_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 2. 활동 기록 함수 (PostgreSQL 레벨에서 편리하게 사용)
CREATE OR REPLACE FUNCTION public.log_activity(
    p_action TEXT,
    p_target_type TEXT,
    p_target_id TEXT,
    p_details JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
DECLARE
    v_user_email TEXT;
    v_user_name TEXT;
BEGIN
    SELECT email, display_name INTO v_user_email, v_user_name
    FROM public.profiles WHERE id = auth.uid();

    INSERT INTO public.activity_logs (
        user_id, user_email, user_display_name, action, target_type, target_id, details
    ) VALUES (
        auth.uid(), v_user_email, v_user_name, p_action, p_target_type, p_target_id, p_details
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. 자동 로그 트리거 (주요 테이블)
-- Clients 테이블 변경 로그
CREATE OR REPLACE FUNCTION public.trig_log_client_changes() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        PERFORM public.log_activity('CREATE_CLIENT', 'client', NEW.id::text, jsonb_build_object('name', NEW.name));
    ELSIF (TG_OP = 'UPDATE') THEN
        PERFORM public.log_activity('UPDATE_CLIENT', 'client', NEW.id::text, jsonb_build_object('name', NEW.name, 'old_name', OLD.name));
    ELSIF (TG_OP = 'DELETE') THEN
        PERFORM public.log_activity('DELETE_CLIENT', 'client', OLD.id::text, jsonb_build_object('name', OLD.name));
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_client_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION public.trig_log_client_changes();

-- Records 테이블 변경 로그
CREATE OR REPLACE FUNCTION public.trig_log_record_changes() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        PERFORM public.log_activity('CREATE_RECORD', 'record', NEW.id::text, jsonb_build_object('type', NEW.type));
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.status != NEW.status) THEN
            PERFORM public.log_activity('STATUS_CHANGE', 'record', NEW.id::text, jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_record_changes
    AFTER INSERT OR UPDATE ON public.service_records
    FOR EACH ROW EXECUTE FUNCTION public.trig_log_record_changes();
