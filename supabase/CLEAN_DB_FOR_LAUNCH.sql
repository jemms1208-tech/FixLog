/*
 * [출시 준비] 데이터 초기화 스크립트 (Role 기반 보존)
 * 
 * 주의: 이 스크립트를 실행하면 되돌릴 수 없습니다.
 * 실행 전 백업을 권장합니다.
 */

-- 1. 모든 비즈니스 데이터 삭제
TRUNCATE TABLE activity_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE service_records RESTART IDENTITY CASCADE;
TRUNCATE TABLE clients RESTART IDENTITY CASCADE;
TRUNCATE TABLE client_groups RESTART IDENTITY CASCADE;
TRUNCATE TABLE notices RESTART IDENTITY CASCADE;

-- 2. 사용자 계정 정리 (운영자 및 관리자 보존)
-- 이메일을 일일이 지정하지 않아도, profiles 테이블에 설정된 역할(role)을 기준으로 삭제합니다.
-- role이 'admin' 또는 'operator'인 사용자는 삭제되지 않습니다.

DELETE FROM auth.users 
WHERE id NOT IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'operator')
);

-- 참고: 만약 특정 이메일('oper' 등)을 가진 계정을 확인하고 싶다면 아래 쿼리를 먼저 실행해보세요.
-- SELECT u.email, p.role FROM auth.users u JOIN public.profiles p ON u.id = p.id;

-- 3. 결과 확인
SELECT count(*) as remaining_users FROM auth.users;
SELECT count(*) as remaining_clients FROM clients;
