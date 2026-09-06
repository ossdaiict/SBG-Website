-- Remove Redundant indexing and optimizing queries
DROP INDEX IF EXISTS public.idx_bookings_status;
DROP INDEX IF EXISTS public.idx_club_members_club_id;
DROP INDEX IF EXISTS public.idx_clubs_name;

-- Optimized indexes for admin and public booking queries
-- 1. Index on end_time: highly selective for filtering out historical bookings (WHERE end_time >= NOW() ...)
CREATE INDEX IF NOT EXISTS idx_bookings_end_time ON public.bookings (end_time);

-- 2. Index on status and start_time: Perfect for queries filtering by status and ordering by start_time 
-- This prevents expensive in-memory sorts for endpoints fetching pending/approved bookings.
CREATE INDEX IF NOT EXISTS idx_bookings_status_start_time ON public.bookings (status, start_time DESC);
