import { Request, Response } from 'express';
import { invalidatePublicBookings } from '../cache';
import { db, withTransaction } from '../db';
import { checkPendingEventReports } from '../services/eventReportService';
import { CO_CURRICULAR_LIMIT, countCoCurricularBookings, getSemesterRange } from '../services/semesterUtils';
import { getClubForUser } from '../utils/clubAuth';

export const createEvent = async (req: Request, res: Response) => {
  const { name, date, venue, end_date, event_type } = req.body;

  if (!name || !date) {
    return res.status(400).json({ error: 'Name and date are required' });
  }

  // Security: Validate event_type enum
  const validEventTypes = ['open_all', 'co_curricular', 'closed_club'];
  const finalEventType = event_type || 'open_all';
  if (!validEventTypes.includes(finalEventType)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }

  const isAdmin = req.user?.role === 'admin';

  let initialStatus = 'active';

  if (!isAdmin) {
    type EventType = 'co_curricular' | 'open_all' | 'closed_club';
    const MIN_DAYS_BY_EVENT: Record<EventType, number> = {
      co_curricular: 14,
      open_all: 20,
      closed_club: 0,
    };

    const eventStartDate = new Date(date);
    const daysGap = (eventStartDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    
    if (daysGap < MIN_DAYS_BY_EVENT[finalEventType as EventType]) {
      initialStatus = 'pending';
    }
  }

  try {
    let clubId: string;

    if (isAdmin && req.body.club_id) {
      // Allow admin to create events on behalf of a specific club
      clubId = req.body.club_id;
    } else {
      const club = await getClubForUser(req);
      if (!club) {
        return res.status(404).json({ error: 'Club not found for this account' });
      }
      clubId = club.id;
    }

    // Check if the club is blocked due to pending event reports
    const { blocked, message: blockMessage } = await checkPendingEventReports(clubId);
    if (blocked && !isAdmin) {
      return res.status(403).json({ error: blockMessage });
    }

    if (!isAdmin && finalEventType === 'co_curricular') {
      const start = new Date(date);
      const { start: semStart, end: semEnd } = getSemesterRange(start);
      const count = await countCoCurricularBookings(clubId, semStart, semEnd);
      if (count >= CO_CURRICULAR_LIMIT) {
        return res.status(400).json({
          error: `This club has already registered ${CO_CURRICULAR_LIMIT} co-curricular events this semester. The maximum allowed is ${CO_CURRICULAR_LIMIT}.`,
        });
      }
    }

    const { rows } = await db.query(
      `INSERT INTO events (club_id, name, date, venue, end_date, event_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, club_id, name, date, venue, end_date, event_type, status, created_at, updated_at`,
      [clubId, name, date, venue || null, end_date || null, finalEventType, initialStatus]
    );

    return res.status(201).json(rows[0]);
  } catch (error: any) {
    console.error('Error creating event:', error);
    return res.status(500).json({ error: 'Failed to create event' });
  }
};

export const getEvents = async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    let clubId: string | undefined;

    if (!isAdmin) {
      const club = await getClubForUser(req);
      if (!club) {
        return res.status(404).json({ error: 'Club not found for this account' });
      }
      clubId = club.id;
    }

    let query = `SELECT e.id, e.name, e.date, e.venue, e.end_date, e.event_type, e.status, e.club_id, e.created_at, e.updated_at, c.name as club_name, COALESCE(e.end_date, e.date) as dynamic_end_date
       FROM events e
       LEFT JOIN clubs c ON e.club_id = c.id
       WHERE e.status != 'cancelled'`;
    const params: any[] = [];

    if (!isAdmin) {
      query += ` AND e.club_id = $1`;
      params.push(clubId);
    }

    if (req.query.futureOnly === 'true') {
      query += ` AND COALESCE(e.end_date, e.date) >= CURRENT_TIMESTAMP`;
    }

    query += ` ORDER BY e.date DESC, e.created_at DESC`;

    const { rows } = await db.query(query, params);
    return res.json(rows);
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
};

export const updateEvent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, date, end_date, venue, event_type } = req.body;

  try {
    const isAdmin = req.user?.role === 'admin';
    let clubId: string | undefined;

    if (!isAdmin) {
      const club = await getClubForUser(req);
      if (!club) {
        return res.status(404).json({ error: 'Club not found for this account' });
      }
      clubId = club.id;
    }

    const checkRes = await db.query('SELECT club_id, date, COALESCE(end_date, date) as end_date, event_type, status FROM events WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const existingEvent = checkRes.rows[0];
    if (!isAdmin) {
      if (existingEvent.club_id !== clubId) {
        return res.status(403).json({ error: 'You do not have permission to edit this event' });
      }
      if (new Date(existingEvent.date) <= new Date()) {
        return res.status(403).json({ error: 'Ongoing or past events cannot be edited' });
      }
    }

    const updateFields: Record<string, any> = {};
    if (name !== undefined) updateFields.name = name;
    if (date !== undefined) updateFields.date = date;
    if (end_date !== undefined) updateFields.end_date = end_date;
    if (venue !== undefined) updateFields.venue = venue;
    if (event_type !== undefined) updateFields.event_type = event_type;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    if (!isAdmin) {
      const finalDate = updateFields.date || existingEvent.date;
      const finalEventType = updateFields.event_type || existingEvent.event_type;
      
      type EventType = 'co_curricular' | 'open_all' | 'closed_club';
      const MIN_DAYS_BY_EVENT: Record<EventType, number> = {
        co_curricular: 14,
        open_all: 20,
        closed_club: 0,
      };

      const eventStartDate = new Date(finalDate);
      const daysGap = (eventStartDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      if (daysGap < MIN_DAYS_BY_EVENT[finalEventType as EventType]) {
        updateFields.status = 'pending';
      } else if (existingEvent.status === 'pending') {
        // Automatically activate if it was pending and now satisfies the date gap?
        // Let's only downgrade to pending if it violates, and upgrade to active if it was pending
        // solely due to the gap. But we can't be 100% sure why it was pending, maybe Admin set it.
        // However, standard flow is: if you edit it and it meets criteria, it becomes active.
        updateFields.status = 'active';
      }
    }

    const keys = Object.keys(updateFields);
    const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = Object.values(updateFields);
    values.push(id);

    const { rows } = await db.query(
      `UPDATE events SET ${setString} WHERE id = $${values.length} RETURNING id, club_id, name, date, venue, end_date, event_type, status, created_at, updated_at`,
      values
    );

    // If the event was downgraded to pending, downgrade all its bookings too.
    if (updateFields.status === 'pending' && existingEvent.status !== 'pending') {
      await db.query(`UPDATE bookings SET status = 'pending' WHERE event_id = $1`, [id]);
      invalidatePublicBookings();
    }

    return res.json(rows[0]);
  } catch (error: any) {
    console.error('Error updating event:', error);
    return res.status(500).json({ error: 'Failed to update event' });
  }
};

export const deleteEvent = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const isAdmin = req.user?.role === 'admin';
    let clubId: string | undefined;

    if (!isAdmin) {
      const club = await getClubForUser(req);
      if (!club) {
        return res.status(404).json({ error: 'Club not found for this account' });
      }
      clubId = club.id;
    }

    const checkRes = await db.query('SELECT club_id, date, COALESCE(end_date, date) as end_date FROM events WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const existingEvent = checkRes.rows[0];
    if (!isAdmin) {
      if (existingEvent.club_id !== clubId) {
        return res.status(403).json({ error: 'You do not have permission to delete this event' });
      }
      if (new Date(existingEvent.end_date) < new Date()) {
        return res.status(403).json({ error: 'Past events cannot be deleted' });
      }
    }

    await withTransaction(async (client) => {
      await client.query(`
        INSERT INTO archived_events (id, club_id, name, date, end_date, venue, event_type, status, report_exempt, created_at, updated_at)
        SELECT id, club_id, name, date, end_date, venue, event_type, status, report_exempt, created_at, updated_at
        FROM events WHERE id = $1
      `, [id]);

      await client.query(`
        INSERT INTO archived_bookings (id, club_id, venue_id, start_time, end_time, status, user_id, event_name, event_type, expected_attendees, batch_id, event_id, created_at, updated_at)
        SELECT b.id, b.club_id, b.venue_id, b.start_time, b.end_time, b.status, b.user_id, e.name as event_name, e.event_type, b.expected_attendees, b.batch_id, b.event_id, b.created_at, b.updated_at
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        WHERE b.event_id = $1
      `, [id]);

      await client.query(`
        INSERT INTO archived_event_reports (id, club_id, event_id, level, report_doc_link, participants_sheet_link, photos_drive_link, awards_doc_link, created_at, updated_at)
        SELECT id, club_id, event_id, level, report_doc_link, participants_sheet_link, photos_drive_link, awards_doc_link, created_at, updated_at
        FROM event_reports WHERE event_id = $1
      `, [id]);

      await client.query('DELETE FROM event_reports WHERE event_id = $1', [id]);
      await client.query('DELETE FROM bookings WHERE event_id = $1', [id]);
      await client.query('DELETE FROM events WHERE id = $1', [id]);
    });

    invalidatePublicBookings();

    return res.json({ success: true, message: 'Event and associated data deleted and archived successfully' });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ error: 'Failed to delete event' });
  }
};

export const getPublicEvents = async (_req: Request, res: Response) => {
  try {
    const { rows } = await db.query(`
      SELECT e.id, e.name, e.date, e.venue, e.end_date, e.event_type, e.status, 
             jsonb_build_object('name', c.name) AS clubs
      FROM events e
      LEFT JOIN clubs c ON e.club_id = c.id
      WHERE e.event_type IN ('open_all', 'co_curricular')
        AND e.status = 'active'
      ORDER BY e.date ASC
    `);

    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
