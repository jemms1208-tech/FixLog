-- activity_logs 정책
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON activity_logs;
CREATE POLICY "Enable insert for authenticated users" ON activity_logs 
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable read access for admins" ON activity_logs;
CREATE POLICY "Enable read access for admins" ON activity_logs 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'operator')
        )
    );

-- notices 정책
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON notices;
CREATE POLICY "Enable read access for authenticated users" ON notices 
    FOR SELECT 
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all access for admins and operators" ON notices;
CREATE POLICY "Enable all access for admins and operators" ON notices 
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'operator')
        )
    );

-- clients, service_records 등도 필요하다면 추가
