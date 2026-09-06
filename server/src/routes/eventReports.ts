import express from 'express';
import * as xlsx from 'xlsx';
import { db } from '../db';
import authMiddleware from '../middleware/auth';
import { getClubForUser } from '../utils/clubAuth';
import { syncSingleReport, syncAllReports } from '../services/googleSheetService';

const router = express.Router();

// Get pending event reports for a club
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    const club = await getClubForUser(req);
    if (!club) return res.status(404).json({ error: 'Club not found' });

    // Pending events: Past events (open_all or co_curricular), not exempt, active, no report yet
    const query = `
      SELECT e.id, e.name, e.date, e.end_date, COALESCE(e.end_date, e.date) as final_end_date, e.event_type
      FROM events e
      LEFT JOIN event_reports er ON e.id = er.event_id
      WHERE e.club_id = $1
        AND e.status = 'active'
        AND e.event_type IN ('open_all', 'co_curricular')
        AND e.report_exempt = false
        AND er.id IS NULL
        AND COALESCE(e.end_date, e.date) <= CURRENT_DATE
      ORDER BY final_end_date DESC
    `;
    const { rows } = await db.query(query, [club.id]);
    return res.json(rows);
  } catch (error: any) {
    console.error('Error fetching pending event reports:', error);
    return res.status(500).json({ error: 'Failed to fetch pending event reports' });
  }
});

// Submit a new event report
router.post('/', authMiddleware, async (req, res) => {
  try {
    const club = await getClubForUser(req);
    if (!club) return res.status(404).json({ error: 'Club not found' });

    const {
      event_id,
      level,
      report_doc_link,
      participants_sheet_link,
      photos_drive_link,
      awards_doc_link
    } = req.body;

    if (!event_id || !level || !report_doc_link || !photos_drive_link) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Security: Validate Enums
    const validLevels = ['institutional', 'state', 'national', 'international', 'other'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    // Security: Validate URLs to prevent stored XSS (javascript: URIs)
    const isValidUrl = (url: string) => {
      if (!url) return true; // optional fields
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    if (
      !isValidUrl(report_doc_link) ||
      !isValidUrl(photos_drive_link) ||
      (participants_sheet_link && !isValidUrl(participants_sheet_link)) ||
      (awards_doc_link && !isValidUrl(awards_doc_link))
    ) {
      return res.status(400).json({ error: 'Invalid URL provided. Links must start with http:// or https://' });
    }

    // Security: Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(event_id)) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    // Verify event belongs to club and is eligible
    const eventQuery = await db.query(
      `SELECT id, event_type, COALESCE(end_date, date) as final_end_date 
       FROM events 
       WHERE id = $1 AND club_id = $2`,
      [event_id, club.id]
    );
    if (eventQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found or belongs to another club' });
    }

    const eventData = eventQuery.rows[0];
    if (!['open_all', 'co_curricular'].includes(eventData.event_type)) {
      return res.status(400).json({ error: 'Reports are only applicable for Open All or Co-Curricular events' });
    }

    // Must be in the past
    // Using current date on server to check if event has passed
    const now = new Date();
    now.setHours(0, 0, 0, 0); // normalize to start of day since date/end_date are dates
    const finalEndDate = new Date(eventData.final_end_date);
    if (finalEndDate > now) {
      return res.status(400).json({ error: 'Cannot submit a report for an event that has not ended yet' });
    }

    // Insert report
    const { rows } = await db.query(
      `INSERT INTO event_reports (club_id, event_id, level, report_doc_link, participants_sheet_link, photos_drive_link, awards_doc_link)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [club.id, event_id, level, report_doc_link, participants_sheet_link, photos_drive_link, awards_doc_link]
    );

    // Asynchronously sync to Google Sheet (non-blocking)
    syncSingleReport(rows[0].id).catch(err => {
      console.error('Failed to sync new report to Google Sheet in background:', err);
    });

    return res.status(201).json(rows[0]);
  } catch (error: any) {
    console.error('Error submitting event report:', error);
    if (error.code === '23505') { // unique violation
      return res.status(409).json({ error: 'Report already exists for this event' });
    }
    return res.status(500).json({ error: 'Failed to submit event report' });
  }
});

// Update an existing event report
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const club = await getClubForUser(req);
    if (!club) return res.status(404).json({ error: 'Club not found' });

    const { id } = req.params;
    const {
      level,
      report_doc_link,
      participants_sheet_link,
      photos_drive_link,
      awards_doc_link
    } = req.body;

    if (!level || !report_doc_link || !photos_drive_link) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Security: Validate Enums
    const validLevels = ['institutional', 'state', 'national', 'international', 'other'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    // Security: Validate URLs to prevent stored XSS (javascript: URIs)
    const isValidUrl = (url: string) => {
      if (!url) return true; // optional fields
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    if (
      !isValidUrl(report_doc_link) ||
      !isValidUrl(photos_drive_link) ||
      (participants_sheet_link && !isValidUrl(participants_sheet_link)) ||
      (awards_doc_link && !isValidUrl(awards_doc_link))
    ) {
      return res.status(400).json({ error: 'Invalid URL provided. Links must start with http:// or https://' });
    }

    // Security: Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid report ID format' });
    }

    // Verify report belongs to club
    const reportQuery = await db.query(
      `SELECT id FROM event_reports WHERE id = $1 AND club_id = $2`,
      [id, club.id]
    );
    if (reportQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or belongs to another club' });
    }

    const { rows } = await db.query(
      `UPDATE event_reports 
       SET level = $1, report_doc_link = $2, 
           participants_sheet_link = $3, photos_drive_link = $4, awards_doc_link = $5
       WHERE id = $6 AND club_id = $7
       RETURNING *`,
      [level, report_doc_link, participants_sheet_link, photos_drive_link, awards_doc_link, id, club.id]
    );

    // Asynchronously sync update to Google Sheet (non-blocking)
    syncSingleReport(id).catch(err => {
      console.error('Failed to sync updated report to Google Sheet in background:', err);
    });

    return res.json(rows[0]);
  } catch (error: any) {
    console.error('Error updating event report:', error);
    return res.status(500).json({ error: 'Failed to update event report' });
  }
});

// Get all reports (for a club, or all for admin)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    let query = `
      SELECT er.*, e.name as event_name, e.date, e.end_date, e.event_type, c.name as club_name
      FROM event_reports er
      JOIN events e ON er.event_id = e.id
      JOIN clubs c ON er.club_id = c.id
    `;
    const params = [];

    if (!isAdmin) {
      const club = await getClubForUser(req);
      if (!club) return res.status(404).json({ error: 'Club not found' });
      query += ` WHERE er.club_id = $1`;
      params.push(club.id);
    }

    query += ` ORDER BY er.created_at DESC`;
    const { rows } = await db.query(query, params);
    return res.json(rows);
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Toggle report_exempt (Admin only)
router.patch('/exempt/:event_id', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { exempt } = req.body;
    const { event_id } = req.params;

    // Security: Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(event_id)) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    const { rows } = await db.query(
      `UPDATE events SET report_exempt = $1 WHERE id = $2 RETURNING *`,
      [Boolean(exempt), event_id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    return res.json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update exemption status' });
  }
});

// Export to Excel
router.get('/export', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await db.query(`
      SELECT c.name as "Club/Committee Name", e.name as "Event Name", 
             e.date as "Start Date", e.end_date as "End Date",
             er.report_doc_link as "Report Doc Link", er.participants_sheet_link as "Participants Link",
             er.level as "Level", e.event_type as "Event Type",
             er.photos_drive_link as "Photos Link", er.awards_doc_link as "Awards Link",
             er.created_at as "Submitted At"
      FROM event_reports er
      JOIN events e ON er.event_id = e.id
      JOIN clubs c ON er.club_id = c.id
      ORDER BY e.date ASC, e.end_date ASC
    `);

    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Event Reports");
    
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', 'attachment; filename="Event_Reports.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error: any) {
    console.error('Export error:', error);
    return res.status(500).json({ error: 'Failed to export to excel' });
  }
});

// Admin can fetch ALL past events (to see which ones need reports or are exempt)
router.get('/all-past-events', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { rows } = await db.query(`
      SELECT e.id, e.name, e.date, e.venue, e.end_date, e.event_type, e.status, e.report_exempt, e.club_id, e.created_at, e.updated_at, c.name as club_name, 
        CASE WHEN er.id IS NOT NULL THEN true ELSE false END as has_report
      FROM events e
      JOIN clubs c ON e.club_id = c.id
      LEFT JOIN event_reports er ON e.id = er.event_id
      WHERE e.status = 'active'
        AND e.event_type IN ('open_all', 'co_curricular')
        AND COALESCE(e.end_date, e.date) <= CURRENT_DATE
      ORDER BY COALESCE(e.end_date, e.date) DESC
    `);
    
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch past events' });
  }
});

// Admin manually syncs all event reports to Google Sheet
router.post('/sync-sheets', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { from_date, to_date } = req.body || {};
    const result = await syncAllReports(from_date, to_date);
    if (!result.success) {
      return res.status(400).json({ error: result.message || result.error || 'Failed to sync to Google Sheet' });
    }

    return res.json({ success: true, count: result.count, message: result.message });
  } catch (error: any) {
    console.error('Manual sheet sync error:', error);
    return res.status(500).json({ error: 'Failed to sync to Google Sheet' });
  }
});

export default router;