import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Calendar, Check, CheckCircle, ChevronDown, ChevronRight, Clock, Filter, MapPin, Pencil, RefreshCw, Search, X, XCircle, RotateCcw, ExternalLink } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { apiRequest, groupBookings, mapBooking, type ApiBooking, type ApiVenue } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { getSocket } from '../lib/socket';
import { toastError, toastSuccess } from '../lib/toast';
import { GroupedBooking, Booking } from '../types';
import EditBookingDialog from '../components/EditBookingDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const AdminRequests: React.FC = () => {
  const [requests, setRequests] = useState<GroupedBooking[]>([]);
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterStatus, setFilterStatusInternal] = useState<string>(searchParams.get('status') || 'all');
  
  const setFilterStatus = (status: string) => {
    setFilterStatusInternal(status);
    const newParams = new URLSearchParams(searchParams);
    if (status === 'all') {
      newParams.delete('status');
    } else {
      newParams.set('status', status);
    }
    setSearchParams(newParams, { replace: true });
  };
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClub, setFilterClub] = useState<string>('all');
  const [filterVenue, setFilterVenue] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const fetchRequests = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [venuesData, bookingsData] = await Promise.all([
        apiRequest<ApiVenue[]>('/api/venues'),
        apiRequest<ApiBooking[]>('/api/admin/bookings', { auth: true }),
      ]);
      setVenues(venuesData);
      setRequests(groupBookings(bookingsData.map(mapBooking)));
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError(getErrorMessage(err, 'Failed to load requests.'));
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Socket.io updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleBookingNew = () => {
      fetchRequests();
    };

    const handleEventsUpdated = () => {
      fetchRequests();
    };

    socket.on('booking:new', handleBookingNew);
    socket.on('events:updated', handleEventsUpdated);
    socket.on('booking:status_changed', handleEventsUpdated);

    return () => {
      socket.off('booking:new', handleBookingNew);
      socket.off('events:updated', handleEventsUpdated);
      socket.off('booking:status_changed', handleEventsUpdated);
    };
  }, [fetchRequests]);

  const handleAction = async (ids: string[], action: 'approved' | 'rejected' | 'pending') => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      await apiRequest('/api/admin/bookings/bulk-status', {
        method: 'PATCH',
        auth: true,
        body: { ids, status: action },
      });
      toastSuccess(`Request(s) ${action === 'approved' ? 'approved' : 'rejected'} successfully`);
      fetchRequests();
    } catch (err) {
      console.error('Failed to update request(s):', err);
      toastError(err, `Failed to ${action} request(s). Please try again.`);
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
      toastError(err, 'Failed to send email.');
    }
  };

  const getVenueName = React.useCallback((id: string) => venues.find(v => v.id === id)?.name || id, [venues]);

  const uniqueClubs = Array.from(new Set(requests.map(req => req.clubName))).sort();

  const filteredRequests = requests.filter(req => {
    const safeBookings = req.bookings || [];
    const isStarted = safeBookings[0]?.startTimeISO ? new Date(safeBookings[0].startTimeISO) <= new Date() : false;
    const isPending = req.status === 'pending' || (req.status === 'partial' && safeBookings.some(b => b.status === 'pending'));
    const matchesSearch = String(req.eventName || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(req.bookingName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClub = filterClub === 'all' || req.clubName === filterClub;
    const matchesVenue = filterVenue === 'all' || safeBookings.some(b => b.venueId === filterVenue);

    let matchesStatus = true;
    if (filterStatus === 'pending') {
      matchesStatus = isPending && !isStarted;
    } else if (filterStatus !== 'all') {
      matchesStatus = req.status === filterStatus;
    }

    return matchesSearch && matchesClub && matchesVenue && matchesStatus;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-textPrimary tracking-tight leading-tight">Request Management</h1>
          <p className="text-textMuted mt-2 text-sm sm:text-base font-medium">Review and take action on venue bookings.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-3 w-full xl:w-auto mt-4 xl:mt-0">
          <Select value={filterClub} onValueChange={setFilterClub}>
            <SelectTrigger className="w-full sm:w-[140px] rounded-xl">
              <SelectValue placeholder="All Clubs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clubs</SelectItem>
              {uniqueClubs.map(club => (
                <SelectItem key={club} value={club}>{club}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterVenue} onValueChange={setFilterVenue}>
            <SelectTrigger className="w-full sm:w-[140px] rounded-xl">
              <SelectValue placeholder="All Venues" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              {venues.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[140px] rounded-xl">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-2.5 text-textMuted pointer-events-none" size={18} />
            <Input
              type="text"
              placeholder="Search requests..."
              className="pl-10 w-full rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle size={16} />
          <AlertTitle>Could not load requests</AlertTitle>
          <AlertDescription className="mt-1">{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={fetchRequests}>
            <RefreshCw size={14} />
            Retry
          </Button>
        </Alert>
      )}

      <Card className="rounded-xl overflow-hidden mt-6">
        {isLoading ? (
          <CardContent className="p-6">
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-12 w-full mb-4" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        ) : filteredRequests.length > 0 ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[600px] sm:min-w-0 text-left text-sm">
              <thead className="bg-hoverSoft border-b border-borderSoft uppercase tracking-wider text-xs font-semibold text-textMuted">
                <tr>
                  <th className="px-4 sm:px-6 py-4 w-[40%] sm:w-[35%]">Booking</th>
                  <th className="px-4 sm:px-6 py-4 w-[15%]">Venue</th>
                  <th className="px-4 sm:px-6 py-4 w-[35%] sm:w-[25%]">Date & Time</th>
                  <th className="px-4 sm:px-6 py-4 w-[10%]">Status</th>
                  <th className="px-4 sm:px-6 py-4 text-right w-[15%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredRequests.map((req, index) => (
                  <AdminRequestRow
                    key={req.batchId || req.ids[0]}
                    req={req}
                    index={index}
                    venues={venues}
                    handleAction={handleAction}
                    handleSendEmail={handleSendEmail}
                    getVenueName={getVenueName}
                    isHistoryTab={false}
                    isProcessingAction={isProcessingAction}
                    onEdit={(booking) => {
                      setEditingBooking(booking);
                      setIsEditDialogOpen(true);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CardContent className="p-8 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-hoverSoft text-textMuted mb-4">
              <Filter size={24} />
            </div>
            <h3 className="text-lg font-medium text-textPrimary">No requests found</h3>
            <p className="text-textMuted mt-1">Try adjusting your search or filters.</p>
          </CardContent>
        )}
      </Card>

      <EditBookingDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        booking={editingBooking}
        onUpdated={fetchRequests}
      />
    </motion.div>
  );
};

interface AdminRequestRowProps {
  req: GroupedBooking;
  index: number;
  venues: ApiVenue[];
  handleAction: (ids: string[], action: 'approved' | 'rejected' | 'pending') => Promise<void>;
  handleSendEmail: (batchId: string | undefined, eventId: string | undefined) => Promise<void>;
  getVenueName: (id: string) => string;
  isHistoryTab: boolean;
  isProcessingAction: boolean;
  onEdit: (booking: Booking) => void;
}

const AdminRequestRow: React.FC<AdminRequestRowProps> = ({ req, index, venues, handleAction, handleSendEmail, getVenueName, isHistoryTab, isProcessingAction, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const safeBookings = req.bookings || [];
  const isMultiVenue = safeBookings.length > 1;

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'destructive';
      case 'partial': return 'warning';
      default: return 'pending';
    }
  };

  const safeStatus = req.status || 'pending';
  const isStarted = safeBookings[0]?.startTimeISO ? new Date(safeBookings[0].startTimeISO) <= new Date() : false;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        className={cn(
          "hover:bg-hoverSoft transition-colors cursor-pointer",
          isExpanded && "bg-hoverSoft/50"
        )}
        onClick={() => isMultiVenue && setIsExpanded(!isExpanded)}
      >
        <td className="px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2">
            {isMultiVenue && (
              <div className="text-textMuted">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            )}
            <div>
              <div className="font-semibold text-textPrimary flex items-center gap-2">
                {req.bookingName || req.eventName}
                {req.issueFlag && (
                  <div className="text-warning" title={req.issueFlag}>
                    <AlertTriangle size={14} />
                  </div>
                )}
              </div>
              {req.bookingName && req.bookingName !== req.eventName && (
                <div className="text-xs text-textMuted mt-0.5 font-medium">Event: {req.eventName}</div>
              )}
              <div className="text-xs text-textMuted mt-0.5">{req.clubName}</div>
              {req.permissionsLink && (
                <div className="mt-3 mb-1">
                  <a
                    href={req.permissionsLink.match(/^https?:\/\//) ? req.permissionsLink : `https://${req.permissionsLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center gap-1 sm:gap-1.5 p-[1px] px-1.5 rounded-[2rem] border border-brand/30 bg-transparent text-[11px] sm:text-[13px] font-medium text-brand hover:bg-brand/10 transition-colors w-fit"
                  >
                    <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    View Permissions
                  </a>
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <div className="flex items-center gap-1.5 text-textPrimary">
            {req.venueName}
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-textMuted shrink-0" />
              <div className="flex flex-col text-xs space-y-0.5">
                <span className="whitespace-nowrap">{new Date(req.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })} {req.startTime}</span>
                <span className="text-textMuted text-[10px]">to</span>
                <span className="whitespace-nowrap">{new Date(req.endDate || req.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })} {req.endTime}</span>
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <Badge variant={getStatusVariant(safeStatus)}>
            {safeStatus === 'partial' ? 'Partial' : String(safeStatus).charAt(0).toUpperCase() + String(safeStatus).slice(1)}
          </Badge>
        </td>
        <td className="px-4 sm:px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); handleSendEmail(req.batchId, safeBookings[0]?.event_id); }}
              className="text-xs"
              title="Send an email to the club with the current status of all venues in this booking"
              disabled={isProcessingAction}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              Send Mail
            </Button>
            {!isStarted && (
              <>
                {/* Single-venue: show individual approve/reject directly on the row */}
                {!isMultiVenue && safeBookings[0]?.status !== 'rejected' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Reject venue"
                    onClick={(e) => { e.stopPropagation(); handleAction([safeBookings[0].id], 'rejected'); }}
                    className="text-textMuted hover:text-error"
                    title="Reject this venue"
                    disabled={isProcessingAction}
                  >
                    <XCircle size={18} />
                  </Button>
                )}
                {!isMultiVenue && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit booking"
                    onClick={(e) => { e.stopPropagation(); onEdit(safeBookings[0]); }}
                    className="text-textMuted hover:text-primary"
                    title="Edit booking timings"
                    disabled={isProcessingAction}
                  >
                    <Pencil size={16} />
                  </Button>
                )}
                {!isMultiVenue && safeBookings[0]?.status !== 'approved' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Approve venue"
                    onClick={(e) => { e.stopPropagation(); handleAction([safeBookings[0].id], 'approved'); }}
                    className="text-primary hover:text-primary/80"
                    title="Approve this venue"
                    disabled={isProcessingAction}
                  >
                    <CheckCircle size={18} />
                  </Button>
                )}
                {!isMultiVenue && safeBookings[0]?.status !== 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Move to pending"
                    onClick={(e) => { e.stopPropagation(); handleAction([safeBookings[0].id], 'pending'); }}
                    className="text-textMuted hover:text-warning"
                    title="Move to pending"
                    disabled={isProcessingAction}
                  >
                    <RotateCcw size={18} />
                  </Button>
                )}
                {/* Multi-venue: show bulk Reject All / Approve All; individual controls are in the expanded panel */}
                {isMultiVenue && req.status !== 'rejected' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleAction(req.ids, 'rejected'); }}
                    className="text-textMuted hover:text-error text-xs"
                    title="Reject all venues"
                    disabled={isProcessingAction}
                  >
                    <XCircle size={15} className="mr-1" />
                    <span className="hidden sm:inline">Reject All</span>
                  </Button>
                )}
                {isMultiVenue && req.status !== 'approved' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleAction(req.ids, 'approved'); }}
                    className="text-primary hover:text-primary/80 text-xs"
                    title="Approve all venues"
                    disabled={isProcessingAction}
                  >
                    <CheckCircle size={15} className="mr-1" />
                    <span className="hidden sm:inline">Approve All</span>
                  </Button>
                )}
                {isMultiVenue && req.status !== 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleAction(req.ids, 'pending'); }}
                    className="text-textMuted hover:text-warning text-xs"
                    title="Move all to pending"
                    disabled={isProcessingAction}
                  >
                    <RotateCcw size={15} className="mr-1" />
                    <span className="hidden sm:inline">Pending All</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </td>
      </motion.tr>

      {/* Expanded view for multi-venue details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-primary/5"
          >
            <td colSpan={5} className="px-6 py-4">
              <div className="space-y-3">
                <div className="text-xs font-bold text-textMuted uppercase tracking-wider mb-2">Individual Venue Statuses</div>
                {safeBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-borderSoft shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{getVenueName(booking.venueId)}</span>
                        <div className="flex flex-col text-xs text-textMuted mt-0.5 space-y-0.5">
                          <span className="whitespace-nowrap">{new Date(booking.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })} {booking.startTime}</span>
                          <span className="text-[10px]">to</span>
                          <span className="whitespace-nowrap">{new Date(booking.endDate || booking.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric' })} {booking.endTime}</span>
                        </div>
                        {booking.issueFlag && (
                          <span className="text-[10px] font-medium text-warning mt-0.5 flex items-center gap-1">
                            <AlertTriangle size={10} /> {booking.issueFlag}
                          </span>
                        )}
                      </div>
                      <Badge variant={booking.status === 'approved' ? 'success' : booking.status === 'rejected' ? 'destructive' : 'pending'} className="text-[10px] h-5">
                        {booking.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isStarted && booking.status !== 'rejected' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction([booking.id], 'rejected')}
                          className="h-8 w-8 p-0 text-textMuted hover:text-error"
                          title="Reject this venue"
                          disabled={isProcessingAction}
                        >
                          <X size={16} />
                        </Button>
                      )}
                      {!isStarted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(booking)}
                          className="h-8 w-8 p-0 text-textMuted hover:text-primary"
                          title="Edit booking timings"
                          disabled={isProcessingAction}
                        >
                          <Pencil size={14} />
                        </Button>
                      )}
                      {!isStarted && booking.status !== 'approved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction([booking.id], 'approved')}
                          className="h-8 w-8 p-0 text-primary hover:text-primary/80"
                          title="Approve this venue"
                          disabled={isProcessingAction}
                        >
                          <Check size={16} />
                        </Button>
                      )}
                      {!isStarted && booking.status !== 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction([booking.id], 'pending')}
                          className="h-8 w-8 p-0 text-textMuted hover:text-warning"
                          title="Move to pending"
                          disabled={isProcessingAction}
                        >
                          <RotateCcw size={16} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdminRequests;
