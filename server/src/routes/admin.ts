import express from 'express';
import { invalidateClubs, invalidatePublicBookings, invalidateVenues } from '../cache';
import { performVenueConflictCheck } from '../controllers/bookingController';
import { db } from '../db';
import authMiddleware, { adminOnly } from '../middleware/auth';
import { io } from '../server';
import { createNotification } from '../services/notification';
import { CO_CURRICULAR_LIMIT, countCoCurricularBookings, getSemesterRange } from '../services/semesterUtils';


const router = express.Router();

router.use(authMiddleware, adminOnly);

// Reusable base query — event_name and event_type joined from events table
const baseBookingQuery = `
  SELECT b.*, 
         e.name AS event_name,
         COALESCE(e.event_type, 'closed_club') AS event_type,
         jsonb_build_object('name', c.name) AS clubs,
         jsonb_build_object('name', v.name) AS venues
  FROM bookings b
  LEFT JOIN clubs c ON b.club_id = c.id
  LEFT JOIN venues v ON b.venue_id = v.id
  LEFT JOIN events e ON b.event_id = e.id
`;

router.get('/pending', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      ${baseBookingQuery}
      WHERE b.status = 'pending'
      ORDER BY b.start_time ASC
    `);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/bookings', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM (
        ${baseBookingQuery}
        WHERE b.status = 'pending'
        UNION
        ${baseBookingQuery}
        WHERE b.end_time >= NOW() - INTERVAL '180 days'
      ) AS combined
      ORDER BY start_time DESC
    `);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Event endpoints
router.get('/events/pending', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT e.*, 
             COALESCE(e.end_date, e.date) as dynamic_end_date,
             jsonb_build_object('name', c.name) AS clubs
      FROM events e
      LEFT JOIN clubs c ON e.club_id = c.id
      WHERE e.status = 'pending'
      ORDER BY e.created_at ASC
    `);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/events', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT e.*, 
             COALESCE(e.end_date, e.date) as dynamic_end_date,
             jsonb_build_object('name', c.name) AS clubs
      FROM events e
      LEFT JOIN clubs c ON e.club_id = c.id
      ORDER BY e.created_at DESC
    `);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/events/bulk-status', async (req, res) => {
  const { ids, status } = req.body as {
    ids: string[];
    status: 'active' | 'rejected' | 'pending';
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No event IDs provided' });
  }

  if (status !== 'active' && status !== 'rejected' && status !== 'pending') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Fetch the events to ensure they exist and to get metadata
    const { rows: events } = await client.query(
      `SELECT e.*, c.email as club_email 
       FROM events e
       LEFT JOIN clubs c ON e.club_id = c.id
       WHERE e.id = ANY($1)`,
      [ids]
    );

    if (events.length === 0) {
      throw new Error('No valid events found');
    }

    // Update statuses
    await client.query(
      `UPDATE events SET status = $1 WHERE id = ANY($2)`,
      [status, ids]
    );

    if (status === 'rejected') {
      await client.query(
        `UPDATE bookings SET status = 'rejected' WHERE event_id = ANY($1)`,
        [ids]
      );
    }

    await client.query('COMMIT');

    invalidatePublicBookings();

    // Create notifications
    const { createBulkEventStatusNotifications } = await import('../services/notification');
    await createBulkEventStatusNotifications(events, status);

    for (const data of events) {
      // Optionally notify via socket if there is an active connection
      io.to(`club:${data.club_id}`).emit('events:updated');
    }

    io.emit('events:updated');

    return res.json({ success: true, count: events.length });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.patch('/bookings/bulk-status', async (req, res) => {
  const { ids, status } = req.body as {
    ids: string[];
    status: 'approved' | 'rejected' | 'pending';
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No booking IDs provided' });
  }

  if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Fetch the bookings to ensure they exist and to get metadata
    const { rows: bookings } = await client.query(
      `SELECT b.*, v.name as venue_name, e.name as event_name, c.email as club_email 
       FROM bookings b
       LEFT JOIN venues v ON b.venue_id = v.id
       LEFT JOIN events e ON b.event_id = e.id
       LEFT JOIN clubs c ON b.club_id = c.id
       WHERE b.id = ANY($1)`,
      [ids]
    );

    if (bookings.length === 0) {
      throw new Error('No valid bookings found');
    }

    if (status === 'approved') {
      const venueIds = [...new Set(bookings.map((b: { venue_id: string }) => b.venue_id))];
      await client.query(
        'SELECT id FROM venues WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [venueIds]
      );

      for (const booking of bookings) {
        const { conflict, message } = await performVenueConflictCheck(
          [booking.venue_id],
          booking.start_time,
          booking.end_time,
          ids,
          client
        );
        if (conflict) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: message });
        }
      }
    }

    // Update statuses
    await client.query(
      `UPDATE bookings SET status = $1 WHERE id = ANY($2)`,
      [status, ids]
    );

    await client.query('COMMIT');

    invalidatePublicBookings();

    // Create notifications and emit socket events
    const { createBulkBookingStatusNotifications } = await import('../services/notification');
    await createBulkBookingStatusNotifications(bookings, status);

    const emittedClubs = new Set<string>();
    for (const data of bookings) {
      const key = `${data.club_id}-${data.event_name}`;
      if (!emittedClubs.has(key)) {
        io.to(`club:${data.club_id}`).emit('booking:status_changed', {
          bookingId: data.id,
          status,
          eventName: data.event_name || 'Event',
          clubId: data.club_id,
        });
        emittedClubs.add(key);
      }
    }

    io.emit('events:updated');

    return res.json({ success: true, count: bookings.length });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.post('/bookings/send-email', async (req, res) => {
  const { eventId, batchId } = req.body as {
    eventId?: string;
    batchId?: string;
  };

  if (!eventId && !batchId) {
    return res.status(400).json({ error: 'Either eventId or batchId must be provided' });
  }

  try {
    const { rows: allGroupBookings } = await db.query(
      `SELECT b.*, v.name as venue_name, c.email as club_email, e.name as actual_event_name
       FROM bookings b
       LEFT JOIN venues v ON b.venue_id = v.id
       LEFT JOIN clubs c ON b.club_id = c.id
       LEFT JOIN events e ON b.event_id = e.id
       WHERE ${eventId ? 'b.event_id = $1' : 'b.batch_id = $1'}`,
      [eventId || batchId]
    );

    if (allGroupBookings.length === 0) {
      return res.status(404).json({ error: 'No bookings found' });
    }

    const clubEmail = allGroupBookings[0].club_email;
    const eventName = allGroupBookings[0].actual_event_name || allGroupBookings[0].event_name || 'Event';
    const date = new Date(allGroupBookings[0].start_time).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    const startTimeStr = new Date(allGroupBookings[0].start_time).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit' });
    const endTimeStr = new Date(allGroupBookings[0].end_time).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit' });

    const approvedVenues: string[] = [];
    const rejectedVenues: string[] = [];

    allGroupBookings.forEach((b: any) => {
      const vName = b.venue_name || 'Venue';
      if (b.status === 'approved') approvedVenues.push(vName);
      else if (b.status === 'rejected') rejectedVenues.push(vName);
    });

    if (clubEmail) {
      const { sendBulkBookingProcessedEmail } = await import('../services/email');
      const emailResult = await sendBulkBookingProcessedEmail(
        clubEmail,
        eventName,
        date,
        startTimeStr,
        endTimeStr,
        approvedVenues,
        rejectedVenues
      );

      if (emailResult.sent) {
        return res.json({ success: true });
      } else {
        return res.status(500).json({ error: emailResult.error || 'Failed to send email' });
      }
    } else {
      return res.status(400).json({ error: 'Club email not found' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, adminNote } = req.body as {
    status?: 'approved' | 'rejected';
    adminNote?: string;
  };

  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const fetchRes = await db.query('SELECT status FROM bookings WHERE id = $1', [id]);
    if (fetchRes.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    const oldStatus = fetchRes.rows[0].status;

    const { rows } = await db.query(`
      UPDATE bookings SET status = $1 
      WHERE id = $2 
      RETURNING *
    `, [status, id]);

    if (rows.length === 0) throw new Error('Booking not found');
    const data = rows[0];

    // Create a notification for the status change
    await createNotification({
      type: status === 'approved' ? 'booking_approved' : 'booking_rejected',
      title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `"${data.booking_name || 'Booking'}" has been ${status}.`,
      userId: data.user_id,
      metadata: { bookingId: id, status },
    });

    // Emit real-time event to the specific club room
    io.to(`club:${data.club_id}`).emit('booking:status_changed', {
      bookingId: id,
      status,
      eventName: data.booking_name || 'Booking',
      clubId: data.club_id,
    });

    io.emit('events:updated');



    invalidatePublicBookings();
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Visibility endpoint removed — is_public column dropped.
// Bookings visibility is now determined by event_type on the events table.

router.put('/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const {
    venue_id, start_time, end_time,
    expected_attendees, status,
  } = req.body;

  const updateFields: Record<string, any> = {};
  if (venue_id !== undefined) updateFields.venue_id = venue_id;
  if (start_time !== undefined) updateFields.start_time = start_time;
  if (end_time !== undefined) updateFields.end_time = end_time;
  if (expected_attendees !== undefined) updateFields.expected_attendees = expected_attendees;
  if (status !== undefined) updateFields.status = status;

  if (Object.keys(updateFields).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    // Co-curricular limit check — event_type from the events table
    if (status === 'approved') {
      const existRes = await db.query(
        `SELECT b.club_id, b.start_time, e.event_type
         FROM bookings b LEFT JOIN events e ON b.event_id = e.id
         WHERE b.id = $1`, [id]);
      if (existRes.rows.length > 0 && existRes.rows[0].event_type === 'co_curricular') {
        const existing = existRes.rows[0];
        const eventDate = new Date(start_time || existing.start_time);
        const { start: semStart, end: semEnd } = getSemesterRange(eventDate);
        const count = await countCoCurricularBookings(existing.club_id, semStart, semEnd, id);
        if (count >= CO_CURRICULAR_LIMIT) {
          return res.status(400).json({ error: `This club has already booked ${CO_CURRICULAR_LIMIT} co-curricular events.` });
        }
      }
    }

    // Dynamically build the SQL SET string (e.g. "event_name = $1, status = $2")
    const keys = Object.keys(updateFields);
    const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = Object.values(updateFields);
    values.push(id); // Push ID as the final parameter for the WHERE clause

    // We use a CTE (WITH clause) to perform the update and then immediately join the club/venue names
    const { rows } = await db.query(`
      WITH updated AS (
        UPDATE bookings SET ${setString} WHERE id = $${values.length} RETURNING *
      )
      SELECT u.*, 
             jsonb_build_object('name', c.name, 'email', c.email) AS clubs,
             jsonb_build_object('name', v.name) AS venues
      FROM updated u
      LEFT JOIN clubs c ON u.club_id = c.id
      LEFT JOIN venues v ON u.venue_id = v.id
    `, values);

    if (rows.length === 0) throw new Error('Update failed');
    const data = rows[0];

    io.emit('events:updated');
    io.to(`club:${data.club_id}`).emit('booking:status_changed', {
      bookingId: id,
      status: data.status,
      eventName: data.booking_name || data.event_name,
      clubId: data.club_id,
    });

    invalidatePublicBookings();
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/bookings/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const fetchRes = await db.query(
      `SELECT b.club_id, b.status, b.start_time, b.end_time, e.name AS event_name, v.name AS venue_name, c.email AS club_email
       FROM bookings b 
       LEFT JOIN events e ON b.event_id = e.id
       LEFT JOIN venues v ON b.venue_id = v.id
       LEFT JOIN clubs c ON b.club_id = c.id
       WHERE b.id = $1`, [id]);
    const booking = fetchRes.rows[0];

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await db.query('DELETE FROM bookings WHERE id = $1', [id]);
    invalidatePublicBookings();

    io.emit('events:updated');
    if (booking) {
      io.to(`club:${booking.club_id}`).emit('booking:status_changed', {
        bookingId: id,
        status: 'deleted' as any,
        eventName: booking.event_name,
        clubId: booking.club_id,
      });

      if (booking.status === 'approved' && booking.club_email) {
        const { sendBookingCancelledEmailToClub } = await import('../services/email');
        const date = new Date(booking.start_time).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        const startTimeStr = new Date(booking.start_time).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit', minute: '2-digit' });
        const endTimeStr = new Date(booking.end_time).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit', minute: '2-digit' });

        await sendBookingCancelledEmailToClub(
          booking.club_email,
          booking.venue_name || 'Venue',
          booking.event_name,
          date,
          startTimeStr,
          endTimeStr
        );
      }
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/bookings', async (req, res) => {
  const { club_id, venue_ids, start_time: singleStartTime, end_time: singleEndTime, timeSlots: reqTimeSlots, expected_attendees, event_id, bookingName, bookingMode = 'event' } = req.body;

  let timeSlots = reqTimeSlots;
  if (!timeSlots) {
    if (singleStartTime && singleEndTime) {
      timeSlots = [{ startTime: singleStartTime, endTime: singleEndTime }];
    }
  }

  if (!club_id || !venue_ids || !Array.isArray(venue_ids) || venue_ids.length === 0 || !timeSlots || timeSlots.length === 0 || !bookingName || bookingName.trim().length === 0) {
    return res.status(400).json({ error: 'Missing required fields. Booking Name is mandatory.' });
  }

  if (bookingMode === 'event' && !event_id) {
    return res.status(400).json({ error: 'Event selection is mandatory for an event booking.' });
  }

  try {
    let event_name = bookingName.trim();
    let event_type = 'meet';

    if (bookingMode === 'event') {
      const { rows: fetchedEventRows } = await db.query(
        'SELECT name, event_type FROM events WHERE id = $1',
        [event_id]
      );

      if (fetchedEventRows.length === 0) {
        return res.status(404).json({ error: 'Selected event not found.' });
      }

      event_name = fetchedEventRows[0].name;
      event_type = fetchedEventRows[0].event_type;
    }

    // Admin endpoint bypasses co-curricular limits.

    const { randomUUID } = await import('crypto');
    const batchId = randomUUID();
    const createdBookings = [];
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        'SELECT id FROM venues WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [venue_ids]
      );

      for (const slot of timeSlots) {
        const { conflict, message } = await performVenueConflictCheck(
          venue_ids,
          slot.startTime,
          slot.endTime,
          undefined,
          client
        );
        if (conflict) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: message });
        }
      }

      for (const slot of timeSlots) {
        for (const venueId of venue_ids) {
          const { rows } = await client.query(`
            WITH inserted AS (
              INSERT INTO bookings (club_id, venue_id, start_time, end_time, expected_attendees, status, batch_id, event_id, booking_name)
              VALUES ($1, $2, $3, $4, $5, 'approved', $6, $7, $8)
              RETURNING *
            )
            SELECT i.*,
                   e.name AS event_name,
                   e.event_type,
                   jsonb_build_object('name', c.name) AS clubs,
                   jsonb_build_object('name', v.name) AS venues
            FROM inserted i
            LEFT JOIN clubs c ON i.club_id = c.id
            LEFT JOIN venues v ON i.venue_id = v.id
            LEFT JOIN events e ON i.event_id = e.id
          `, [club_id, venueId, slot.startTime, slot.endTime, expected_attendees || 0, batchId, event_id, bookingName.trim()]);

          createdBookings.push(rows[0]);
        }
      }

      await client.query('COMMIT');
    } catch (txErr: any) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    invalidatePublicBookings();

    await createNotification({
      type: 'booking_approved',
      title: 'Booking Created by Admin',
      message: `"${bookingName.trim()}" has been created and auto-approved.`,
      userId: createdBookings[0]?.user_id || null,
      metadata: { batchId, venues: venue_ids },
    });


    io.emit('events:updated');
    io.to(`club:${club_id}`).emit('booking:status_changed', {
      bookingId: createdBookings[0].id,
      status: 'approved',
      eventName: event_name,
      clubId: club_id,
    });

    return res.status(201).json(createdBookings);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    // Run all count queries simultaneously using Promise.all
    const [pendingRes, scheduledRes, clubsRes, pendingEventsRes, scheduledEventsRes] = await Promise.all([
      db.query("SELECT COUNT(*) FROM bookings WHERE status = 'pending'"),
      db.query("SELECT COUNT(*) FROM bookings WHERE status = 'approved'"),
      db.query("SELECT COUNT(*) FROM clubs"),
      db.query("SELECT COUNT(*) FROM events WHERE status = 'pending'"),
      db.query("SELECT COUNT(*) FROM events WHERE status = 'active'")
    ]);

    return res.json({
      pendingBookings: parseInt(pendingRes.rows[0].count, 10) || 0,
      scheduledBookings: parseInt(scheduledRes.rows[0].count, 10) || 0,
      conflicts: 0, 
      activeClubs: parseInt(clubsRes.rows[0].count, 10) || 0,
      pendingEvents: parseInt(pendingEventsRes.rows[0].count, 10) || 0,
      scheduledEvents: parseInt(scheduledEventsRes.rows[0].count, 10) || 0
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/clubs', async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT id, name, email, group_category, organization_type, member_tag FROM clubs ORDER BY name ASC');
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/clubs/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, group_category, organization_type, member_tag } = req.body;

  try {
    const clubRes = await db.query('SELECT email FROM clubs WHERE id = $1', [id]);
    if (clubRes.rows.length === 0) return res.status(404).json({ error: 'Club not found' });
    const oldEmail = clubRes.rows[0].email;

    const updateFields: Record<string, any> = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (group_category !== undefined) updateFields.group_category = group_category;
    if (organization_type !== undefined) updateFields.organization_type = organization_type;
    if (member_tag !== undefined) updateFields.member_tag = member_tag;

    if (Object.keys(updateFields).length === 0) return res.status(400).json({ error: 'No fields to update' });

    const keys = Object.keys(updateFields);
    const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = Object.values(updateFields);
    values.push(id);

    const { rows } = await db.query(`UPDATE clubs SET ${setString} WHERE id = $${values.length} RETURNING *`, values);
    
    invalidateClubs();
    
    // Cascade email update to profiles and auth.users so login continues to work
    if (email && email !== oldEmail) {
       await db.query('UPDATE profiles SET email = $1 WHERE email = $2', [email, oldEmail]);
       await db.query('UPDATE auth.users SET email = $1 WHERE email = $2', [email, oldEmail]);
    }

    return res.json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/clubs/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const clubRes = await db.query('SELECT id, email FROM clubs WHERE id = $1 LIMIT 1', [id]);
    const club = clubRes.rows[0];
    if (!club) return res.status(404).json({ error: 'Club not found' });

    // Enforce proper deletion order to respect Foreign Key constraints
    await db.query('DELETE FROM bookings WHERE club_id = $1', [id]);
    await db.query('DELETE FROM clubs WHERE id = $1', [id]);
    invalidateClubs();
    invalidatePublicBookings();

    const profileRes = await db.query('SELECT id FROM profiles WHERE email = $1', [club.email]);
    if (profileRes.rows.length > 0) {
      const profileId = profileRes.rows[0].id;
      await db.query('DELETE FROM profiles WHERE id = $1', [profileId]);
      
      // Delete from auth.users (Replaces supabase.auth.admin.deleteUser)
      await db.query('DELETE FROM auth.users WHERE id = $1', [profileId]);
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/clubs/:id/bookings', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(`
      ${baseBookingQuery}
      WHERE b.club_id = $1
      ORDER BY b.start_time DESC
    `, [id]);
    
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/clubs/:id/events', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(`
      SELECT 
        e.*,
        COALESCE(e.end_date, e.date) as dynamic_end_date,
        c.name as club_name,
        c.email as club_email
      FROM events e
      LEFT JOIN clubs c ON e.club_id = c.id
      WHERE e.club_id = $1
      ORDER BY e.date DESC
    `, [id]);
    
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/club-members/all', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT cm.id, cm.club_id, cm.full_name, cm.roll_number, cm.email, cm.designation, cm.phone,
             cm.tenure_start_date, cm.tenure_end_date, cm.tenure_end_reason, cm.promotion_history, c.name as club_name
      FROM club_members cm
      JOIN clubs c ON cm.club_id = c.id
      ORDER BY c.name ASC,
               CASE 
                 WHEN cm.designation = 'Convener' THEN 1
                 WHEN cm.designation = 'Dy. Convener' THEN 2
                 WHEN cm.designation = 'Core' THEN 3
                 ELSE 4
               END ASC,
               cm.full_name ASC
    `);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/venues', async (req, res) => {
  const { name, category, capacity, location, is_active } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'Name and category are required' });
  }
  try {
    const { rows } = await db.query(
      'INSERT INTO venues (name, category, capacity, location, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, category, capacity || null, location || null, is_active !== undefined ? Boolean(is_active) : true]
    );
    invalidateVenues();
    return res.status(201).json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/venues/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, capacity, location, is_active } = req.body;

  const updateFields: Record<string, any> = {};
  if (name !== undefined) updateFields.name = name;
  if (category !== undefined) updateFields.category = category;
  if (capacity !== undefined) updateFields.capacity = capacity;
  if (location !== undefined) updateFields.location = location;
  if (is_active !== undefined) updateFields.is_active = Boolean(is_active);

  if (Object.keys(updateFields).length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    const keys = Object.keys(updateFields);
    const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = Object.values(updateFields);
    values.push(id);

    const { rows } = await db.query(`UPDATE venues SET ${setString} WHERE id = $${values.length} RETURNING *`, values);
    
    if (rows.length === 0) throw new Error('Venue not found');
    invalidateVenues();
    return res.json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/venues/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query('SELECT * FROM venues WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Venue not found' });

    // Ensure we don't violate constraints if we shouldn't delete venues with active bookings
    // But since ON DELETE CASCADE is set on bookings.venue_id, deleting a venue will delete its bookings!
    // We should probably check if there are any active bookings first.
    const activeBookings = await db.query("SELECT id FROM bookings WHERE venue_id = $1 AND status != 'rejected' AND end_time > NOW()", [id]);
    if (activeBookings.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete a venue with active or upcoming bookings' });
    }

    await db.query('DELETE FROM venues WHERE id = $1', [id]);
    invalidateVenues();
    invalidatePublicBookings();
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;