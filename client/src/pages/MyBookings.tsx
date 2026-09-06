import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, formatISTDate, getISTParts } from '@/lib/utils';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus, RefreshCw } from 'lucide-react';
import React, { useState } from 'react';
import ExtraRoomDialog from '../components/ExtraRoomDialog';
import EditTimingsDialog from '../components/EditTimingsDialog';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { apiRequest, groupBookings, mapBooking, type ApiBooking, type ApiVenue } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { getSocket, SOCKET_EVENTS } from '../lib/socket';
import { toastError, toastInfo } from '../lib/toast';
import { Booking, GroupedBooking, User } from '../types';

interface MyBookingsProps {
  currentUser?: User;
}

const MyBookings: React.FC<MyBookingsProps> = ({ currentUser }) => {
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isExtraRoomOpen, setIsExtraRoomOpen] = useState(false);
  const [selectedBookingForExtra, setSelectedBookingForExtra] = useState<GroupedBooking | null>(null);

  // Edit Timings Dialog State
  const [isEditTimingsOpen, setIsEditTimingsOpen] = useState(false);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<GroupedBooking | null>(null);

  // Cancel Booking Dialog State
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<GroupedBooking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchBookings = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [venuesData, bookingsData] = await Promise.all([
        apiRequest<ApiVenue[]>('/api/venues'),
        apiRequest<ApiBooking[]>('/api/my-bookings', { auth: true }),
      ]);
      setVenues(venuesData);
      setMyBookings(bookingsData.map(mapBooking));
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      setError(getErrorMessage(err, 'Failed to load bookings.'));
      setMyBookings([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Real-time updates
  React.useEffect(() => {
    const socket = getSocket();

    if (myBookings.length > 0) {
      socket.emit(SOCKET_EVENTS.JOIN_CLUB, myBookings[0].clubId);
    }

    const handleStatusChanged = () => fetchBookings();
    const handleEventsUpdated = () => fetchBookings();

    socket.on(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleStatusChanged);
    socket.on(SOCKET_EVENTS.EVENTS_UPDATED, handleEventsUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleStatusChanged);
      socket.off(SOCKET_EVENTS.EVENTS_UPDATED, handleEventsUpdated);
    };
  }, [fetchBookings, myBookings]);

  const getVenueName = (id: string) => venues.find(v => v.id === id)?.name || id;

  const groupedBookings = React.useMemo(() => {
    return groupBookings(myBookings, venues);
  }, [myBookings, venues]);

  const isPastEvent = (booking: GroupedBooking) => {
    return new Date(booking.endTimeISO) < new Date() || booking.status === 'rejected';
  };

  const openExtraRoomDialog = (booking: GroupedBooking) => {
    setSelectedBookingForExtra(booking);
    setIsExtraRoomOpen(true);
  };

  const openEditTimingsDialog = (booking: GroupedBooking) => {
    setSelectedBookingForEdit(booking);
    setIsEditTimingsOpen(true);
  };

  const handleCancelClick = (booking: GroupedBooking) => {
    setBookingToCancel(booking);
    setCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    if (!bookingToCancel) return;
    setIsCancelling(true);
    try {
      for (const id of bookingToCancel.ids) {
        await apiRequest(`/api/my-bookings/${id}`, { method: 'DELETE', auth: true });
      }
      toastInfo('Booking cancelled successfully');
      fetchBookings();
      setCancelDialogOpen(false);
    } catch (err) {
      toastError(err, 'Failed to cancel booking');
    } finally {
      setIsCancelling(false);
      setBookingToCancel(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 px-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <motion.h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-textPrimary tracking-tighter">My Bookings</motion.h1>
          <p className="text-textSecondary mt-2 sm:mt-3 text-sm sm:text-base font-medium leading-relaxed max-w-xl">Track your venue reservations, manage schedules, and submit documentation.</p>
        </div>
      </div>

      <div className="flex bg-card p-1 rounded-xl border border-borderSoft w-fit mt-4">
        <button
          onClick={() => { setTab('active'); setCurrentPage(1); }}
          className={cn(
            "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all",
            tab === 'active' ? "bg-brand text-white shadow-sm" : "text-textMuted hover:text-textPrimary hover:bg-hoverSoft cursor-pointer"
          )}
        >
          Active Bookings
        </button>
        <button
          onClick={() => { setTab('past'); setCurrentPage(1); }}
          className={cn(
            "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all",
            tab === 'past' ? "bg-brand text-white shadow-sm" : "text-textMuted hover:text-textPrimary hover:bg-hoverSoft cursor-pointer"
          )}
        >
          Past Bookings
        </button>
      </div>

      {error && (
        <Alert className="rounded-2xl border-2 border-error/30 bg-error/5">
          <AlertTriangle size={18} className="text-error" />
          <AlertTitle className="font-bold text-error">Could not load bookings</AlertTitle>
          <AlertDescription className="mt-2 text-error/80">{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-4 gap-2 border-error/30 hover:bg-error/5" onClick={fetchBookings}>
            <RefreshCw size={16} /> Retry
          </Button>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-borderSoft rounded-lg p-6 bg-card">
              <Skeleton className="h-32 w-full rounded-md" />
            </Card>
          ))}
        </div>
      ) : !error && myBookings.length === 0 ? (
        <Card className="border-2 border-dashed border-borderSoft rounded-lg p-16 text-center bg-card shadow-none">
          <Calendar className="h-16 w-16 mx-auto text-textMuted/40 mb-4" />
          <p className="text-textPrimary text-lg font-bold">No bookings found.</p>
          <p className="text-textMuted mt-1 font-medium">You don't have any {tab} bookings right now.</p>
        </Card>
      ) : (
        <div className="grid gap-6 pb-12">
          {(() => {
            const filteredBookings = groupedBookings.filter(b => (tab === 'active' ? !isPastEvent(b) : isPastEvent(b)));
            const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const paginatedBookings = filteredBookings.slice(startIndex, startIndex + itemsPerPage);

            return (
              <>
                {paginatedBookings.map((booking, index) => {
            const isPast = isPastEvent(booking);
            const approvedVenues = booking.bookings.filter(b => b.status === 'approved');
            const rejectedVenues = booking.bookings.filter(b => b.status === 'rejected');
            const pendingVenues = booking.bookings.filter(b => b.status === 'pending');

            return (
              <motion.div
                key={booking.ids.join('-')}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <Card className={cn("border rounded-lg overflow-hidden bg-card hover:shadow-md transition-all duration-300", isPast ? "border-borderSoft/50 opacity-75" : "border-borderSoft hover:border-brand/50")}>
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                      <div className={cn("w-full md:w-28 h-28 rounded-lg flex flex-col items-center justify-center shrink-0 border border-borderSoft", isPast ? 'bg-hoverSoft/40 text-textMuted' : 'bg-card text-brand')}>
                        <span className="text-xs font-bold uppercase tracking-wider">{formatISTDate(booking.date, { month: 'short' })}</span>
                        <span className="text-3xl font-extrabold leading-none">{getISTParts(booking.date).date}</span>
                        <span className="text-xs mt-1 opacity-80">{getISTParts(booking.date).year}</span>
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className={cn("text-2xl font-bold", (booking.eventName && booking.eventName !== booking.bookingName) ? "mb-1" : "mb-2", isPast ? 'text-textMuted' : 'text-textPrimary')}>{booking.bookingName}</h3>
                            {booking.eventName && booking.eventName !== booking.bookingName && (
                              <p className={cn("text-sm mb-3 font-medium", isPast ? 'text-textMuted/70' : 'text-textMuted')}>Linked Event: {booking.eventName}</p>
                            )}
                            {booking.eventType && (
                              <Badge variant="outline" className="text-[10px] h-5 mb-3">
                                {booking.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                              </Badge>
                            )}
                            <div className="flex items-center gap-2 text-sm mb-4 font-medium text-textSecondary">
                              <Clock size={16} className="text-brand" />
                              <span>
                                {formatISTDate(booking.date, {
                                    month: 'short', day: 'numeric', year: 'numeric' })}, {booking.startTime} –{' '}
                                {formatISTDate(booking.endDate || booking.date, {
                                    month: 'short', day: 'numeric', year: 'numeric' })}, {booking.endTime}
                              </span>
                            </div>

                            <div className="space-y-3 mt-4">
                              {approvedVenues.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-success uppercase tracking-widest block">Approved Locations</span>
                                  <div className="flex flex-wrap gap-2">
                                    {approvedVenues.map(v => (
                                      <Badge key={v.id} variant="success" className="bg-success/5 text-success border-success/20 py-1 px-2.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                                        <MapPin size={12} /> {getVenueName(v.venueId)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {rejectedVenues.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-error uppercase tracking-widest block">Rejected Locations</span>
                                  <div className="flex flex-wrap gap-2">
                                    {rejectedVenues.map(v => (
                                      <Badge key={v.id} variant="destructive" className="bg-error/5 text-error border-error/20 py-1 px-2.5 rounded-lg flex items-center gap-1.5 opacity-80 shadow-sm">
                                        <MapPin size={12} /> {getVenueName(v.venueId)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {pendingVenues.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-warning uppercase tracking-widest block">Pending Confirmation</span>
                                  <div className="flex flex-wrap gap-2">
                                    {pendingVenues.map(v => (
                                      <Badge key={v.id} variant="warning" className="bg-warning/5 text-warning border-warning/20 py-1 px-2.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                                        <MapPin size={12} /> {getVenueName(v.venueId)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex flex-col items-end">
                            <Badge className={cn("px-4 py-2 font-bold text-sm rounded-full border-2",
                              booking.status === 'approved' ? (isPast ? 'bg-success/10 text-success border-success/30' : 'bg-brand/10 text-brand border-brand/30') :
                                booking.status === 'pending' || booking.status === 'partial' ? 'bg-warning/10 text-warning border-warning/30' : 'bg-error/10 text-error border-error/30'
                            )}>
                              {isPast ? '✓ Completed' : booking.status === 'pending' ? '⏳ Pending' : booking.status === 'partial' ? '⚠ Partial' : '✓ ' + booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-borderSoft/50 flex flex-wrap items-center justify-start gap-1">
                          {(!isPast || currentUser?.role === 'admin') && (booking.status === 'approved' || booking.status === 'pending' || booking.status === 'partial') && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openEditTimingsDialog(booking)} className="gap-2 rounded-lg font-semibold bg-brand/5 text-brand border-brand/20 hover:bg-brand/10 shadow-sm">
                                <Clock className="h-4 w-4" /> Edit Timings
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openExtraRoomDialog(booking)} className="gap-2 rounded-lg font-semibold bg-brand/5 text-brand border-brand/20 hover:bg-brand/10 shadow-sm">
                                <Plus className="h-4 w-4" /> Request Extra Room
                              </Button>
                            </>
                          )}
                          {(!isPast || booking.status === 'rejected' || currentUser?.role === 'admin') && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleCancelClick(booking)} 
                              className="gap-2 rounded-lg font-semibold bg-error/5 text-error border-error/20 hover:bg-error/10 shadow-sm"
                            >
                              {booking.status === 'rejected' || isPast ? 'Delete Record' : 'Cancel Booking'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          
          {filteredBookings.length > 0 && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-4 border-t border-borderSoft gap-4">
              <div className="flex items-center text-sm text-textMuted">
                Showing <span className="font-medium mx-1">{startIndex + 1}</span> to <span className="font-medium mx-1">{Math.min(startIndex + itemsPerPage, filteredBookings.length)}</span> of <span className="font-medium mx-1">{filteredBookings.length}</span> results
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                  <ChevronLeft size={16} className="mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                  Next <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}
          </>
        )
      })()}
        </div>
      )}

      <ExtraRoomDialog
        booking={selectedBookingForExtra}
        open={isExtraRoomOpen}
        onOpenChange={setIsExtraRoomOpen}
        onSuccess={fetchBookings}
      />
      <EditTimingsDialog
        booking={selectedBookingForEdit}
        open={isEditTimingsOpen}
        onOpenChange={setIsEditTimingsOpen}
        onUpdated={fetchBookings}
      />
      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl bg-card border border-borderSoft text-textPrimary">
          <DialogHeader>
            <DialogTitle className="text-error flex items-center gap-1.5">
              <AlertTriangle size={20} />
              Cancel Booking
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={isCancelling} className="rounded-xl">
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={isCancelling} className="rounded-xl bg-error hover:bg-error/90 text-white font-semibold">
              {isCancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default MyBookings;