import { Booking, GroupedBooking } from '../types';
import { ApiError, NetworkError } from './errors';

type ApiOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  // In dev, use Vite proxy (same origin) to avoid CORS issues when port changes
  if (import.meta.env.DEV) return '';
  // In prod the backend serves the frontend on the same origin, so use relative URLs
  return '';
};

const getJwtToken = () => {
  return null; // Deprecated: token is now handled via HttpOnly cookie
};

export const apiRequest = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const { method = 'GET', body, auth = false, headers = {} } = options;
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (auth) {
    const token = getJwtToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      credentials: 'include', // Automatically send and receive HttpOnly cookies
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    console.error(`[apiRequest] Network error connecting to ${url}:`, err);
    throw new NetworkError(
      'Unable to reach the backend server. Please check your connection and ensure the server is running.'
    );
  }

  if (!response.ok) {
    let errorMessage = response.statusText; // Default to 'Not Found', 'Bad Request', etc.
    try {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await response.json();
        // Extract the exact error message we wrote in our Express controllers
        errorMessage = errorData.error || errorData.message || errorMessage;
      } else {
        const text = await response.text();
        if (text) errorMessage = text.length > 200 ? text.slice(0, 200) : text;
      }
    } catch {
      // JSON parsing failed, just stick with the statusText
    }
    
    console.error(`[apiRequest] Error ${response.status} from ${url}:`, errorMessage);
    throw new ApiError(errorMessage, response.status);
  }

  // Handle 204 No Content responses safely
  if (response.status === 204) {
    return {} as T;
  }

  try {
    return (await response.json()) as Promise<T>;
  } catch {
    throw new ApiError('Invalid response format from server.', response.status);
  }
};

export type ApiVenue = {
  id: string;
  name: string;
  category: string;
  capacity?: number | null;
  location?: string | null;
  is_active?: boolean;
};

export type ApiClub = {
  id: string;
  name: string;
  group_category: string;
};

export type ApiBooking = {
  id: string;
  event_name: string;
  start_time: string;
  end_time: string;
  status: 'approved' | 'pending' | 'rejected';
  club_id: string;
  venue_id: string;
  clubs?: { name?: string | null } | null;
  venues?: { name?: string | null } | null;
  event_type?: string;
  expected_attendees?: number;
  batch_id?: string;
  is_public?: boolean;
  issue_flag?: string | null;
  event_id?: string;
  permissions_link?: string | null;
  booking_name?: string;
};

export const mapBooking = (booking: ApiBooking) => {
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);

  return {
    id: booking.id,
    eventName: booking.event_name,
    bookingName: booking.booking_name,
    venueId: booking.venue_id,
    venueName: booking.venues?.name || booking.venue_id,
    clubName: booking.clubs?.name || booking.club_id,
    date: start.toISOString(),
    endDate: end.toISOString(),
    startTime: start.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric', minute: '2-digit' }),
    endTime: end.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric', minute: '2-digit' }),
    startTimeISO: booking.start_time,
    endTimeISO: booking.end_time,
    status: booking.status,
    eventType: booking.event_type as any,
    expectedAttendees: booking.expected_attendees,
    batchId: booking.batch_id,
    isPublic: booking.is_public ?? false,
    clubId: booking.club_id,
    issueFlag: booking.issue_flag,
    event_id: booking.event_id,
    permissionsLink: booking.permissions_link,
  };
};

/**
 * Groups multiple single-venue bookings into logical multi-venue events.
 * It combines bookings with the same batchId or (eventName, clubName, date, startTime, and eventType).
 * * @param bookings - The array of individual api bookings
 * @param venues - The array of available venues to resolve venue names
 * @returns An array of GroupedBooking where multi-venue requests are consolidated
 */
export const groupBookings = (bookings: Booking[], venues: ApiVenue[] = []): GroupedBooking[] => {
  const grouped = new Map<string, GroupedBooking>();

  const getVenueName = (id: string, booking: Booking) => {
    const venue = venues.find(v => v.id === id);
    if (venue) return venue.name;
    
    const fallback = (booking as any).venueName || id;
    if (typeof fallback === 'string') {
      return fallback.replace(/,(?=[^\s])/g, ', ');
    }
    return fallback;
  };

  const STATUS_PRIORITY: Record<GroupedBooking['status'], number> = {
    'approved': 4,
    'pending': 3,
    'partial': 2,
    'rejected': 1
  };

  for (const b of bookings) {
    // Group by event_id + startTime (since all bookings now belong to an event), fallback to batchId or composite string.
    const key = (b.event_id && b.startTime && b.date) 
      ? `${b.event_id}-${b.date}-${b.startTime}` 
      : (b.batchId || `${b.bookingName}-${b.clubName}-${b.date}-${b.startTime}-${b.eventType}`);

    if (grouped.has(key)) {
      const existing = grouped.get(key)!;

      // Find if we already have this venue in this group
      const existingVenueIndex = existing.bookings.findIndex(eb => eb.venueId === b.venueId);

      if (existingVenueIndex !== -1) {
        // Status prioritization: only keep the "best" status for a venue in a group
        const existingStatus = existing.bookings[existingVenueIndex].status;
        if (STATUS_PRIORITY[b.status] > STATUS_PRIORITY[existingStatus]) {
          // Replace the inferior booking entry
          const oldBookingId = existing.bookings[existingVenueIndex].id;
          existing.bookings[existingVenueIndex] = b;
          existing.ids = existing.ids.filter(id => id !== oldBookingId).concat(b.id);
        }
        // If the new one is same or worse priority, we just ignore it for the group display
      } else {
        // New venue for this group
        existing.ids.push(b.id);
        existing.venueIds.push(b.venueId);
        existing.bookings.push(b);
      }

      // Re-calculate display venue names from all requested bookings in the group
      existing.venueName = existing.bookings
        .map(book => getVenueName(book.venueId, book))
        .filter((val, idx, self) => self.indexOf(val) === idx)
        .sort((a, b) => a.localeCompare(b))
        .join(', ');

      // Re-calculate combined status
      const statuses = existing.bookings.map(book => book.status);
      const allApproved = statuses.every(s => s === 'approved');
      const allRejected = statuses.every(s => s === 'rejected');
      const allPending = statuses.every(s => s === 'pending');

      if (allApproved) {
        existing.status = 'approved';
      } else if (allRejected) {
        existing.status = 'rejected';
      } else if (allPending) {
        existing.status = 'pending';
      } else {
        // Mixed statuses across venues in this booking (e.g. approved + rejected, approved + pending, etc.)
        existing.status = 'partial';
      }
      
      existing.issueFlag = existing.bookings.find(b => b.issueFlag)?.issueFlag || null;
      existing.permissionsLink = existing.bookings.find(b => b.permissionsLink)?.permissionsLink || null;
    } else {
      grouped.set(key, {
        ...b,
        ids: [b.id],
        venueIds: [b.venueId],
        venueName: getVenueName(b.venueId, b),
        bookings: [b],
        status: b.status,
      });
    }
  }

  return Array.from(grouped.values());
};

export const splitGroupedBookingsByDay = (bookings: GroupedBooking[]): GroupedBooking[] => {
  return bookings.flatMap(b => {
    const start = new Date(b.startTimeISO || b.date);
    const end = new Date(b.endTimeISO || b.date);

    if (end < start) {
      return [b];
    }

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);

    if (current.getTime() === endDay.getTime()) {
      return [b];
    }

    const results: GroupedBooking[] = [];
    
    // For multi-day events, show the exact timing of the entire event on all calendar days
    const displayStartTime = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${b.startTime}`;
    const displayEndTime = `${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${b.endTime}`;

    while (current <= endDay) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      
      results.push({
          ...b,
          date: dateStr,
          startTime: displayStartTime,
          endTime: displayEndTime,
      });
      current.setDate(current.getDate() + 1);
    }
    return results;
  });
};