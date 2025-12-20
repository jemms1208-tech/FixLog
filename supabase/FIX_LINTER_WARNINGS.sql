-- Supabase 보안 린터 경고 해결을 위한 스크립트 (Function Search Path Mutable)

-- 모든 SECURITY DEFINER 함수에 'SET search_path = public'을 추가하여 
-- 의도치 않은 스키마 개체 참조(Schema Hijacking)를 방지합니다.

-- 1. check_is_admin 함수 수정
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'operator')
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 2. check_group_access 함수 수정
CREATE OR REPLACE FUNCTION public.check_group_access(target_group_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_allowed_groups UUID[];
    is_approved_user BOOLEAN;
BEGIN
    SELECT role, allowed_groups, is_approved INTO user_role, user_allowed_groups, is_approved_user
    FROM public.profiles WHERE id = auth.uid();

    IF is_approved_user IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    IF user_role IN ('operator', 'admin') THEN
        RETURN TRUE;
    END IF;

    RETURN (
        target_group_id IS NULL OR 
        user_allowed_groups IS NULL OR 
        cardinality(user_allowed_groups) = 0 OR 
        target_group_id = ANY(user_allowed_groups)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. handle_new_user 함수 수정
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role, is_approved)
  VALUES (
    new.id, 
    new.email, 
    split_part(new.email, '@', 1), 
    'viewer', 
    FALSE
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. update_updated_at_column 함수 수정
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. log_activity 함수 수정
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. 트리거 함수들 수정
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
