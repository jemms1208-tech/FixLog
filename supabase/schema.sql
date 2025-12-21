-- 거래처 그룹 (Client Groups)
CREATE TABLE client_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  name TEXT NOT NULL UNIQUE
);

-- 유저 프로필 및 권한 (User Profiles & Roles)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'editor', 'viewer')) DEFAULT 'viewer',
  allowed_groups UUID[] DEFAULT '{}' -- 허용된 그룹 ID 배열
);

-- 거래처 정보 (Clients)
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  biz_reg_no TEXT, -- 사업자번호
  name TEXT NOT NULL, -- 상호
  address TEXT,
  phone TEXT,
  contact_person TEXT,
  van_company TEXT, -- 밴사
  equipment TEXT, -- 장비
  group_id UUID REFERENCES client_groups(id) ON DELETE SET NULL,
  group_name TEXT -- 그룹 삭제 시에도 이름 보존
);

-- 장애/접수 기록 (Service/Failure Records)
CREATE TABLE service_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT, -- 거래처 삭제 시에도 이름 보존
  reception_at TIMESTAMP WITH TIME ZONE DEFAULT now(), -- 접수일시
  type TEXT CHECK (type IN ('신규', '사업자변경', '장애', '용지요청', '메뉴수정', '기타')), -- 접수내용
  details TEXT, -- 장애내용
  processed_at TIMESTAMP WITH TIME ZONE, -- 처리일시
  result TEXT, -- 처리내용
  technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  technician_name TEXT -- 기사 삭제 시에도 이름 보존
);

-- RLS (Row Level Security) 설정
ALTER TABLE client_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;

-- 정책: 관리자는 모든 것을 할 수 있음
CREATE POLICY "Admins have full access" ON client_groups FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- (기타 정책들은 구현 과정에서 세분화 예정)
