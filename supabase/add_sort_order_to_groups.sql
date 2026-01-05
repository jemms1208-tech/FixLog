-- client_groups 테이블에 sort_order 컬럼 추가
ALTER TABLE public.client_groups 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 기존 데이터에 순서 부여 (이름 알파벳 순)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) - 1 as new_order
  FROM public.client_groups
)
UPDATE public.client_groups c
SET sort_order = o.new_order
FROM ordered o
WHERE c.id = o.id;
