import express from 'express';
import { cache, CACHE_KEYS, invalidateClubs, invalidatePublicBookings } from '../cache';
import { checkConflict, createBooking, updateBookingTimings, getBusyVenues } from '../controllers/bookingController';
import { db, withTransaction } from '../db';
import authMiddleware from '../middleware/auth';
import { io } from '../server';
import { CO_CURRICULAR_LIMIT, countCoCurricularBookings, getSemesterRange } from '../services/semesterUtils';


const router = express.Router();

router.get('/venues', async (_req, res) => {
  try {
    const cachedVenues = cache.get(CACHE_KEYS.venues);
    if (cachedVenues) return res.json(cachedVenues);

    const { rows } = await db.query('SELECT id, name, category, capacity, location, is_active FROM venues ORDER BY name ASC');
    cache.set(CACHE_KEYS.venues, rows);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/clubs', async (_req, res) => {
  try {
    const cachedClubs = cache.get(CACHE_KEYS.clubs);
    if (cachedClubs) return res.json(cachedClubs);

    const { rows } = await db.query('SELECT id, name, organization_type, group_category, logo_url, member_tag, logo_bg, description, key_activities, linkedin_url, instagram_url, youtube_url, website_url, email FROM clubs ORDER BY name ASC');
    cache.set(CACHE_KEYS.clubs, rows);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/clubs/stats', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT organization_type, COUNT(*)::int as count
      FROM clubs
      WHERE organization_type != 'other'
      GROUP BY organization_type
    `);
    const stats: Record<string, number> = { 
      club: 0, committee: 0, organisation: 0, 
      total_activities: 0,
      members_club: 0, members_committee: 0, members_organisation: 0
    };
    for (const row of rows) {
      stats[row.organization_type] = row.count;
    }

    const { rows: memberRows } = await db.query(`
      SELECT c.organization_type, COUNT(cm.id)::int as member_count
      FROM club_members cm
      JOIN clubs c ON cm.club_id = c.id
      WHERE c.organization_type != 'other'
      GROUP BY c.organization_type
    `);
    for (const row of memberRows) {
      stats[`members_${row.organization_type}`] = row.member_count;
    }

    const { rows: activityRows } = await db.query(`
      SELECT COUNT(*)::int as count 
      FROM events
      WHERE (event_type = 'co_curricular' OR event_type = 'open_all')
        AND COALESCE(end_date, date) < NOW()
        AND date >= CURRENT_DATE - INTERVAL '1 year'
    `);
    if (activityRows.length > 0) {
      stats.total_activities = activityRows[0].count;
    }

    return res.json(stats);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/clubs/my-club', authMiddleware, async (req, res) => {
  if (req.user?.role !== 'club') {
    return res.status(403).json({ error: 'Only club accounts can fetch their details' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, name, organization_type, group_category, logo_url, member_tag, logo_bg, description, key_activities, linkedin_url, instagram_url, youtube_url, website_url, email FROM clubs WHERE email = $1 LIMIT 1',
      [req.user.email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Club not found for this account' });
    }

    return res.json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/clubs/my-club', authMiddleware, async (req, res) => {
  if (req.user?.role !== 'club') {
    return res.status(403).json({ error: 'Only club accounts can edit their about section' });
  }

  const { description, key_activities, linkedin_url, instagram_url, youtube_url, website_url, logo_url, member_tag, logo_bg } = req.body;

  try {
    const clubResult = await db.query(
      'SELECT id FROM clubs WHERE email = $1 LIMIT 1',
      [req.user.email]
    );

    if (clubResult.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found for this account' });
    }

    const clubId = clubResult.rows[0].id;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldsToUpdate = {
      description,
      key_activities,
      linkedin_url,
      instagram_url,
      youtube_url,
      website_url,
      logo_url,
      member_tag,
      logo_bg
    };

    for (const [key, value] of Object.entries(fieldsToUpdate)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value === '' ? null : value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(clubId);

    const { rows } = await db.query(
      `UPDATE clubs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, organization_type, group_category, logo_url, member_tag, logo_bg, description, key_activities, linkedin_url, instagram_url, youtube_url, website_url, email`,
      values
    );

    invalidateClubs();

    return res.json(rows[0]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/my-bookings', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    //  Find the club associated with this user's email
    const clubResult = await db.query(
      'SELECT id FROM clubs WHERE email = $1 LIMIT 1',
      [req.user.email]
    );

    const queryStr = `
      SELECT b.id, b.club_id, b.venue_id, b.start_time, b.end_time, b.status, b.user_id, b.expected_attendees, b.batch_id, b.event_id, b.issue_flag, b.permissions_link, b.booking_name, b.created_at, b.updated_at,
             e.name AS event_name,
             COALESCE(e.event_type, 'closed_club') AS event_type,
             jsonb_build_object('name', c.name) AS clubs,
             jsonb_build_object('name', v.name) AS venues
      FROM bookings b
      LEFT JOIN clubs c ON b.club_id = c.id
      LEFT JOIN venues v ON b.venue_id = v.id
      LEFT JOIN events e ON b.event_id = e.id
      WHERE $1 = $2
      ORDER BY b.start_time DESC
    `;

    if (clubResult.rows.length === 0) {
      // Fallback: fetch by user_id if no club account found
      const { rows } = await db.query(
        queryStr.replace('$1 = $2', 'b.user_id = $1'),
        [req.user.id]
      );
      return res.json(rows);
    }

    // Fetch all bookings for this club
    const club = clubResult.rows[0];
    const { rows } = await db.query(
      queryStr.replace('$1 = $2', 'b.club_id = $1'), 
      [club.id]
    );
    
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/my-bookings/:id', authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const isAdmin = req.user.role === 'admin';
    let clubId: string | undefined;

    if (!isAdmin) {
      const clubResult = await db.query(
        'SELECT id FROM clubs WHERE email = $1 LIMIT 1',
        [req.user.email]
      );

      if (clubResult.rows.length === 0) {
        return res.status(404).json({ error: 'Club not found for this account' });
      }

      clubId = clubResult.rows[0].id;
    }

    const checkRes = isAdmin
      ? await db.query('SELECT id, status, start_time FROM bookings WHERE id = $1', [id])
      : await db.query('SELECT id, status, start_time FROM bookings WHERE id = $1 AND club_id = $2', [id, clubId]);

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or not owned by you' });
    }
    
    const booking = checkRes.rows[0];
    if (!isAdmin && booking.status !== 'rejected' && new Date(booking.start_time) <= new Date()) {
      return res.status(400).json({ error: 'Cannot cancel a booking after its start time has passed.' });
    }
    
    await withTransaction(async (client) => {
      await client.query(`
        INSERT INTO archived_bookings (
          id, club_id, venue_id, start_time, end_time, status, user_id, 
          event_name, event_type, expected_attendees, batch_id, event_id, 
          created_at, updated_at, booking_name
        )
        SELECT 
          b.id, b.club_id, b.venue_id, b.start_time, b.end_time, b.status, b.user_id,
          COALESCE(b.booking_name, e.name, 'Club Meeting'),
          COALESCE(e.event_type, 'closed_club'),
          b.expected_attendees, b.batch_id, b.event_id,
          b.created_at, b.updated_at,
          COALESCE(b.booking_name, e.name, 'Club Meeting')
        FROM bookings b
        LEFT JOIN events e ON b.event_id = e.id
        WHERE b.id = $1
        ON CONFLICT (id) DO UPDATE SET
          archived_at = NOW(),
          booking_name = EXCLUDED.booking_name,
          event_name = EXCLUDED.event_name
      `, [id]);

      await client.query('DELETE FROM bookings WHERE id = $1', [id]);
    });

    invalidatePublicBookings();
    io.emit('events:updated');

    return res.json({ success: true, message: 'Booking deleted and archived successfully' });
  } catch (err: any) {
    console.error('Error deleting booking:', err);
    return res.status(500).json({ error: 'Failed to delete booking' });
  }
});

router.patch('/my-bookings/:batchId/timings', authMiddleware, updateBookingTimings);

router.get('/bookings/check-conflict', authMiddleware, checkConflict);
router.post('/bookings/check-conflict', authMiddleware, checkConflict);

router.get('/busy-venues', authMiddleware, getBusyVenues);

router.post('/bookings', authMiddleware, createBooking);

router.get('/public-bookings', async (_req, res) => {
  try {
    const cacheKey = CACHE_KEYS.publicBookings;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const { rows } = await db.query(`
      SELECT b.id, b.club_id, b.venue_id, b.start_time, b.end_time, b.status, b.user_id, b.expected_attendees, b.batch_id, b.event_id, b.issue_flag, b.permissions_link, b.booking_name, b.created_at, b.updated_at,
             e.name AS event_name,
             COALESCE(e.event_type, 'closed_club') AS event_type,
             jsonb_build_object('name', c.name) AS clubs,
             jsonb_build_object('name', v.name) AS venues
      FROM bookings b
      LEFT JOIN clubs c ON b.club_id = c.id
      LEFT JOIN venues v ON b.venue_id = v.id
      LEFT JOIN events e ON b.event_id = e.id
      WHERE b.status = 'approved'
        AND b.end_time >= NOW()
        AND e.event_type IS DISTINCT FROM 'closed_club'
      ORDER BY b.start_time ASC
    `);
    
    cache.set(cacheKey, rows);
    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/campus-bookings', authMiddleware, async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT * FROM (
        SELECT b.id, b.club_id, b.venue_id, b.start_time, b.end_time, b.status, b.user_id, b.expected_attendees, b.batch_id, b.event_id, b.issue_flag, b.permissions_link, b.booking_name, b.created_at, b.updated_at,
               e.name AS event_name,
               COALESCE(e.event_type, 'closed_club') AS event_type,
               jsonb_build_object('name', c.name) AS clubs,
               jsonb_build_object('name', v.name) AS venues
        FROM bookings b
        LEFT JOIN clubs c ON b.club_id = c.id
        LEFT JOIN venues v ON b.venue_id = v.id
        LEFT JOIN events e ON b.event_id = e.id
        WHERE b.status = 'pending'
        
        UNION
        
        SELECT b.id, b.club_id, b.venue_id, b.start_time, b.end_time, b.status, b.user_id, b.expected_attendees, b.batch_id, b.event_id, b.issue_flag, b.permissions_link, b.booking_name, b.created_at, b.updated_at,
               e.name AS event_name,
               COALESCE(e.event_type, 'closed_club') AS event_type,
               jsonb_build_object('name', c.name) AS clubs,
               jsonb_build_object('name', v.name) AS venues
        FROM bookings b
        LEFT JOIN clubs c ON b.club_id = c.id
        LEFT JOIN venues v ON b.venue_id = v.id
        LEFT JOIN events e ON b.event_id = e.id
        WHERE b.status = 'approved' AND b.end_time >= NOW() - INTERVAL '90 days'
      ) AS combined
      ORDER BY start_time ASC
    `);

    return res.json(rows);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Returns the co-curricular booking count for a club in the current semester
router.get('/bookings/co-curricular-count', authMiddleware, async (req, res) => {
  let clubId = req.query.clubId as string;
  
  if (!clubId && req.user) {
    const { rows } = await db.query('SELECT id FROM clubs WHERE email = $1', [req.user.email]);
    if (rows.length > 0) {
      clubId = rows[0].id;
    }
  }

  if (!clubId) {
    return res.status(400).json({ error: 'clubId is required or user must be associated with a club' });
  }

  try {
    const { start, end } = getSemesterRange(new Date());
    const count = await countCoCurricularBookings(clubId, start, end);
    return res.json({ count, limit: CO_CURRICULAR_LIMIT });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
