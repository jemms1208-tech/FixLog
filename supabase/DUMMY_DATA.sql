-- 기존 데이터 삭제 (의존성 고려)
DELETE FROM activity_logs;
DELETE FROM service_records;
DELETE FROM clients;

-- 그룹 생성 확인
INSERT INTO client_groups (name) VALUES ('서울'), ('부산'), ('대구'), ('인천'), ('광주')
ON CONFLICT (name) DO NOTHING;

-- 거래처 100개 생성
DO $$
DECLARE
    i INTEGER;
    group_ids UUID[];
    random_group UUID;
    business_types TEXT[] := ARRAY['식당', '카페', '편의점', '마트', '약국', '병원', '미용실', '세탁소', '주유소', '호텔'];
    area_codes TEXT[] := ARRAY['02', '031', '032', '051', '053', '062', '042', '044'];
    van_companies TEXT[] := ARRAY['KIS', 'NICE', 'KSNET', 'KICC', 'SMARTRO', 'JTNet', 'DAOU'];
    equipments TEXT[] := ARRAY['POS단말기', 'CAT단말기', '무선단말기', 'PC-POS', '키오스크', '모바일POS'];
    cities TEXT[] := ARRAY['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종'];
    districts TEXT[] := ARRAY['강남구', '서초구', '마포구', '송파구', '영등포구', '중구', '동구', '서구', '남구', '북구'];
    name_prefixes TEXT[] := ARRAY['행복', '사랑', '희망', '미래', '태양', '달빛', '별빛', '가온', '하늘', '바다'];
BEGIN
    -- 그룹 ID 배열 가져오기
    SELECT ARRAY_AGG(id) INTO group_ids FROM client_groups;
    
    IF group_ids IS NULL THEN
        RAISE NOTICE 'No client_groups found.';
        RETURN;
    END IF;
    
    FOR i IN 1..100 LOOP
        -- 랜덤 그룹 선택 (1-based index)
        random_group := group_ids[1 + floor(random() * array_length(group_ids, 1))::int];
        
        INSERT INTO clients (
            name,
            biz_reg_no,
            phone,
            contact_phone,
            address,
            van_company,
            equipment,
            group_id
        ) VALUES (
            -- 상호명
            business_types[1 + floor(random() * 10)::int] || ' ' || 
            name_prefixes[1 + floor(random() * 10)::int] || 
            (i + floor(random() * 100))::TEXT,
            
            -- 사업자번호
            LPAD((floor(random() * 900) + 100)::TEXT, 3, '0') || '-' ||
            LPAD((floor(random() * 90) + 10)::TEXT, 2, '0') || '-' ||
            LPAD((floor(random() * 90000) + 10000)::TEXT, 5, '0'),
            
            -- 전화번호
            area_codes[1 + floor(random() * 8)::int] || '-' ||
            LPAD((floor(random() * 9000) + 1000)::TEXT, 4, '0') || '-' ||
            LPAD((floor(random() * 9000) + 1000)::TEXT, 4, '0'),

            -- 담당자 연락처 (010-XXXX-XXXX)
            '010-' || LPAD((floor(random() * 9000) + 1000)::TEXT, 4, '0') || '-' ||
            LPAD((floor(random() * 9000) + 1000)::TEXT, 4, '0'),
            
            -- 주소
            cities[1 + floor(random() * 8)::int] || ' ' ||
            districts[1 + floor(random() * 10)::int] || ' ' ||
            (ARRAY['대로', '로', '길'])[1 + floor(random() * 3)::int] || ' ' ||
            (floor(random() * 500) + 1)::TEXT || '번길 ' ||
            (floor(random() * 50) + 1)::TEXT,
            
            -- VAN사
            van_companies[1 + floor(random() * 7)::int],
            
            -- 장비
            equipments[1 + floor(random() * 6)::int],
            
            random_group
        );
    END LOOP;
    RAISE NOTICE 'Created 100 clients with contact_phone.';
END $$;

-- 접수 내역 100개 생성
DO $$
DECLARE
    i INTEGER;
    client_ids UUID[];
    random_client UUID;
    record_types TEXT[] := ARRAY['장애', '기타'];
    statuses TEXT[] := ARRAY['pending', 'processing', 'completed'];
    random_status TEXT;
    random_reception TIMESTAMP WITH TIME ZONE;
    random_started TIMESTAMP WITH TIME ZONE;
    random_processed TIMESTAMP WITH TIME ZONE;
    random_result TEXT;
    
    detail_templates TEXT[] := ARRAY[
        '단말기 전원이 켜지지 않습니다',
        '카드 결제가 되지 않습니다',
        '영수증 출력 오류가 발생합니다',
        '화면이 깜빡거립니다',
        '네트워크 연결 오류',
        '프린터 용지 걸림',
        '버튼 반응이 없습니다',
        '결제 취소가 되지 않습니다',
        '매출 조회 오류',
        'POS 프로그램 오류'
    ];
    
    processing_results TEXT[] := ARRAY[
        '원격 접속 시도 중',
        '담당자 통화 연결 중',
        '로그 분석 중입니다',
        '현장 기사 배정 대기',
        '증상 재확인 요청'
    ];
    
    completed_results TEXT[] := ARRAY[
        '전원 케이블 교체로 해결',
        '단말기 재부팅으로 정상화',
        '펌웨어 업데이트 완료',
        '부품 교체 완료',
        '네트워크 설정 수정',
        '프린터 청소 및 정비',
        '소프트웨어 재설치',
        '원격 점검으로 해결'
    ];
BEGIN
    SELECT ARRAY_AGG(id) INTO client_ids FROM clients;
    IF client_ids IS NULL THEN RAISE NOTICE 'No clients found.'; RETURN; END IF;
    
    FOR i IN 1..100 LOOP
        random_client := client_ids[1 + floor(random() * array_length(client_ids, 1))::int];
        random_status := statuses[1 + floor(random() * 3)::int];
        random_reception := NOW() - (floor(random() * 30)::int || ' days')::INTERVAL - (floor(random() * 24)::int || ' hours')::INTERVAL;
        
        -- 상태별 일시 및 결과 설정
        IF random_status = 'pending' THEN
            random_started := NULL;
            random_processed := NULL;
            random_result := NULL;
        ELSIF random_status = 'processing' THEN
            random_started := random_reception + (floor(random() * 60) + 10 || ' minutes')::INTERVAL;
            random_processed := NULL;
            random_result := processing_results[1 + floor(random() * 5)::int];
        ELSE -- completed
            random_started := random_reception + (floor(random() * 60) + 10 || ' minutes')::INTERVAL;
            random_processed := random_started + (floor(random() * 120) + 30 || ' minutes')::INTERVAL;
            random_result := completed_results[1 + floor(random() * 8)::int];
        END IF;
        
        INSERT INTO service_records (
            client_id,
            type,
            details,
            status,
            reception_at,
            started_at,
            processed_at,
            result
        ) VALUES (
            random_client,
            record_types[1 + floor(random() * 2)::int],
            detail_templates[1 + floor(random() * 10)::int] || CASE WHEN floor(random()*2)=0 THEN ' - 빠른 처리 부탁드립니다.' ELSE '' END,
            random_status,
            random_reception,
            random_started,
            random_processed,
            random_result
        );
    END LOOP;
    
    RAISE NOTICE 'Created 100 service records.';
END $$;

SELECT 'clients: ' || COUNT(*) FROM clients
UNION ALL
SELECT 'records: ' || COUNT(*) FROM service_records;
