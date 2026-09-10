import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Calendar as CalendarIcon, Check, CheckCircle, ChevronDown, ChevronRight, Download, ExternalLink, MapPin, Pencil, Plus, RefreshCw, Settings, X, XCircle } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import AddBookingDialog from '../components/AddBookingDialog';
import EditBookingDialog from '../components/EditBookingDialog';
import RegisterEventDialog from '../components/RegisterEventDialog';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar, type CalendarEvent } from '../components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { apiRequest, groupBookings, mapBooking, splitGroupedBookingsByDay, type ApiBooking, type ApiVenue } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { cn, getISTParts } from '../lib/utils';
import { getSocket, SOCKET_EVENTS } from '../lib/socket';
import { toastError, toastSuccess } from '../lib/toast';
import { GroupedBooking, Booking, AppEvent } from '../types';

const formatEventType = (eventType?: string) => {
  if (!eventType) return '';
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

const AdminDashboard: React.FC = () => {
  const [pendingRequests, setPendingRequests] = React.useState<GroupedBooking[]>([]);
  const [pendingEvents, setPendingEvents] = React.useState<(AppEvent & { clubName: string })[]>([]);
  const [venues, setVenues] = React.useState<ApiVenue[]>([]);
  const [stats, setStats] = React.useState({
    pendingBookings: 0,
    scheduledBookings: 0,
    conflicts: 0,
    activeClubs: 0,
    pendingEvents: 0,
    scheduledEvents: 0
  });
  const [isLoading, setIsLoading] = React.useState(true);

  const [calendarEvents, setCalendarEvents] = React.useState<GroupedBooking[]>([]);
  const [publicCampusEvents, setPublicCampusEvents] = React.useState<any[]>([]);
  const [calendarView, setCalendarView] = React.useState<'campus_events' | 'bookings'>('bookings');
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [error, setError] = React.useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = React.useState(false);
  const [isProcessingAction, setIsProcessingAction] = React.useState(false);

  const [editingBooking, setEditingBooking] = React.useState<Booking | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

  // SBG Settings State
  const [sbgSettingsOpen, setSbgSettingsOpen] = React.useState(false);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);
  const [sbgSettings, setSbgSettings] = React.useState({
    sbg_constitution_link: '',
    sbg_linkedin: '',
    sbg_email: ''
  });

  const fetchSbgSettings = async () => {
    try {
      const config = await apiRequest<Record<string, string>>('/api/settings', { auth: true });
      setSbgSettings({
        sbg_constitution_link: config.sbg_constitution_link || '',
        sbg_linkedin: config.sbg_linkedin || '',
        sbg_email: config.sbg_email || ''
      });
    } catch (err) {
      console.error('Failed to fetch SBG settings', err);
    }
  };

  const handleEventAction = async (ids: string[], action: 'active' | 'rejected') => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      await apiRequest('/api/admin/events/bulk-status', {
        method: 'PATCH',
        auth: true,
        body: { ids, status: action },
      });
      toastSuccess(`Event(s) ${action === 'active' ? 'approved' : 'rejected'} successfully`);
      fetchData();
    } catch (err) {
      console.error('Failed to update event(s):', err);
      toastError(err, `Failed to ${action} event(s). Please try again.`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const saveSbgSettings = async () => {
    setIsSavingSettings(true);
    try {
      await apiRequest('/api/settings', {
        method: 'POST',
        auth: true,
        body: sbgSettings
      });
      toastSuccess('SBG Settings saved successfully');
      setSbgSettingsOpen(false);
    } catch (error: any) {
      toastError(error, 'Failed to save SBG settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const getVenueName = (id: string) => venues.find(v => v.id === id)?.name || id;

  const exportAllEvents = React.useCallback(async () => {
    try {
      const eventsData = await apiRequest<any[]>('/api/events', { auth: true });
      if (eventsData.length === 0) {
        toastError('No events to export');
        return;
      }
      const headers = ['Event Name', 'Club Name', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Venue', 'Status', 'Event Type'];
      const rows = eventsData.map(e => {
        const startDate = e.date ? new Date(e.date) : null;
        const endDate = e.end_date ? new Date(e.end_date) : null;
        return {
          'Event Name': e.name || '',
          'Club Name': e.club_name || e.club_id || '',
          'Start Date': startDate ? startDate.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }) : '',
          'Start Time': startDate ? startDate.toLocaleTimeString([], {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit', minute: '2-digit'
          }) : '',
          'End Date': endDate ? endDate.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }) : '',
          'End Time': endDate ? endDate.toLocaleTimeString([], {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit', minute: '2-digit'
          }) : '',
          'Venue': e.venue || '',
          'Status': e.status || '',
          'Event Type': e.event_type || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Events');

      XLSX.writeFile(workbook, `all-events-${new Date().toISOString().slice(0, 10)}.xlsx`);

      toastSuccess('Events exported successfully');
    } catch (err) {
      toastError(err, 'Failed to export events');
    }
  }, []);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [venuesData, pendingData, statsData, allBookingsData, pendingEventsData, publicEventsData] = await Promise.all([
        apiRequest<ApiVenue[]>('/api/venues'),
        apiRequest<ApiBooking[]>('/api/admin/pending', { auth: true }),
        apiRequest<{ pendingBookings: number; scheduledBookings: number; conflicts: number; activeClubs: number; pendingEvents: number; scheduledEvents: number }>('/api/admin/stats', { auth: true }),
        apiRequest<ApiBooking[]>('/api/admin/bookings', { auth: true }),
        apiRequest<any[]>('/api/admin/events/pending', { auth: true }),
        apiRequest<any[]>('/api/events/public').catch(() => []),
      ]);

      setVenues(venuesData);
      setPendingRequests(groupBookings(pendingData.map(mapBooking)));
      setStats(statsData);
      setCalendarEvents(groupBookings(allBookingsData.map(mapBooking)));
      setPendingEvents(pendingEventsData.map(e => ({
        ...e,
        clubName: e.clubs?.name || 'Unknown Club'
      })));
      setPublicCampusEvents(publicEventsData || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError(getErrorMessage(err, 'Failed to load dashboard.'));
      setPendingRequests([]);
      setStats({ pendingBookings: 0, scheduledBookings: 0, conflicts: 0, activeClubs: 0, pendingEvents: 0, scheduledEvents: 0 });
      setCalendarEvents([]);
      setPendingEvents([]);
      setPublicCampusEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
    fetchSbgSettings();
  }, [fetchData]);

  // Socket.io: join admin room and listen for new booking requests
  React.useEffect(() => {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.JOIN_ADMIN);
    const handleBookingNew = (payload: { eventName: string; clubName: string; venueNames: string }) => {
      toast.message('New Booking Request', {
        description: `${payload.clubName} requested "${payload.eventName}" at ${payload.venueNames}`,
      });
      fetchData(); // refresh the dashboard
    };

    const handleEventsUpdated = () => {
      fetchData();
    };

    socket.on(SOCKET_EVENTS.BOOKING_NEW, handleBookingNew);
    socket.on(SOCKET_EVENTS.EVENTS_UPDATED, handleEventsUpdated);
    socket.on(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleEventsUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.BOOKING_NEW, handleBookingNew);
      socket.off(SOCKET_EVENTS.EVENTS_UPDATED, handleEventsUpdated);
      socket.off(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleEventsUpdated);
    };
  }, [fetchData]);

  const handleAction = async (bookingIds: string[], status: 'approved' | 'rejected') => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      await apiRequest('/api/admin/bookings/bulk-status', {
        method: 'PATCH',
        auth: true,
        body: { ids: bookingIds, status }
      });
      toastSuccess(`Booking(s) ${status} successfully`);
      fetchData();
    } catch (err) {
      console.error(`Failed to ${status} booking(s):`, err);
      toastError(err, `Failed to ${status} booking(s). Please try again.`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSendEmail = async (batchId: string | undefined, eventId: string | undefined) => {
    try {
      await apiRequest('/api/admin/bookings/send-email', {
        method: 'POST',
        auth: true,
        body: { batchId, eventId },
      });
      toastSuccess('Status email sent to the club successfully!');
    } catch (err) {
      console.error('Failed to send email:', err);
      toastError(err, 'Failed to send email. Please try again.');
    }
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  };

  const splitPublicEventsByDay = React.useCallback((events: any[]): GroupedBooking[] => {
    const result: GroupedBooking[] = [];

    for (const event of events) {
      const startDate = new Date(event.date);
      const endDate = event.end_date ? new Date(event.end_date) : startDate;

      const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const last = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

      const startTimeStr = startDate.toLocaleTimeString([], {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      });
      const endTimeStr = endDate.toLocaleTimeString([], {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      });

      const clubName = event.clubs?.name || event.club_name || 'Campus Event';

      while (current <= last) {
        const dayISO = new Date(current.getTime()).toISOString();
        result.push({
          id: `${event.id}-${current.toISOString().slice(0, 10)}`,
          ids: [event.id],
          bookingName: event.name,
          eventName: event.name,
          clubName: clubName,
          clubId: event.club_id || '',
          venueName: event.venue || 'No Venue Specified',
          venueId: '',
          venueIds: [],
          date: dayISO,
          startTime: startTimeStr,
          endTime: endTimeStr,
          startTimeISO: event.date,
          endTimeISO: event.end_date || event.date,
          status: 'approved',
          eventType: event.event_type,
          expectedAttendees: 0,
          createdAt: event.created_at || '',
          updatedAt: event.updated_at || '',
          bookings: [],
        } as unknown as GroupedBooking);

        current.setDate(current.getDate() + 1);
      }
    }

    return result;
  }, []);

  const campusEventsWithDaySplit = React.useMemo(() => splitPublicEventsByDay(publicCampusEvents), [splitPublicEventsByDay, publicCampusEvents]);

  const splitBookings = React.useMemo(() => splitGroupedBookingsByDay(calendarEvents), [calendarEvents]);

  const activeSourceEvents = React.useMemo(() => {
    if (calendarView === 'campus_events') {
      return campusEventsWithDaySplit;
    }
    return splitBookings.filter(e => e.status === 'approved' || e.status === 'partial');
  }, [calendarView, campusEventsWithDaySplit, splitBookings]);

  const getEventsForDate = (date: Date) => {
    return activeSourceEvents.filter(e => {
      const ist = getISTParts(e.date);
      return ist.year === date.getFullYear() && ist.month === date.getMonth() && ist.date === date.getDate();
    });
  };

  const selectedDateEvents = selectedDate 
    ? getEventsForDate(selectedDate).sort((a, b) => new Date(a.startTimeISO || a.date).getTime() - new Date(b.startTimeISO || b.date).getTime()) 
    : [];

  const eventDates = React.useMemo(() =>
    activeSourceEvents.map(e => {
      const ist = getISTParts(e.date);
      return new Date(ist.year, ist.month, ist.date);
    }),
    [activeSourceEvents]
  );

  const calendarEventsWithVenue: CalendarEvent[] = React.useMemo(() =>
    activeSourceEvents.map(e => {
      // For partial bookings, only show the names of approved venues
      const approvedVenueName = e.status === 'partial'
        ? e.bookings?.filter(b => b.status === 'approved').map(b => getVenueName(b.venueId)).sort((a, b) => a.localeCompare(b)).join(', ')
        : (e.venueName || e.venueIds?.map(getVenueName).sort((a, b) => a.localeCompare(b)).join(', '));
      return {
        eventName: e.eventName,
        bookingName: e.bookingName,
        clubName: e.clubName,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        startTimeISO: e.startTimeISO,
        venueName: approvedVenueName || e.venueName || e.venueIds?.map(getVenueName).sort((a, b) => a.localeCompare(b)).join(', '),
        status: e.status,
        eventType: e.eventType,
      };
    }),
    [activeSourceEvents, venues]
  );

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 sm:space-y-8"
      >
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-bold text-textPrimary tracking-tight leading-tight">Admin Dashboard</h2>
        </div>
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle size={16} />
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription className="mt-1">{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={fetchData}>
            <RefreshCw size={14} />
            Retry
          </Button>
        </Alert>
      </motion.div>
    );
  }

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 sm:space-y-8"
      >
        <div className="space-y-2">
          <Skeleton className="h-10 w-64 sm:w-80" />
          <Skeleton className="h-5 w-80 sm:w-96" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 sm:h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 sm:space-y-8"
    >
      {/* Enhanced Header */}
      <div className="px-1 sm:px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tighter leading-tight">
              Admin Dashboard
            </h1>
            <p className="text-textSecondary mt-2 sm:mt-3 text-sm sm:text-base font-medium max-w-2xl">
              Monitor venue bookings, manage approvals, and track system
              performance.
            </p>
          </div>
          <div className="flex gap-2 items-center w-full sm:w-auto mt-2 sm:mt-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 rounded-xl h-10 font-semibold bg-brand text-white shadow-md hover:opacity-90 w-full sm:w-auto">
                  Quick Actions <ChevronDown size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-xl"
              >
                <DropdownMenuLabel>Manage Platform</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setAddDialogOpen(true)}
                  className="gap-2 cursor-pointer font-medium"
                >
                  <CalendarIcon size={16} className="text-brand" /> Book Venues
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setRegisterDialogOpen(true)}
                  className="gap-2 cursor-pointer font-medium"
                >
                  <Plus size={16} className="text-brand" /> Register Event
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Data & Settings</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={exportAllEvents}
                  disabled={isLoading}
                  className="gap-2 cursor-pointer font-medium"
                >
                  <Download size={16} className="text-textSecondary" /> Export
                  Events Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSbgSettingsOpen(true)}
                  className="gap-2 cursor-pointer font-medium"
                >
                  <Settings size={16} className="text-textSecondary" /> SBG
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>
      </div>

      {/* Mini Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-1 sm:px-4"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2 sm:gap-3 w-full">
          <Link
            to="/admin/requests?status=pending"
            className="block focus-visible:ring-2 focus-visible:ring-warning rounded-xl outline-none cursor-pointer"
          >
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-card/60 backdrop-blur-sm border border-borderSoft rounded-xl shadow-sm hover:border-warning/40 hover:bg-warning/5 transition-all group">
              <div className="p-1.5 sm:p-2 bg-warning/10 text-warning rounded-lg shrink-0 group-hover:scale-110 transition-transform">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-xs text-textMuted font-bold uppercase tracking-wider truncate">
                  Pending Bookings
                </div>
                <div className="text-base sm:text-lg font-extrabold text-textPrimary leading-none mt-0.5">
                  {stats.pendingBookings}
                </div>
              </div>
            </div>
          </Link>

          <Link
            to="/admin/event-requests?status=pending"
            className="block focus-visible:ring-2 focus-visible:ring-warning rounded-xl outline-none cursor-pointer"
          >
            <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-card/60 backdrop-blur-sm border border-borderSoft rounded-xl shadow-sm hover:border-warning/40 hover:bg-warning/5 transition-all group">
              <div className="p-1.5 sm:p-2 bg-warning/10 text-warning rounded-lg shrink-0 group-hover:scale-110 transition-transform">
                <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-xs text-textMuted font-bold uppercase tracking-wider truncate">
                  Pending Events
                </div>
                <div className="text-base sm:text-lg font-extrabold text-textPrimary leading-none mt-0.5">
                  {stats.pendingEvents}
                </div>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-card/60 backdrop-blur-sm border border-borderSoft rounded-xl shadow-sm hover:border-brand/40 transition-colors cursor-pointer">
            <div className="p-1.5 sm:p-2 bg-brand/10 text-brand rounded-lg shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs text-textMuted font-bold uppercase tracking-wider truncate">
                Scheduled Bookings
              </div>
              <div className="text-base sm:text-lg font-extrabold text-textPrimary leading-none mt-0.5">
                {stats.scheduledBookings}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-card/60 backdrop-blur-sm border border-borderSoft rounded-xl shadow-sm hover:border-brand/40 transition-colors cursor-pointer">
            <div className="p-1.5 sm:p-2 bg-brand/10 text-brand rounded-lg shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs text-textMuted font-bold uppercase tracking-wider truncate">
                Scheduled Events
              </div>
              <div className="text-base sm:text-lg font-extrabold text-textPrimary leading-none mt-0.5">
                {stats.scheduledEvents}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Calendar Widget */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full min-w-0"
      >
        <Card className="w-full min-w-0 border border-borderSoft rounded-xl overflow-hidden">
          <CardHeader className="border-b border-borderSoft p-3 sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-lg sm:text-xl shrink-0">
                {calendarView === 'campus_events' ? 'Master Events Calendar' : 'Master Booking Calendar'}
              </CardTitle>
              <Tabs
                value={calendarView}
                onValueChange={(value) => setCalendarView(value as 'campus_events' | 'bookings')}
                className="w-full sm:w-auto"
              >
                <TabsList aria-label="Calendar view" className="flex items-center w-full sm:w-auto h-9 sm:h-10 p-1 gap-1 bg-hoverSoft rounded-xl border border-borderSoft">
                  <TabsTrigger value="bookings" className="flex-1 text-[12px] sm:text-xs md:text-sm px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 font-medium">Bookings</TabsTrigger>
                  <TabsTrigger value="campus_events" className="flex-1 text-[12px] sm:text-xs md:text-sm px-2 sm:px-3 py-1 sm:py-1.5 h-7 sm:h-8 font-medium">Events</TabsTrigger>
                </TabsList>
                <TabsContent value="campus_events" className="hidden" />
                <TabsContent value="bookings" className="hidden" />
              </Tabs>
            </div>
          </CardHeader>

          <CardContent className="w-full min-w-0 overflow-hidden p-2 sm:p-4">
            <div className="flex w-full min-w-0 flex-col gap-6 sm:gap-8 lg:flex-row">
              <div className="w-full min-w-0 lg:w-auto lg:shrink-0">
                <div className="w-full min-w-0 max-w-[380px] mx-auto overflow-x-scroll">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    events={calendarEventsWithVenue}
                    modifiers={{ hasEvents: eventDates }}
                    modifiersClassNames={{
                      hasEvents:
                        "relative after:absolute after:bottom-[8%] after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary",
                    }}
                    className="rounded-2xl"
                  />
                </div>
              </div>

              <div className="flex w-full min-w-0 flex-1 flex-col border-t border-borderSoft pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-textMuted">
                  {selectedDate
                    ? selectedDate.toLocaleDateString("en-US", {
                        timeZone: "Asia/Kolkata",
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })
                    : "Select a date"}
                </h4>

                <div className="max-h-[280px] min-w-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${calendarView}-${selectedDate?.toISOString() || 'none'}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="space-y-3"
                    >
                      {selectedDateEvents.length > 0 ? (
                        selectedDateEvents.map((event, index) => (
                          <motion.div
                            key={event.ids.join("-")}
                            initial={{
                              opacity: 0,
                              y: 6,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                            }}
                            transition={{
                              duration: 0.2,
                              delay: index * 0.03,
                            }}
                            className="w-full min-w-0"
                          >
                            <Card className="w-full min-w-0 rounded-xl transition-colors">
                              <CardContent className="p-3">
                                <div className="flex min-w-0 items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 break-words text-sm font-semibold text-textPrimary">
                                      {event.bookingName}
                                    </div>

                                    {event.eventName &&
                                      event.eventName !== event.bookingName && (
                                        <div className="mb-1.5 break-words text-xs font-medium text-textMuted">
                                          Linked Event: {event.eventName}
                                        </div>
                                      )}
                                  </div>

                                  <Badge
                                    variant={
                                      event.status === "approved"
                                        ? "success"
                                        : event.status === "pending"
                                          ? "pending"
                                          : "destructive"
                                    }
                                    className="h-5 shrink-0 px-1.5 py-0 text-[10px]"
                                  >
                                    {event.status}
                                  </Badge>
                                </div>

                                {/* Club & Event Type */}
                                <div className="mb-2 mt-0.5 flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-medium text-brand">{event.clubName}</span>
                                  {event.eventType && (
                                    <Badge variant="outline" className="text-[10px] h-5">
                                      {formatEventType(event.eventType)}
                                    </Badge>
                                  )}
                                </div>

                                {/* Permissions */}
                                {event.permissionsLink && (
                                  <div className="mb-3 mt-2">
                                    <a
                                      href={
                                        event.permissionsLink.match(/^https?:\/\//)
                                          ? event.permissionsLink
                                          : `https://${event.permissionsLink}`
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="
                                  inline-flex
                                  w-fit
                                  items-center
                                  justify-center
                                  gap-1
                                  rounded-[2rem]
                                  border
                                  border-brand/30
                                  px-2
                                  text-[11px]
                                  font-medium
                                  text-brand
                                  transition-colors
                                  hover:bg-brand/10
                                  sm:gap-1.5
                                  sm:text-[13px]
                                "
                                    >
                                      <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                      View Permissions
                                    </a>
                                  </div>
                                )}

                                {/* Time */}
                                <div className="mt-2 text-xs text-textMuted">
                                  {event.startTime} - {event.endTime}
                                </div>

                                {/* Venue */}
                                {event.venueName && (
                                  <div className="mt-1 break-words text-xs text-textMuted">
                                    {event.venueName}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-sm text-textMuted">
                          No events found for this day.
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* All Events List (visible to admin) */}
      {/* <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
      >
        <Card className="border border-borderSoft rounded-xl">
          <CardHeader className="border-b border-borderSoft">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">All Events</CardTitle>
                <CardDescription className="mt-1">Complete list of bookings visible to admin</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild className="hidden sm:flex whitespace-nowrap border-[1.5px]">
                  <Link to="/admin/requests?status=pending">View All</Link>
                </Button>
              </div>
            </div>
            <div className="sm:hidden px-4 pt-4 pb-2">
              <Button variant="outline" size="sm" asChild className="w-full border-[1.5px]">
                <Link to="/admin/requests?status=pending">View All</Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="h-12 w-full mb-4" />
                <Skeleton className="h-12 w-full mb-4" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : calendarEvents.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-textMuted">No events available.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full min-w-[600px] sm:min-w-0 text-left text-sm">
                  <thead className="bg-hoverSoft border-b border-borderSoft uppercase tracking-wider text-xs font-semibold text-textMuted">
                    <tr>
                      <th className="px-4 sm:px-6 py-4">Club / Event</th>
                      <th className="px-4 sm:px-6 py-4 hidden sm:table-cell">Venue</th>
                      <th className="px-4 sm:px-6 py-4">Date & Time</th>
                      <th className="px-4 sm:px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {[...calendarEvents]
                      .sort((a, b) => new Date(a.startTimeISO || a.date).getTime() - new Date(b.startTimeISO || b.date).getTime())
                      .slice(0, 5)
                      .map((evt, index) => (
                      <motion.tr
                        key={evt.batchId || evt.ids[0]}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="hover:bg-hoverSoft transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-4">
                          <div className="font-semibold text-textPrimary">{evt.bookingName}</div>
                          {evt.eventName && evt.eventName !== evt.bookingName && (
                            <div className="text-xs text-textMuted mt-0.5 font-medium">Linked Event: {evt.eventName}</div>
                          )}
                          <div className="text-xs text-textMuted mt-0.5">{evt.clubName}</div>
                          {evt.permissionsLink && (
                            <a href={evt.permissionsLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand hover:underline mt-1 inline-block font-medium">
                              🔗 View Permissions
                            </a>
                          )}
                          <div className="text-xs text-textMuted mt-1 sm:hidden flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <CalendarIcon size={12} className="shrink-0" />
                              <div className="flex flex-col">
                                <span className="whitespace-nowrap">{new Date(evt.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })} {evt.startTime}</span>
                                <span className="text-[10px] text-textMuted">to</span>
                                <span className="whitespace-nowrap">{new Date(evt.endDate || evt.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' })} {evt.endTime}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin size={12} className="shrink-0" />
                              <span>{evt.venueName}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5 text-textPrimary">
                            {evt.venueName}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <div className="flex items-start gap-1.5">
                            <CalendarIcon size={14} className="text-textMuted shrink-0 mt-0.5" />
                            <div className="flex flex-col text-xs space-y-0.5">
                              <span className="whitespace-nowrap">{new Date(evt.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })} {evt.startTime}</span>
                              <span className="text-textMuted text-[10px]">to</span>
                              <span className="whitespace-nowrap">{new Date(evt.endDate || evt.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })} {evt.endTime}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <Badge
                            variant={
                              evt.status === 'approved' ? 'success' :
                                evt.status === 'rejected' ? 'destructive' :
                                  'pending'
                            }
                          >
                            {evt.status.charAt(0).toUpperCase() + evt.status.slice(1)}
                          </Badge>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div> */}

      {/* Pending Requests Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="border border-borderSoft rounded-xl">
          <CardHeader className="border-b border-borderSoft">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  Pending Requests
                </CardTitle>
                <CardDescription className="mt-1">
                  Requests requiring immediate attention (Category B or
                  Conflicts)
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="hidden sm:flex whitespace-nowrap border-[1.5px]"
                >
                  <Link to="/admin/requests?status=pending">View All</Link>
                </Button>
              </div>
            </div>
            <div className="sm:hidden px-4 pt-4 pb-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full border-[1.5px]"
              >
                <Link to="/admin/requests?status=pending">View All</Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {isLoading ? (
                <div className="p-3">
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-textMuted">No pending requests.</p>
                </div>
              ) : (
                pendingRequests.slice(0, 5).map((req, index) => (
                  <motion.div
                    key={req.ids?.join("-") || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="p-3 hover:bg-hoverSoft transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            {req.clubName}
                          </Badge>
                        </div>
                        <h4 className="text-base sm:text-lg font-medium text-foreground">
                          {req.bookingName || req.eventName}
                        </h4>
                        {req.bookingName &&
                        req.bookingName !== req.eventName ? (
                          <div className="text-xs text-textMuted mt-0.5 font-medium">
                            Event: {req.eventName}
                          </div>
                        ) : null}
                        <div className="mt-2 text-sm text-textMuted">
                          <div className="mb-2 flex items-center gap-1.5">
                            {/* <span className="font-medium mr-1 text-textPrimary">Booking Time:</span> */}
                            <CalendarIcon
                              size={14}
                              className="text-textMuted shrink-0"
                            />
                            <span>
                              {new Date(req.date).toLocaleDateString("en-US", {
                                timeZone: "Asia/Kolkata",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}{" "}
                              {req.startTime}
                            </span>
                            <span className="text-[10px] mx-1">to</span>
                            <span>
                              {new Date(
                                req.endDate || req.date,
                              ).toLocaleDateString("en-US", {
                                timeZone: "Asia/Kolkata",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}{" "}
                              {req.endTime}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2">
                            {req.bookings.map((booking) => (
                              <div
                                key={booking.id}
                                className="flex items-center justify-between bg-background border border-borderSoft rounded-md p-2 text-sm"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-medium text-foreground truncate">
                                    {getVenueName(booking.venueId)}
                                  </span>
                                  {req.bookings.length > 1 && (
                                    <Badge
                                      variant={
                                        booking.status === "approved"
                                          ? "success"
                                          : booking.status === "rejected"
                                            ? "destructive"
                                            : "pending"
                                      }
                                      className="text-[10px] h-4.5 px-1.5 shrink-0 font-medium"
                                    >
                                      {booking.status.toUpperCase()}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                  {booking.status !== "rejected" &&
                                    req.bookings.length > 1 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 sm:h-7 sm:w-7 p-0 text-textMuted hover:text-error"
                                        onClick={() =>
                                          handleAction([booking.id], "rejected")
                                        }
                                        title="Reject this venue"
                                        disabled={isProcessingAction}
                                      >
                                        <X
                                          size={16}
                                          className="sm:w-3.5 sm:h-3.5"
                                        />
                                      </Button>
                                    )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 sm:h-7 sm:w-7 p-0 text-textMuted hover:text-primary"
                                    onClick={() => {
                                      setEditingBooking(booking);
                                      setIsEditDialogOpen(true);
                                    }}
                                    title="Edit booking timings"
                                    disabled={isProcessingAction}
                                  >
                                    <Pencil
                                      size={14}
                                      className="sm:w-3.5 sm:h-3.5"
                                    />
                                  </Button>
                                  {booking.status !== "approved" &&
                                    req.bookings.length > 1 && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 sm:h-7 sm:w-7 p-0 text-primary hover:text-primary/80"
                                        onClick={() =>
                                          handleAction([booking.id], "approved")
                                        }
                                        title="Approve this venue"
                                        disabled={isProcessingAction}
                                      >
                                        <Check
                                          size={16}
                                          className="sm:w-3.5 sm:h-3.5"
                                        />
                                      </Button>
                                    )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {req.permissionsLink && (
                          <div className="mt-3">
                            <a
                              href={
                                req.permissionsLink.match(/^https?:\/\//)
                                  ? req.permissionsLink
                                  : `https://${req.permissionsLink}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1 sm:gap-1.5 p-[1px] px-1.5 rounded-[2rem] border border-brand/30 bg-transparent text-[11px] sm:text-[13px] font-medium text-brand hover:bg-brand/10 transition-colors w-fit"
                            >
                              <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              View Permissions
                            </a>
                          </div>
                        )}
                        {req.issueFlag && (
                          <div className="mt-2 text-sm bg-warning/10 text-warning border border-warning/20 p-2 rounded-md flex items-start gap-2">
                            <AlertCircle
                              size={16}
                              className="mt-0.5 shrink-0"
                            />
                            <span>
                              <strong>Requires Admin Approval:</strong>{" "}
                              {req.issueFlag}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() =>
                            handleSendEmail(req.batchId, undefined)
                          } // For dashboard pending requests we only have batchId easily available in req
                          title="Send an email to the club with the current status of all venues in this booking"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect width="20" height="16" x="2" y="4" rx="2" />
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                          </svg>
                          <span className="hidden sm:inline">Send Mail</span>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => handleAction(req.ids, "rejected")}
                          disabled={isProcessingAction}
                        >
                          <XCircle size={16} />
                          <span className="hidden sm:inline">
                            {req.bookings.length > 1 ? "Reject All" : "Reject"}
                          </span>
                        </Button>
                        <Button
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => handleAction(req.ids, "approved")}
                          disabled={isProcessingAction}
                        >
                          <CheckCircle size={16} />
                          <span className="hidden sm:inline">
                            {req.bookings.length > 1
                              ? "Approve All"
                              : "Approve"}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Pending Events Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        <Card className="border border-borderSoft rounded-xl mb-6">
          <CardHeader className="border-b border-borderSoft">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  Pending Event Registrations
                </CardTitle>
                <CardDescription className="mt-1">
                  Event requests requiring admin approval
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="hidden sm:flex whitespace-nowrap border-[1.5px]"
                >
                  <Link to="/admin/event-requests?status=pending">
                    View All
                  </Link>
                </Button>
              </div>
            </div>
            <div className="sm:hidden px-4 pt-4 pb-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full border-[1.5px]"
              >
                <Link to="/admin/event-requests?status=pending">View All</Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {isLoading ? (
                <div className="p-3">
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : pendingEvents.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-textMuted">
                    No pending event registrations.
                  </p>
                </div>
              ) : (
                pendingEvents.slice(0, 5).map((evt, index) => (
                  <motion.div
                    key={evt.id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="p-3 hover:bg-hoverSoft transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <Badge variant="secondary" className="text-xs">
                            {evt.clubName}
                          </Badge>
                        </div>
                        <h4 className="text-base sm:text-lg font-medium text-foreground">
                          <span className="text-sm text-textMuted font-normal mr-2">
                            Event Name:
                          </span>
                          {evt.name}
                        </h4>

                        <div className="mt-2 flex flex-col gap-2 text-xs mb-2">
                          <div className="flex items-center gap-1.5 text-textMuted text-sm">
                            <span className="font-medium mr-1 text-textPrimary">
                              Event Time:
                            </span>
                            <CalendarIcon
                              size={14}
                              className="text-textMuted shrink-0"
                            />
                            <span>
                              {new Date(evt.date).toLocaleDateString("en-US", {
                                timeZone: "Asia/Kolkata",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}{" "}
                              {new Date(evt.date).toLocaleTimeString("en-US", {
                                timeZone: "Asia/Kolkata",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {evt.dynamic_end_date && (
                              <>
                                <span className="text-[10px] mx-1">to</span>
                                <span>
                                  {new Date(
                                    evt.dynamic_end_date,
                                  ).toLocaleDateString("en-US", {
                                    timeZone: "Asia/Kolkata",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}{" "}
                                  {new Date(
                                    evt.dynamic_end_date,
                                  ).toLocaleTimeString("en-US", {
                                    timeZone: "Asia/Kolkata",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                          {evt.event_type ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-brand/5 border-brand/20 text-brand"
                            >
                              {evt.event_type
                                .replace("_", " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-indigo-500/5 border-indigo-500/20 text-indigo-600"
                            >
                              General
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() =>
                            handleEventAction([evt.id], "rejected")
                          }
                          disabled={isProcessingAction}
                        >
                          <XCircle size={16} />
                          <span className="hidden sm:inline">Reject</span>
                        </Button>
                        <Button
                          size="sm"
                          className="flex items-center gap-2"
                          onClick={() => handleEventAction([evt.id], "active")}
                          disabled={isProcessingAction}
                        >
                          <CheckCircle size={16} />
                          <span className="hidden sm:inline">Approve</span>
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <AddBookingDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={fetchData}
      />
      <RegisterEventDialog
        isOpen={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
        currentUser={{ role: "admin" } as any}
        onEventCreated={fetchData}
      />

      {/* SBG Settings Dialog */}
      <Dialog open={sbgSettingsOpen} onOpenChange={setSbgSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>SBG Settings</DialogTitle>
            <DialogDescription>
              Manage public information shown on the About SBG page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="constitution-link">Constitution Link (URL)</Label>
              <Input
                id="constitution-link"
                value={sbgSettings.sbg_constitution_link}
                onChange={(e) =>
                  setSbgSettings({
                    ...sbgSettings,
                    sbg_constitution_link: e.target.value,
                  })
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sbg-linkedin">SBG LinkedIn (URL)</Label>
              <Input
                id="sbg-linkedin"
                value={sbgSettings.sbg_linkedin}
                onChange={(e) =>
                  setSbgSettings({
                    ...sbgSettings,
                    sbg_linkedin: e.target.value,
                  })
                }
                placeholder="https://linkedin.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sbg-email">SBG Contact Email</Label>
              <Input
                id="sbg-email"
                value={sbgSettings.sbg_email}
                onChange={(e) =>
                  setSbgSettings({ ...sbgSettings, sbg_email: e.target.value })
                }
                placeholder="sbg@dau.ac.in"
                type="email"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSbgSettingsOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-brand text-white hover:bg-brandLink"
              onClick={saveSbgSettings}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? "Saving..." : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditBookingDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        booking={editingBooking}
        onUpdated={fetchData}
      />
    </motion.div>
  );
};

export default AdminDashboard;