-- 거래처 100개 더미 데이터 생성
-- 실행 전에 client_groups 테이블에 그룹이 있어야 합니다.

-- 먼저 기본 그룹이 없다면 생성
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
BEGIN
    -- 그룹 ID 배열 가져오기
    SELECT ARRAY_AGG(id) INTO group_ids FROM client_groups;
    
    FOR i IN 1..100 LOOP
        -- 랜덤 그룹 선택
        random_group := group_ids[floor(random() * array_length(group_ids, 1) + 1)];
        
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
            business_types[floor(random() * 10 + 1)] || ' ' || 
            (ARRAY['행복', '사랑', '희망', '미래', '태양', '달빛', '별빛', '가온', '하늘', '바다'])[floor(random() * 10 + 1)] || 
            (i + floor(random() * 100))::TEXT,
            
            LPAD((floor(random() * 999) + 100)::TEXT, 3, '0') || '-' ||
            LPAD((floor(random() * 99) + 10)::TEXT, 2, '0') || '-' ||
            LPAD((floor(random() * 99999) + 10000)::TEXT, 5, '0'),
            
            area_codes[floor(random() * 8 + 1)] || '-' ||
            LPAD((floor(random() * 9000) + 1000)::TEXT, 4, '0') || '-' ||
            LPAD((floor(random() * 9000) + 1000)::TEXT, 4, '0'),
            
            '010-' ||
            LPAD((floor(random() * 9000) + 1000)::TEXT, 4, '0') || '-' ||
            LPAD((floor(random() * 9000) + 1000)::TEXT, 4, '0'),
            
            cities[floor(random() * 8 + 1)] || ' ' ||
            districts[floor(random() * 10 + 1)] || ' ' ||
            (ARRAY['대로', '로', '길'])[floor(random() * 3 + 1)] || ' ' ||
            (floor(random() * 500) + 1)::TEXT || '번길 ' ||
            (floor(random() * 50) + 1)::TEXT,
            
            van_companies[floor(random() * 7 + 1)],
            
            equipments[floor(random() * 6 + 1)],
            
            random_group
        );
    END LOOP;
END $$;

-- 접수 내역 100개 생성
DO $$
DECLARE
    i INTEGER;
    client_ids UUID[];
    random_client UUID;
    record_types TEXT[] := ARRAY['장애', '서비스', '기타'];
    statuses TEXT[] := ARRAY['pending', 'processing', 'completed'];
    random_status TEXT;
    random_date TIMESTAMP;
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
        'POS 프로그램 오류',
        '단말기 리더기 인식 불량',
        '터치 스크린 오작동',
        'IC카드 인식 불량',
        '마그네틱 리더 고장',
        '통신 불안정'
    ];
    result_templates TEXT[] := ARRAY[
        '전원 케이블 교체로 해결',
        '단말기 재부팅으로 정상화',
        '펌웨어 업데이트 완료',
        '부품 교체 완료',
        '네트워크 설정 수정',
        '프린터 청소 및 정비',
        '소프트웨어 재설치',
        '원격 점검으로 해결',
        '현장 방문 수리 완료',
        '통신사 회선 점검 요청'
    ];
BEGIN
    -- 거래처 ID 배열 가져오기
    SELECT ARRAY_AGG(id) INTO client_ids FROM clients;
    
    IF array_length(client_ids, 1) IS NULL THEN
        RAISE NOTICE 'No clients found. Please insert clients first.';
        RETURN;
    END IF;
    
    FOR i IN 1..100 LOOP
        random_client := client_ids[floor(random() * array_length(client_ids, 1) + 1)];
        random_status := statuses[floor(random() * 3 + 1)];
        random_date := NOW() - (floor(random() * 30) || ' days')::INTERVAL - (floor(random() * 24) || ' hours')::INTERVAL;
        
        INSERT INTO service_records (
            client_id,
            type,
            details,
            status,
            reception_at,
            processed_at,
            started_at,
            result
        ) VALUES (
            random_client,
            record_types[floor(random() * 3 + 1)],
            detail_templates[floor(random() * 15 + 1)],
            random_status,
            random_date,
            CASE 
                WHEN random_status = 'completed' THEN random_date + (floor(random() * 48) || ' hours')::INTERVAL
                ELSE NULL
            END,
            CASE 
                WHEN random_status IN ('processing', 'completed') THEN random_date + (floor(random() * 4) || ' hours')::INTERVAL
                ELSE NULL
            END,
            CASE 
                WHEN random_status = 'completed' THEN result_templates[floor(random() * 10 + 1)]
                ELSE NULL
            END
        );
    END LOOP;
END $$;

-- 결과 확인
SELECT '거래처 수: ' || COUNT(*) FROM clients;
SELECT '접수 내역 수: ' || COUNT(*) FROM service_records;
