-- 027_archive_standalone_bookings.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'archived_bookings' AND column_name = 'booking_name'
  ) THEN
    ALTER TABLE archived_bookings ADD COLUMN booking_name VARCHAR(255);
    UPDATE archived_bookings SET booking_name = event_name WHERE booking_name IS NULL;
  END IF;
END $$;
