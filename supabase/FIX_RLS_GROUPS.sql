-- Fix RLS policies to allow users to view client groups and clients
ALTER TABLE client_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON client_groups;

CREATE POLICY "Enable read access for authenticated users" ON client_groups
FOR SELECT
TO authenticated
USING (true);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON clients;

CREATE POLICY "Enable read access for authenticated users" ON clients
FOR SELECT
TO authenticated
USING (true);
