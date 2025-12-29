-- FixLog: Add receiver and handler tracking to records
-- Run this in Supabase SQL Editor

-- Add receiver_id (who received/created the record)
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES profiles(id);

-- Add handler_id (who processed/completed the record)
ALTER TABLE service_records ADD COLUMN IF NOT EXISTS handler_id UUID REFERENCES profiles(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_service_records_receiver_id ON service_records(receiver_id);
CREATE INDEX IF NOT EXISTS idx_service_records_handler_id ON service_records(handler_id);
