import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock, Filter, RefreshCw, Search, Trash2, XCircle, RotateCcw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { apiRequest } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { getSocket } from '../lib/socket';
import { toastError, toastSuccess } from '../lib/toast';
import { AppEvent } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const AdminEventRequests: React.FC = () => {
  const [events, setEvents] = useState<(AppEvent & { clubName: string })[]>([]);
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
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchEvents = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const eventsData = await apiRequest<any[]>('/api/admin/events', { auth: true });
      setEvents(eventsData.map(e => ({
        ...e,
        clubName: e.clubs?.name || 'Unknown Club'
      })));
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError(getErrorMessage(err, 'Failed to load events.'));
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Socket.io updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleEventsUpdated = () => {
      fetchEvents();
    };

    socket.on('events:updated', handleEventsUpdated);

    return () => {
      socket.off('events:updated', handleEventsUpdated);
    };
  }, [fetchEvents]);

  const handleEventAction = async (ids: string[], action: 'active' | 'rejected' | 'pending') => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      await apiRequest('/api/admin/events/bulk-status', {
        method: 'PATCH',
        auth: true,
        body: { ids, status: action },
      });
      toastSuccess(`Event(s) ${action === 'active' ? 'approved' : 'rejected'} successfully`);
      fetchEvents();
    } catch (err) {
      console.error('Failed to update event(s):', err);
      toastError(err, `Failed to ${action} event(s). Please try again.`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDeleteEvent = (id: string) => {
    setEventToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/events/${eventToDelete}`, {
        method: 'DELETE',
        auth: true,
      });
      toastSuccess('Event deleted and archived successfully');
      fetchEvents();
      setDeleteDialogOpen(false);
    } catch (err) {
      console.error('Failed to delete event:', err);
      toastError(err, 'Failed to delete event. Please try again.');
    } finally {
      setIsDeleting(false);
      setEventToDelete(null);
    }
  };

  const uniqueClubs = Array.from(new Set(events.map(ev => ev.clubName))).sort();
  const uniqueTypes = Array.from(new Set(events.map(ev => ev.event_type).filter(Boolean))).sort();

  const filteredEvents = events.filter(ev => {
    const matchesSearch = String(ev.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClub = filterClub === 'all' || (ev.clubName && ev.clubName.toLowerCase() === filterClub.toLowerCase());
    const matchesType = filterType === 'all' || ev.event_type === filterType;
    let matchesStatus = true;
    if (filterStatus !== 'all') {
      matchesStatus = ev.status === filterStatus;
    }
    return matchesSearch && matchesClub && matchesType && matchesStatus;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterClub, filterType, filterStatus]);

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEvents = filteredEvents.slice(startIndex, startIndex + itemsPerPage);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-textPrimary tracking-tight leading-tight">Event Registrations</h1>
          <p className="text-textMuted mt-2 text-sm sm:text-base font-medium">Review and take action on event registrations.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-3 w-full xl:w-auto mt-4 xl:mt-0">
          <Select value={filterClub} onValueChange={setFilterClub}>
            <SelectTrigger className="w-full sm:flex-1 sm:min-w-[140px] rounded-xl">
              <SelectValue placeholder="All Clubs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clubs</SelectItem>
              {uniqueClubs.map(club => (
                <SelectItem key={club} value={club}>{club}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:flex-1 sm:min-w-[140px] rounded-xl">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueTypes.map(type => (
                <SelectItem key={type as string} value={type as string}>{(type as string).replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:flex-1 sm:min-w-[140px] rounded-xl">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full sm:flex-1 sm:min-w-[250px] xl:flex-none xl:w-64 shrink-0">
            <Search className="absolute left-3 top-2.5 text-textMuted pointer-events-none z-10" size={18} />
            <Input
              type="text"
              placeholder="Search events..."
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
          <AlertTitle>Could not load events</AlertTitle>
          <AlertDescription className="mt-1">{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={fetchEvents}>
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
        ) : filteredEvents.length > 0 ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-hoverSoft border-b border-borderSoft uppercase tracking-wider text-xs font-semibold text-textMuted text-left">
                <tr>
                  <th className="px-3 py-2 sm:py-4 w-[35%] text-left">Event</th>
                  <th className="px-3 py-2 sm:py-4 w-[30%] text-left">Date & Time</th>
                  <th className="px-3 py-2 sm:py-4 w-[15%] text-left">Status</th>
                  <th className="px-3 py-2 sm:py-4 w-[20%] text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paginatedEvents.map((ev, index) => (
                  <AdminEventRow
                    key={ev.id}
                    ev={ev}
                    index={index}
                    handleAction={handleEventAction}
                    handleDelete={handleDeleteEvent}
                    isProcessingAction={isProcessingAction}
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
            <h3 className="text-lg font-medium text-textPrimary">No event registrations found</h3>
            <p className="text-textMuted mt-1">Try adjusting your search or filters.</p>
          </CardContent>
        )}
        {filteredEvents.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 sm:px-6 border-t border-borderSoft bg-card gap-4">
            <div className="flex items-center text-sm text-textMuted">
              Showing <span className="font-medium mx-1">{startIndex + 1}</span> to <span className="font-medium mx-1">{Math.min(startIndex + itemsPerPage, filteredEvents.length)}</span> of <span className="font-medium mx-1">{filteredEvents.length}</span> results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} className="mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl bg-card border border-borderSoft text-textPrimary">
          <DialogHeader>
            <DialogTitle className="text-error flex items-center gap-1.5">
              <Trash2 size={20} />
              Delete Event Permanently
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to completely delete this event? This will archive all associated bookings and event reports. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteEvent} disabled={isDeleting} className="rounded-xl bg-error hover:bg-error/90 text-white font-semibold">
              {isDeleting ? 'Deleting...' : 'Yes, Delete Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

interface AdminEventRowProps {
  ev: AppEvent & { clubName: string };
  index: number;
  handleAction: (ids: string[], action: 'active' | 'rejected' | 'pending') => Promise<void>;
  handleDelete: (id: string) => void;
  isProcessingAction: boolean;
}

const AdminEventRow: React.FC<AdminEventRowProps> = ({ ev, index, handleAction, handleDelete, isProcessingAction }) => {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'rejected': return 'destructive';
      case 'pending': return 'pending';
      default: return 'pending';
    }
  };

  const safeStatus = ev.status || 'pending';

  return (
    <motion.tr
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="hover:bg-hoverSoft transition-colors"
    >
      <td className="px-3 py-2 sm:py-4">
        <div className="flex items-center gap-2">
          <div>
            <div className="font-semibold text-textPrimary flex items-center gap-2">
              {ev.name}
              {ev.status === 'pending' && (
                <div className="text-warning" title="Short Notice Registration">
                  <AlertTriangle size={14} />
                </div>
              )}
            </div>
            <div className="text-xs text-textMuted mt-0.5">{ev.clubName}</div>
            <div className="text-xs text-textMuted mt-1">
              Type: {ev.event_type ? ev.event_type.replace('_', ' ') : 'N/A'}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 sm:py-4 whitespace-nowrap">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="font-medium text-textPrimary">Start:</span>
            <div className="flex items-center gap-1.5 text-textMuted">
              <Calendar size={14} className="shrink-0" />
              <span>{new Date(ev.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' })}</span>
              <Clock size={14} className="shrink-0 ml-1" />
              <span>{new Date(ev.date).toLocaleTimeString([], { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="font-medium text-textPrimary">End:</span>
            <div className="flex items-center gap-1.5 text-textMuted">
              <Calendar size={14} className="shrink-0" />
              <span>{ev.dynamic_end_date ? new Date(ev.dynamic_end_date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' }) : '?'}</span>
              <Clock size={14} className="shrink-0 ml-1" />
              <span>{ev.dynamic_end_date ? new Date(ev.dynamic_end_date).toLocaleTimeString([], { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '?'}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 sm:py-4">
        <Badge variant={getStatusVariant(safeStatus)}>
          {String(safeStatus).charAt(0).toUpperCase() + String(safeStatus).slice(1)}
        </Badge>
      </td>
      <td className="px-3 py-2 sm:py-4">
        <div className="flex items-center justify-start gap-1" onClick={(e) => e.stopPropagation()}>
          {ev.status !== 'rejected' && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Reject Event"
              onClick={(e) => { e.stopPropagation(); handleAction([ev.id], 'rejected'); }}
              className="text-textMuted hover:text-error"
              title="Reject Event"
              disabled={isProcessingAction}
            >
              <XCircle size={18} />
            </Button>
          )}
          {ev.status !== 'active' && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Approve Event"
              onClick={(e) => { e.stopPropagation(); handleAction([ev.id], 'active'); }}
              className="text-primary hover:text-primary/80"
              title="Approve Event"
              disabled={isProcessingAction}
            >
              <CheckCircle size={18} />
            </Button>
          )}
          {ev.status !== 'pending' && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Move to Pending"
              onClick={(e) => { e.stopPropagation(); handleAction([ev.id], 'pending'); }}
              className="text-textMuted hover:text-warning"
              title="Move to Pending"
              disabled={isProcessingAction}
            >
              <RotateCcw size={18} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete Event"
            onClick={(e) => { e.stopPropagation(); handleDelete(ev.id); }}
            className="text-textMuted hover:text-error"
            title="Delete Event Permanently"
            disabled={isProcessingAction}
          >
            <Trash2 size={18} />
          </Button>
        </div>
      </td>
    </motion.tr>
  );
};

export default AdminEventRequests;
