-- 디버깅용 쿼리: 공지사항과 그룹 데이터 확인

-- 1. ytt132246 사용자 정보 확인
SELECT id, display_name, role, allowed_groups 
FROM profiles 
WHERE username = 'ytt132246';

-- 2. 모든 공지사항 확인
SELECT id, title, allowed_roles, allowed_groups FROM notices;

-- 3. ytt132246 관점에서 각 공지 접근 가능 여부 수동 테스트
-- ytt132246의 allowed_groups = ["c9904922-2247-4f13-b88a-17d894470926","3b0034c5-a46f-4565-b6b2-40bc5b87c7e1"]
-- ytt132246의 role = callcenter

SELECT 
  n.id,
  n.title,
  -- 역할 체크
  'callcenter' = ANY(n.allowed_roles) as role_match,
  -- 그룹 체크: 비어있으면 전체 공개
  (n.allowed_groups IS NULL OR cardinality(n.allowed_groups) = 0) as is_all_groups,
  -- 그룹 교집합 체크
  ARRAY['c9904922-2247-4f13-b88a-17d894470926'::uuid, '3b0034c5-a46f-4565-b6b2-40bc5b87c7e1'::uuid] && n.allowed_groups as group_overlap,
  -- 최종 결과
  CASE 
    WHEN 'callcenter' = ANY(n.allowed_roles) 
         AND (n.allowed_groups IS NULL OR cardinality(n.allowed_groups) = 0 
              OR ARRAY['c9904922-2247-4f13-b88a-17d894470926'::uuid, '3b0034c5-a46f-4565-b6b2-40bc5b87c7e1'::uuid] && n.allowed_groups)
    THEN 'SHOULD BE VISIBLE'
    ELSE 'SHOULD BE HIDDEN'
  END as expected_result
FROM notices n;
