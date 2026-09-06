-- Drop level_description column from event_reports and archived_event_reports tables
ALTER TABLE event_reports DROP COLUMN IF EXISTS level_description;
ALTER TABLE archived_event_reports DROP COLUMN IF EXISTS level_description;