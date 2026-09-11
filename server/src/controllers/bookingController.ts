import type { Request, Response } from 'express';
// Swap Supabase for your database pool
import { db } from '../db';
import type { PoolClient } from 'pg';

import { randomUUID } from 'crypto';
import { invalidatePublicBookings } from '../cache';
import { io } from '../server';
import { checkPendingEventReports } from '../services/eventReportService';
import { createBookingPendingNotifications } from '../services/notification';

type EventType = 'co_curricular' | 'open_all' | 'closed_club' | 'meet';

type BookingRequestBody = {
  clubId: string;
  venueIds: string[];
  startTime: string;
  endTime: string;
  expectedAttendees?: number;
  event_id?: string;
  permissionsLink?: string;
  bookingMode?: 'event' | 'meet';
  bookingName?: string;
};

const MIN_DAYS_BY_EVENT: Record<EventType, number> = {
  co_curricular: 14,
  open_all: 20,
  closed_club: 0,
  meet: 0,
};

const isValidDate = (value: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const RESTRICTED_START_MINUTES = 8 * 60; // 8:00 AM
const RESTRICTED_END_MINUTES = 19 * 60; // 7:00 PM

const violatesRestrictedWeekdayHours = (startUtc: Date, endUtc: Date) => {
  const startIst = new Date(startUtc.getTime() + IST_OFFSET_MS);
  const endIst = new Date(endUtc.getTime() + IST_OFFSET_MS);

  const cursor = new Date(startIst);
  cursor.setUTCHours(0, 0, 0, 0);

  const lastDay = new Date(endIst);
  lastDay.setUTCHours(0, 0, 0, 0);

  while (cursor <= lastDay) {
    const dayOfWeek = cursor.getUTCDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isWeekday) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(cursor);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const segmentStart = startIst > dayStart ? startIst : dayStart;
      const segmentEnd = endIst < dayEnd ? endIst : dayEnd;

      if (segmentEnd > segmentStart) {
        const segmentStartMinutes = (segmentStart.getTime() - dayStart.getTime()) / 60000;
        const segmentEndMinutes = (segmentEnd.getTime() - dayStart.getTime()) / 60000;

        const overlapsRestrictedHours =
          segmentStartMinutes < RESTRICTED_END_MINUTES &&
          segmentEndMinutes > RESTRICTED_START_MINUTES;

        if (overlapsRestrictedHours) {
          return true;
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return false;
};


// NOTE: `queryable` defaults to the shared pool (`db`) for backwards
// compatibility with existing callers (e.g. checkConflict, getBusyVenues),
// but createBooking and updateBookingTimings now pass in a transaction
// client so the conflict check participates in the same transaction as
// the row lock + insert/update, closing the race condition.

export const performVenueConflictCheck = async (
  venueIds: string[],
  startTime: string,
  endTime: string,
  excludeIds?: string[],
  queryable: PoolClient | typeof db = db
) => {
  if (!venueIds || venueIds.length === 0) return { conflict: false, message: '', conflictingVenueIds: [] as string[] };

  let query = `
    SELECT b.venue_id, v.name AS venue_name, c.name AS club_name
    FROM bookings b
    LEFT JOIN venues v ON b.venue_id = v.id
    LEFT JOIN clubs c ON b.club_id = c.id
    WHERE b.status != 'rejected'
      AND b.venue_id = ANY($1::uuid[])
      AND b.start_time < $2
      AND b.end_time > $3
  `;
  const params: any[] = [venueIds, endTime, startTime];

  if (excludeIds && excludeIds.length > 0) {
    query += ` AND b.id != ANY($4::uuid[])`;
    params.push(excludeIds);
  }

  // Check for ANY booking that overlaps with the requested time for ANY of the requested venues
  const { rows: conflicts } = await queryable.query(query, params);

  if (conflicts.length > 0) {
    const conflictingVenueIds = [...new Set(conflicts.map((c: any) => c.venue_id as string))];
    // Get unique venue names that have conflicts
    const conflictingVenueNames = [...new Set(conflicts.map((c: any) => `${c.venue_name || 'Unknown Venue'} (by ${c.club_name || 'Unknown Club'})`))];
    return {
      conflict: true,
      conflictingVenueIds,
      message: `Conflict: The following venues are already booked during this time: ${conflictingVenueNames.join(', ')}`
    };
  }

  return { conflict: false, message: '', conflictingVenueIds: [] as string[] };
};

export const createBooking = async (req: Request, res: Response) => {
  const {
    clubId,
    venueIds,
    startTime: singleStartTime,
    endTime: singleEndTime,
    timeSlots: reqTimeSlots,
    expectedAttendees,
    event_id,
    permissionsLink,
    bookingMode = 'event',
    bookingName,
  } = req.body as Partial<BookingRequestBody & { venueIds: string[]; timeSlots?: {startTime: string, endTime: string}[] }>;

  let timeSlots = reqTimeSlots;
  if (!timeSlots) {
    if (singleStartTime && singleEndTime) {
      timeSlots = [{ startTime: singleStartTime, endTime: singleEndTime }];
    }
  }

  if (!clubId || !venueIds || !Array.isArray(venueIds) || venueIds.length === 0 || !timeSlots || timeSlots.length === 0 || !bookingName || bookingName.trim().length === 0) {
    return res.status(400).json({ error: 'Missing required fields. Booking Name is mandatory.' });
  }

  if (bookingMode === 'event' && !event_id) {
    return res.status(400).json({ error: 'Event selection is mandatory for formal events.' });
  }

  let eventName = bookingName.trim();
  let eventType: EventType = 'meet';

  if (bookingMode === 'event') {
    // Fetch event details
    const { rows: fetchedEventRows } = await db.query(
      'SELECT name, event_type, status, date, end_date FROM events WHERE id = $1',
      [event_id]
    );

    if (fetchedEventRows.length === 0) {
      return res.status(404).json({ error: 'Selected event not found.' });
    }

    if (fetchedEventRows[0].status !== 'active') {
      return res.status(400).json({ error: 'Cannot link a booking to an unapproved event.' });
    }

    eventName = fetchedEventRows[0].name;
    eventType = fetchedEventRows[0].event_type as EventType;

    const eventEnd = new Date(fetchedEventRows[0].end_date || fetchedEventRows[0].date);

    if (eventEnd.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Cannot create bookings for an event that has already concluded.' });
    }

    for (const slot of timeSlots) {
      const slotEnd = new Date(slot.endTime);

      if (slotEnd > eventEnd) {
        return res.status(400).json({
          error: `Cannot book venue slot after the event ends. Event ends at ${eventEnd.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`
        });
      }
    }
  }

  if (!Object.keys(MIN_DAYS_BY_EVENT).includes(eventType)) {
    return res.status(400).json({ error: 'Invalid eventType' });
  }

  for (const slot of timeSlots) {
    if (!isValidDate(slot.startTime) || !isValidDate(slot.endTime)) {
      return res.status(400).json({ error: 'Invalid startTime or endTime in time slots' });
    }
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    if (end <= start) {
      return res.status(400).json({ error: 'endTime must be after startTime' });
    }
  }

  const earliestStart = new Date(Math.min(...timeSlots.map(s => new Date(s.startTime).getTime())));
  let issueFlag: string | null = null;

  const violatesRestricted = timeSlots.some(slot => violatesRestrictedWeekdayHours(new Date(slot.startTime), new Date(slot.endTime)));
  if (violatesRestricted) {
    issueFlag = 'Violates restricted weekday hours (8:00 AM - 7:00 PM IST)';
  }

  const daysGap = (earliestStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  const requiredDays = MIN_DAYS_BY_EVENT[eventType];
  if (daysGap < requiredDays) {
    const gapMsg = `Short notice booking (${Math.floor(daysGap)} days advance). Requires ${requiredDays} days advance notice.`;
    if (!issueFlag) {
      issueFlag = gapMsg;
    } else {
      issueFlag += ` | ${gapMsg}`;
    }
  }

  const client = await db.connect();
  let released = false;
  try {
    await client.query('BEGIN');

    // Lock target venue rows to serialize concurrent booking requests for the same venue(s)
    const { rows: venues } = await client.query(
      'SELECT id, category, name, is_active FROM venues WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
      [venueIds]
    );

    if (venues.length !== venueIds.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'One or more venues not found' });
    }

    const inactiveVenues = venues.filter((v: any) => v.is_active === false);
    if (inactiveVenues.length > 0) {
      await client.query('ROLLBACK');
      const names = inactiveVenues.map((v: any) => v.name).join(', ');
      return res.status(400).json({ error: `The following venue(s) are currently disabled for booking: ${names}` });
    }

    const { rows: clubRows } = await client.query(
      'SELECT id, name FROM clubs WHERE id = $1',
      [clubId]
    );
    const club = clubRows[0];

    if (!club) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Club not found' });
    }

    const { blocked, message: blockMessage } = await checkPendingEventReports(clubId);
    if (blocked) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: blockMessage });
    }

    if (!req.user) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'admin') {
      const { rows: requesterRows } = await client.query(
        'SELECT id FROM clubs WHERE email = $1',
        [req.user.email]
      );
      const requesterClub = requesterRows[0];

      if (!requesterClub) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Unable to resolve your club ownership' });
      }

      if (requesterClub.id !== clubId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'You are not allowed to create bookings for another club' });
      }
    }

    // IMPORTANT: performVenueConflictCheck() must always run AFTER the FOR UPDATE lock,
    // never before. The lock is what forces concurrent requests to wait, so
    // moving the conflict check earlier would silently reopen the race
    // condition this fix is meant to close.
    for (const slot of timeSlots) {
      const { conflict: venueConflict, message: venueMessage } = await performVenueConflictCheck(
        venueIds,
        slot.startTime,
        slot.endTime,
        undefined,
        client
      );
      if (venueConflict) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: venueMessage });
      }
    }

    const createdBookings: any[] = [];
    const batchId = (req.body as any).batchId || randomUUID();

    for (const slot of timeSlots) {
      for (const venue of venues) {
        let status: 'approved' | 'pending' = 'pending';
        if (issueFlag) {
          status = 'pending';
        } else if (venue.category === 'auto_approval') {
          status = 'approved';
        } else if (venue.category === 'needs_approval') {
          status = 'pending';
        }

        const { rows: insertRows } = await client.query(`
          INSERT INTO bookings (club_id, venue_id, start_time, end_time, status, user_id, expected_attendees, batch_id, event_id, issue_flag, permissions_link, booking_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id, venue_id, start_time, end_time, status
        `, [
          clubId,
          venue.id,
          slot.startTime,
          slot.endTime,
          status,
          req.user?.id || null,
          expectedAttendees || null,
          batchId,
          bookingMode === 'event' ? event_id : null,
          issueFlag,
          permissionsLink || null,
          bookingName!.trim()
        ]);

        if (insertRows.length === 0) {
          throw new Error(`Failed to insert booking for venue ${venue.name}`);
        }

        createdBookings.push(insertRows[0]);
      }
    }

    await client.query('COMMIT');
    client.release();
    released = true;

    invalidatePublicBookings();

    try {
      const pendingForEmail = createdBookings.filter((b) => b.status === 'pending');
      if (pendingForEmail.length > 0) {
        const formatTime = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });


        const itemsForNotification = pendingForEmail.map((b) => {
          const venue = venues.find((v) => v.id === b.venue_id);
          return {
            venueName: venue?.name ?? b.venue_id,
            eventName: eventName,
            startTime: formatTime(b.start_time),
            endTime: formatTime(b.end_time),
            clubName: club?.name,
            eventType,
          };
        });

        await createBookingPendingNotifications(itemsForNotification);

        const adminEmail = process.env.APPROVAL_SMTP_USER;
        if (adminEmail) {
          const { sendPendingBookingEmailToAdmin } = await import('../services/email/index');
          await sendPendingBookingEmailToAdmin(adminEmail, itemsForNotification);
        }

        io.to('admin').emit('booking:pending', {
          eventName,
          clubName: club.name,
          venueNames: venues.map(v => v.name).join(', '),
          batchId,
          clubId,
        });
      }

      const approvedBookings = createdBookings.filter((b) => b.status === 'approved');
      if (approvedBookings.length > 0) {
        io.to(`club:${clubId}`).emit('booking:status_changed', {
          bookingId: approvedBookings[0].id,
          status: 'approved',
          eventName,
          clubId,
        });
        io.emit('events:updated');

        const { sendBulkBookingProcessedEmail } = await import('../services/email');
        const clubEmailRows = await db.query('SELECT email FROM clubs WHERE id = $1', [clubId]);
        const clubEmail = clubEmailRows.rows[0]?.email;

        if (clubEmail) {
          const approvedVenues = approvedBookings.map((b) => {
            const venue = venues.find((v) => v.id === b.venue_id);
            return venue?.name || 'Venue';
          });

          const date = new Date(approvedBookings[0].start_time).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
          const startStr = new Date(approvedBookings[0].start_time).toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit', minute: '2-digit' });
          const endStr = new Date(approvedBookings[0].end_time).toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit', minute: '2-digit' });

          await sendBulkBookingProcessedEmail(
            clubEmail,
            eventName,
            date,
            startStr,
            endStr,
            approvedVenues,
            []
          );
        }
      }
    } catch (notifyErr) {
      console.error('Post-booking notifications failed:', notifyErr);
    }

    return res.status(201).json(createdBookings);
  } catch (err) {
    if (!released) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors so we surface the original failure
      }
    }
    console.error('Create booking failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  } finally {
    if (!released) {
      client.release();
    }
  }
};

export const checkConflict = async (req: Request, res: Response) => {
  const clubId = (req.body.clubId || req.query.clubId) as string;
  let timeSlots = req.body.timeSlots;

  if (!timeSlots) {
    const startTime = (req.body.startTime || req.query.startTime) as string;
    const endTime = (req.body.endTime || req.query.endTime) as string;
    if (startTime && endTime) {
      timeSlots = [{ startTime, endTime }];
    }
  }

  if (typeof timeSlots === 'string') {
    try {
      timeSlots = JSON.parse(timeSlots);
    } catch (e) {}
  }

  const venueIdsInput = req.body.venueIds || req.query.venueIds;

  let finalVenueIds: string[] = [];
  if (venueIdsInput) {
    if (Array.isArray(venueIdsInput)) {
      finalVenueIds = venueIdsInput as string[];
    } else if (typeof venueIdsInput === 'string') {
      finalVenueIds = venueIdsInput.split(',');
    }
  }

  if (!clubId || !timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    if (finalVenueIds.length > 0) {
      const allBusyVenueIds = new Set<string>();
      let firstConflictMessage = '';

      for (const slot of timeSlots) {
        const { conflict: venueConflict, message: venueMessage, conflictingVenueIds } = await performVenueConflictCheck(finalVenueIds, slot.startTime, slot.endTime);
        if (venueConflict) {
          if (!firstConflictMessage) firstConflictMessage = venueMessage;
          conflictingVenueIds?.forEach(id => allBusyVenueIds.add(id));
        }
      }

      if (allBusyVenueIds.size > 0) {
        return res.json({
          hasConflict: true,
          message: firstConflictMessage,
          busyVenueIds: Array.from(allBusyVenueIds)
        });
      }
    }

    return res.json({ hasConflict: false, message: '', busyVenueIds: [] });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
};


export const getBusyVenues = async (req: Request, res: Response) => {
  const startTime = req.query.startTime as string;
  const endTime = req.query.endTime as string;

  console.log('[getBusyVenues] Request:', { startTime, endTime });

  if (!startTime || !endTime) {
    return res.status(400).json({ error: 'startTime and endTime are required' });
  }

  try {
    const { rows: conflicts } = await db.query(`
      SELECT DISTINCT venue_id
      FROM bookings
      WHERE status != 'rejected'
        AND start_time < $1
        AND end_time > $2
    `, [endTime, startTime]);

    const busyVenueIds = conflicts.map((c: any) => c.venue_id);
    console.log('[getBusyVenues] Results:', busyVenueIds);

    return res.json(busyVenueIds);
  } catch (err) {
    console.error('[getBusyVenues] Unexpected Error:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
};

export const updateBookingTimings = async (req: Request, res: Response) => {
  const { batchId } = req.params;
  const { startTime, endTime } = req.body;

  if (!startTime || !endTime) {
    return res.status(400).json({ error: 'startTime and endTime are required' });
  }
  if (!isValidDate(startTime) || !isValidDate(endTime)) {
    return res.status(400).json({ error: 'Invalid startTime or endTime' });
  }
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (end <= start) {
    return res.status(400).json({ error: 'endTime must be after startTime' });
  }

  try {
    const isAdmin = req.user?.role === 'admin';
    let clubId: string | undefined;

    if (!isAdmin) {
      const clubResult = await db.query(
        'SELECT id FROM clubs WHERE email = $1 LIMIT 1',
        [req.user?.email]
      );

      if (clubResult.rows.length === 0) {
        return res.status(404).json({ error: 'Club not found for this account' });
      }
      clubId = clubResult.rows[0].id;
    }

    const bookingRes = isAdmin
      ? await db.query('SELECT id, venue_id, status, event_id FROM bookings WHERE (batch_id = $1 OR id = $1)', [batchId])
      : await db.query('SELECT id, venue_id, status, event_id FROM bookings WHERE (batch_id = $1 OR id = $1) AND club_id = $2', [batchId, clubId]);

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Bookings not found' });
    }

    const bookingIds = bookingRes.rows.map((b: any) => b.id);
    const venueIds = bookingRes.rows.map((b: any) => b.venue_id);
    const eventId = bookingRes.rows[0].event_id;

    // Fetch event type and validate timeframe — for meets (no event_id), it's implicitly closed_club
    let eventType: EventType | null = null;
    if (!eventId) {
      eventType = 'closed_club';
    } else if (eventId) {
      const { rows: eventRows } = await db.query('SELECT event_type, date, end_date FROM events WHERE id = $1', [eventId]);
      if (eventRows.length > 0) {
        eventType = eventRows[0].event_type as EventType;
        const eventEnd = new Date(eventRows[0].end_date || eventRows[0].date);
        const newEnd = new Date(endTime);

        if (newEnd > eventEnd) {
          return res.status(400).json({
            error: `Cannot update booking timing after the event ends (${eventEnd.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}).`
          });
        } 
      }
    }

    if (!eventType || !Object.keys(MIN_DAYS_BY_EVENT).includes(eventType)) {
      return res.status(400).json({ error: 'Invalid or missing event type for booking' });
    }

    // Constraint evaluation
    const earliestStart = new Date(startTime);
    let issueFlag: string | null = null;

    if (!isAdmin) {
      const violatesRestricted = violatesRestrictedWeekdayHours(new Date(startTime), new Date(endTime));
      if (violatesRestricted) {
        issueFlag = 'Violates restricted weekday hours (8:00 AM - 7:00 PM IST)';
      }

      const daysGap = (earliestStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      const requiredDays = MIN_DAYS_BY_EVENT[eventType];
      if (daysGap < requiredDays) {
        const gapMsg = `Short notice booking (${Math.floor(daysGap)} days advance). Requires ${requiredDays} days advance notice.`;
        if (!issueFlag) {
          issueFlag = gapMsg;
        } else {
          issueFlag += ` | ${gapMsg}`;
        }
      }
    }

    // Same fix applied here: this endpoint has the identical check-then-write
    // shape (performVenueConflictCheck, then separate UPDATE queries), so it
    // gets the same transaction + row-lock treatment to avoid a concurrent
    // update racing past the conflict check.
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // IMPORTANT: performVenueConflictCheck() must always run AFTER this lock,
      // never before — see the same note in createBooking().
      await client.query(
        'SELECT id FROM venues WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [venueIds]
      );

      const { conflict, message } = await performVenueConflictCheck(
        venueIds,
        startTime,
        endTime,
        bookingIds,
        client
      );
      if (conflict) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: message });
      }

      const { rows: venues } = await client.query('SELECT id, category FROM venues WHERE id = ANY($1::uuid[])', [venueIds]);

      for (const booking of bookingRes.rows) {
        let newStatus = 'pending';
        const venue = venues.find((v: any) => v.id === booking.venue_id);

        if (issueFlag) {
          newStatus = 'pending';
        } else if (venue && venue.category === 'auto_approval') {
          newStatus = 'approved';
        } else {
          newStatus = 'pending';
        }

        await client.query(`
          UPDATE bookings
          SET start_time = $1, end_time = $2, status = $3, issue_flag = $4
          WHERE id = $5
        `, [startTime, endTime, newStatus, issueFlag, booking.id]);
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    io.emit('events:updated');
    invalidatePublicBookings();

    return res.json({ success: true });
  } catch (err: any) {
    console.error('Update timings failed:', err);
    return res.status(500).json({ error: err.message });
  }
};