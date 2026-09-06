-- Ensure btree_gist extension is enabled so we can use GiST indexes with equality on UUIDs
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop the constraint if it exists (for idempotency during development)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_double_booking;

-- Clean up existing overlapping approved bookings (reject the newer ones)
UPDATE bookings b1 
SET status = 'rejected' 
FROM bookings b2 
WHERE b1.id != b2.id 
  AND b1.venue_id = b2.venue_id 
  AND b1.status = 'approved' 
  AND b2.status = 'approved' 
  AND tstzrange(b1.start_time, b1.end_time) && tstzrange(b2.start_time, b2.end_time) 
  AND b1.created_at > b2.created_at;

-- Add GiST exclusion constraint to prevent overlapping approved bookings for the same venue
ALTER TABLE bookings ADD CONSTRAINT no_double_booking 
EXCLUDE USING gist (
    venue_id WITH =,
    tstzrange(start_time, end_time) WITH &&
) WHERE (status = 'approved');