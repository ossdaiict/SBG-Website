import { motion } from 'framer-motion';
import {
  Archive as ArchiveIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { apiRequest } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { toastError, toastSuccess } from '../lib/toast';

interface ArchivedBooking {
  id: string;
  club_id: string;
  venue_id: string;
  start_time: string;
  end_time: string;
  status: string;
  booking_name?: string;
  event_name: string;
  event_type: string;
  expected_attendees?: number;
  batch_id?: string;
  event_id?: string;
  archived_at: string;
  venue_name?: string;
  club_name?: string;
}

interface ArchivedReport {
  id: string;
  club_id: string;
  level: string;
  report_doc_link: string;
  photos_drive_link: string;
  archived_at: string;
}

interface ArchivedEvent {
  id: string;
  club_id: string;
  club_name?: string;
  name: string;
  date: string;
  end_date: string;
  venue: string;
  event_type: string;
  archived_at: string;
  bookings: ArchivedBooking[];
  report: ArchivedReport | null;
}

interface ArchivedMember {
  id: string;
  club_id: string;
  club_name: string;
  full_name: string;
  roll_number?: string;
  email?: string;
  designation: string;
  phone?: string;
  is_core_member: boolean;
  tenure_start_date: string;
  tenure_end_date: string;
  tenure_end_reason: string;
  created_at: string;
  updated_at: string;
}

type ArchiveItem =
  | { type: 'event'; data: ArchivedEvent; archivedAt: string }
  | { type: 'booking'; data: ArchivedBooking; archivedAt: string }
  | { type: 'member'; data: ArchivedMember; archivedAt: string };

const Archives: React.FC = () => {
  const [events, setEvents] = useState<ArchivedEvent[]>([]);
  const [standaloneBookings, setStandaloneBookings] = useState<ArchivedBooking[]>([]);
  const [archivedMembers, setArchivedMembers] = useState<ArchivedMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'events' | 'bookings' | 'members'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'event' | 'booking' | 'member'; id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'admin';

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const listTopRef = useRef<HTMLDivElement>(null);

  const fetchArchives = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [eventsData, bookingsData, membersData] = await Promise.all([
        apiRequest<ArchivedEvent[]>('/api/archives/events', { auth: true }),
        apiRequest<ArchivedBooking[]>('/api/archives/bookings', { auth: true }).catch((err) => {
          console.warn('Could not fetch standalone archived bookings:', err);
          return [] as ArchivedBooking[];
        }),
        apiRequest<ArchivedMember[]>('/api/archives/members', { auth: true }).catch((err) => {
          console.warn('Could not fetch archived members:', err);
          return [] as ArchivedMember[];
        }),
      ]);
      setEvents(eventsData || []);
      setStandaloneBookings(bookingsData || []);
      setArchivedMembers(membersData || []);
    } catch (err) {
      console.error('Failed to fetch archives:', err);
      setError(getErrorMessage(err, 'Failed to load archives.'));
      setEvents([]);
      setStandaloneBookings([]);
      setArchivedMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'event') {
        await apiRequest(`/api/archives/events/${itemToDelete.id}`, { method: 'DELETE', auth: true });
        setEvents((prev) => prev.filter((a) => a.id !== itemToDelete.id));
      } else if (itemToDelete.type === 'booking') {
        await apiRequest(`/api/archives/bookings/${itemToDelete.id}`, { method: 'DELETE', auth: true });
        setStandaloneBookings((prev) => prev.filter((b) => b.id !== itemToDelete.id));
      } else if (itemToDelete.type === 'member') {
        await apiRequest(`/api/archives/members/${itemToDelete.id}`, { method: 'DELETE', auth: true });
        setArchivedMembers((prev) => prev.filter((m) => m.id !== itemToDelete.id));
      }
      setDeleteDialogOpen(false);
      toastSuccess('Archive deleted successfully');
    } catch (err) {
      toastError(err, 'Failed to delete archive');
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const confirmEmpty = async () => {
    setIsEmptying(true);
    try {
      await apiRequest('/api/archives/all', { method: 'DELETE', auth: true });
      setEvents([]);
      setStandaloneBookings([]);
      setArchivedMembers([]);
      setEmptyDialogOpen(false);
      toastSuccess('All archives emptied successfully');
    } catch (err) {
      toastError(err, 'Failed to empty archives');
    } finally {
      setIsEmptying(false);
    }
  };

  const allItems: ArchiveItem[] = useMemo(() => {
    const eventItems: ArchiveItem[] = events.map((e) => ({
      type: 'event',
      data: e,
      archivedAt: e.archived_at,
    }));
    const bookingItems: ArchiveItem[] = standaloneBookings.map((b) => ({
      type: 'booking',
      data: b,
      archivedAt: b.archived_at,
    }));
    const memberItems: ArchiveItem[] = archivedMembers.map((m) => ({
      type: 'member',
      data: m,
      archivedAt: m.tenure_end_date || m.updated_at,
    }));

    let combined = [...eventItems, ...bookingItems, ...memberItems];
    if (activeTab === 'events') {
      combined = eventItems;
    } else if (activeTab === 'bookings') {
      combined = bookingItems;
    } else if (activeTab === 'members') {
      combined = memberItems;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      combined = combined.filter((item) => {
        if (item.type === 'event') {
          return (
            item.data.name?.toLowerCase().includes(q) ||
            item.data.club_name?.toLowerCase().includes(q) ||
            item.data.venue?.toLowerCase().includes(q)
          );
        } else if (item.type === 'booking') {
          return (
            item.data.booking_name?.toLowerCase().includes(q) ||
            item.data.event_name?.toLowerCase().includes(q) ||
            item.data.club_name?.toLowerCase().includes(q) ||
            item.data.venue_name?.toLowerCase().includes(q)
          );
        } else if (item.type === 'member') {
          return (
            item.data.full_name?.toLowerCase().includes(q) ||
            item.data.club_name?.toLowerCase().includes(q) ||
            item.data.designation?.toLowerCase().includes(q) ||
            item.data.roll_number?.toLowerCase().includes(q)
          );
        }
        return true;
      });
    }

    return combined.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());
  }, [events, standaloneBookings, archivedMembers, activeTab, searchQuery]);

  const totalItemsCount = events.length + standaloneBookings.length + archivedMembers.length;
  const totalPages = Math.max(1, Math.ceil(allItems.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div ref={listTopRef} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <ArchiveIcon className="text-textSecondary" size={32} />
          <div>
            <motion.h1 className="text-3xl sm:text-4xl font-extrabold text-textPrimary tracking-tighter">
              Database Archives
            </motion.h1>
            <p className="text-textSecondary mt-1 text-sm font-medium leading-relaxed max-w-xl">
              Historical records of deleted events, meetings, slot bookings, and reports.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
          {isAdmin && totalItemsCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setEmptyDialogOpen(true)}
              className="w-full sm:w-auto gap-2 shrink-0"
            >
              <Trash2 size={16} /> Empty All
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchArchives} className="w-full sm:w-auto gap-2 shrink-0">
            <RefreshCw size={16} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert className="rounded-2xl border-2 border-error/30 bg-error/5">
          <AlertTitle className="font-bold text-error">Could not load archives</AlertTitle>
          <AlertDescription className="mt-2 text-error/80">{error}</AlertDescription>
        </Alert>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as 'all' | 'events' | 'bookings' | 'members');
            setCurrentPage(1);
          }}
          className="w-full md:w-auto"
        >
          <TabsList aria-label="Archive filters" className="grid grid-cols-4 w-full md:w-auto md:inline-flex">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              All({totalItemsCount})
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs sm:text-sm">
              Events({events.length})
            </TabsTrigger>
            <TabsTrigger value="bookings" className="text-xs sm:text-sm">
              Meetings({standaloneBookings.length})
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs sm:text-sm">
              Members({archivedMembers.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted h-4 w-4 pointer-events-none z-10" />
          <Input
            placeholder="Search archives..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-10 text-sm"
            aria-label="Search archives"
          />
        </div>
      </div>

      {!error && allItems.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-card border border-borderSoft rounded-2xl shadow-sm">
          <ArchiveIcon size={48} className="text-textMuted mb-4 opacity-50" />
          <h2 className="text-lg font-bold text-textPrimary">No Archives Found</h2>
          <p className="text-textSecondary max-w-sm mt-2 text-sm">
            {searchQuery
              ? 'No archived items match your search filter. Try a different query.'
              : 'When events, meetings, or members are removed, their historical records will appear here.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        {(() => {
          const startIndex = (currentPage - 1) * itemsPerPage;
          const paginatedItems = allItems.slice(startIndex, startIndex + itemsPerPage);

          return (
            <>
              {paginatedItems.map((item, i) => {
                if (item.type === 'event') {
                  const event = item.data;
                  return (
                    <motion.div
                      key={`event-${event.id}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="border border-borderSoft rounded-xl overflow-hidden shadow-sm">
                        <CardHeader className="bg-bgMain border-b border-borderSoft p-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="min-w-0">
                              <CardTitle className="text-lg text-textPrimary break-words">{event.name}</CardTitle>
                              <div className="text-sm font-medium text-textSecondary mt-1">
                                {event.club_name || 'Unknown Club'}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs text-textSecondary">
                                <span className="flex items-center gap-1 shrink-0">
                                  <Calendar size={12} />
                                  {event.date ? (
                                    <>
                                      {new Date(event.date).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })}
                                      {event.end_date && event.end_date !== event.date && (
                                        <> – {new Date(event.end_date).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })}</>
                                      )}
                                    </>
                                  ) : (
                                    'No Date'
                                  )}
                                </span>

                                {event.venue && (
                                  <span className="flex items-center gap-1 shrink-0">
                                    <MapPin size={12} /> {event.venue}
                                  </span>
                                )}

                                {event.archived_at && (
                                  <span className="flex items-center gap-1 shrink-0">
                                    Archived: {new Date(event.archived_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                              <Badge variant="outline" className="text-xs bg-bgMain border-borderSoft">
                                Event Record
                              </Badge>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setItemToDelete({ type: 'event', id: event.id });
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-textMuted hover:text-error hover:bg-error/10 h-8 w-8 p-0 rounded-lg shrink-0"
                                  title="Delete Archive"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {event.bookings.length > 0 && (
                            <div className="p-4 border-b border-borderSoft/50 bg-card">
                              <h4 className="text-sm font-semibold mb-2 text-textPrimary flex items-center gap-2">
                                <ArchiveIcon size={14} className="text-brand" /> Associated Bookings ({event.bookings.length})
                              </h4>
                              <div className="space-y-2">
                                {event.bookings.map((b) => (
                                  <div
                                    key={b.id}
                                    className="text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 sm:p-2 rounded-lg bg-bgMain"
                                  >
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold text-textPrimary">{b.venue_name || 'Unknown Venue'}</span>
                                      <span className="text-textSecondary">
                                        {new Date(b.start_time).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })} -{' '}
                                        {new Date(b.end_time).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' })}
                                      </span>
                                    </div>
                                    <Badge variant="outline" className="text-[10px] self-start sm:self-auto shrink-0">
                                      {b.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {event.report && (
                            <div className="p-4 bg-card">
                              <h4 className="text-sm font-semibold mb-2 text-textPrimary flex items-center gap-2">
                                <ArchiveIcon size={14} className="text-brand" /> Associated Event Report
                              </h4>
                              <div className="text-xs text-textSecondary flex flex-wrap gap-x-4 gap-y-2">
                                <span className="shrink-0">Level: {event.report.level}</span>
                                <a
                                  href={event.report.report_doc_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-brand hover:underline shrink-0"
                                >
                                  <Download size={12} /> Doc
                                </a>
                                {event.report.photos_drive_link && (
                                  <a
                                    href={event.report.photos_drive_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-brand hover:underline shrink-0"
                                  >
                                    <Download size={12} /> Photos
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                } else if (item.type === 'booking') {
                  const booking = item.data;
                  return (
                    <motion.div
                      key={`booking-${booking.id}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="border border-borderSoft rounded-xl overflow-hidden shadow-sm">
                        <CardHeader className="bg-bgMain border-b border-borderSoft p-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="min-w-0">
                              <CardTitle className="text-lg text-textPrimary break-words">
                                {booking.booking_name || booking.event_name || 'Club Meeting'}
                              </CardTitle>
                              <div className="text-sm font-medium text-textSecondary mt-1">
                                {booking.club_name || 'Unknown Club'}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs text-textSecondary">
                                <span className="flex items-center gap-1 shrink-0">
                                  <Calendar size={12} />
                                  {new Date(booking.start_time).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })}
                                </span>
                                <span className="flex items-center gap-1 shrink-0">
                                  <Clock size={12} />
                                  {new Date(booking.start_time).toLocaleTimeString('en-GB', {
                                    timeZone: 'Asia/Kolkata',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  -{' '}
                                  {new Date(booking.end_time).toLocaleTimeString('en-GB', {
                                    timeZone: 'Asia/Kolkata',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {booking.venue_name && (
                                  <span className="flex items-center gap-1 shrink-0">
                                    <MapPin size={12} /> {booking.venue_name}
                                  </span>
                                )}
                                {booking.expected_attendees && booking.expected_attendees > 0 ? (
                                  <span className="flex items-center gap-1 shrink-0">
                                    <Users size={12} /> {booking.expected_attendees} attendees
                                  </span>
                                ) : null}
                                {booking.archived_at && (
                                  <span className="flex items-center gap-1 shrink-0">
                                    Archived: {new Date(booking.archived_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                              <Badge variant="outline" className="text-xs bg-brand/5 text-brand border-brand/20">
                                Meeting / Slot Booking
                              </Badge>
                              <Badge
                                variant={
                                  booking.status === 'approved'
                                    ? 'success'
                                    : booking.status === 'pending'
                                      ? 'pending'
                                      : booking.status === 'partial'
                                        ? 'warning'
                                        : 'destructive'
                                }
                                className="text-[10px]"
                              >
                                {booking.status}
                              </Badge>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setItemToDelete({ type: 'booking', id: booking.id });
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-textMuted hover:text-error hover:bg-error/10 h-8 w-8 p-0 rounded-lg shrink-0"
                                  title="Delete Archive"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </motion.div>
                  );
                } else if (item.type === 'member') {
                  const member = item.data;
                  return (
                    <motion.div
                      key={`member-${member.id}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className="border border-borderSoft rounded-xl overflow-hidden shadow-sm">
                        <CardHeader className="bg-bgMain border-b border-borderSoft p-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="min-w-0">
                              <CardTitle className="text-lg text-textPrimary break-words">
                                {member.full_name}
                              </CardTitle>
                              <div className="text-sm font-medium text-textSecondary mt-1 flex items-center gap-2">
                                {member.club_name}
                                <span className="text-textMuted text-xs font-normal border border-borderSoft px-1.5 py-0.5 rounded">
                                  {member.designation}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs text-textSecondary">
                                <span className="flex items-center gap-1 shrink-0">
                                  <Calendar size={12} />
                                  Tenure: {member.tenure_start_date ? new Date(member.tenure_start_date).toLocaleDateString('en-GB') : 'N/A'} 
                                  {' '}to{' '} 
                                  {member.tenure_end_date ? new Date(member.tenure_end_date).toLocaleDateString('en-GB') : 'Present'}
                                </span>
                                {member.tenure_end_reason && (
                                  <span className="flex items-center gap-1 shrink-0 text-textMuted">
                                    Reason: {member.tenure_end_reason}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                              <Badge variant="outline" className="text-xs bg-brand/5 text-brand border-brand/20">
                                Member
                              </Badge>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setItemToDelete({ type: 'member', id: member.id });
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="text-textMuted hover:text-error hover:bg-error/10 h-8 w-8 p-0 rounded-lg shrink-0"
                                  title="Permanently Delete Member"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </motion.div>
                  );
                }
              })}
            </>
          );
        })()}

        {allItems.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-4 border-t border-borderSoft gap-4">
            <div className="flex items-center text-xs sm:text-sm text-textMuted">
              Showing <span className="font-semibold text-textPrimary mx-1">{((currentPage - 1) * itemsPerPage) + 1}</span> to{' '}
              <span className="font-semibold text-textPrimary mx-1">{Math.min(currentPage * itemsPerPage, allItems.length)}</span> of{' '}
              <span className="font-semibold text-textPrimary mx-1">{allItems.length}</span> archives
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="h-9 px-2.5 rounded-lg text-xs"
                aria-label="Previous Page"
              >
                <ChevronLeft size={15} className="mr-1" /> Prev
              </Button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((page, idx) =>
                  typeof page === 'number' ? (
                    <Button
                      key={`page-${page}`}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={`h-9 w-9 p-0 text-xs font-semibold rounded-lg ${
                        currentPage === page ? 'bg-brand text-white shadow-sm' : 'hover:bg-bgMain'
                      }`}
                      aria-label={`Go to page ${page}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </Button>
                  ) : (
                    <span key={`dots-${idx}`} className="px-1 text-xs text-textMuted select-none">
                      •••
                    </span>
                  )
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-9 px-2.5 rounded-lg text-xs"
                aria-label="Next Page"
              >
                Next <ChevronRight size={15} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-error flex items-center gap-1.5">
              <Trash2 size={20} />
              Delete Archive Permanently
            </DialogTitle>
            <DialogDescription>
              {itemToDelete?.type === 'event'
                ? 'Are you sure you want to completely delete this event record and all its associated bookings and reports? This action cannot be undone.'
                : 'Are you sure you want to completely delete this archived meeting / slot booking record? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-xl bg-error hover:bg-error/90 text-white font-semibold"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-error flex items-center gap-1.5">
              <Trash2 size={20} />
              Empty All Archives
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to completely delete ALL event records, meetings, bookings, and reports in the
              archives? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setEmptyDialogOpen(false)}
              disabled={isEmptying}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmEmpty}
              disabled={isEmptying}
              className="rounded-xl bg-error hover:bg-error/90 text-white font-semibold"
            >
              {isEmptying ? 'Emptying...' : 'Yes, Empty All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Archives;
