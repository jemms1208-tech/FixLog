-- Migration: Add address_detail column to clients table
-- This allows storing the detailed address (dong/ho) separately from the base address

ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_detail TEXT;

-- Add comment for documentation
COMMENT ON COLUMN clients.address_detail IS 'Detailed address (dong/ho number) - stored separately from base address';
