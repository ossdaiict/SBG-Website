import { motion } from 'framer-motion';
import { Archive as ArchiveIcon, Calendar, ChevronLeft, ChevronRight, Download, MapPin, RefreshCw, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Skeleton } from '../components/ui/skeleton';
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
  event_name: string;
  event_type: string;
  archived_at: string;
  venue_name?: string;
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

const Archives: React.FC = () => {
  const [archives, setArchives] = useState<ArchivedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveToDelete, setArchiveToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user?.role === 'admin';

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchArchives = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ArchivedEvent[]>('/api/archives/events', { auth: true });
      setArchives(data);
    } catch (err) {
      console.error('Failed to fetch archives:', err);
      setError(getErrorMessage(err, 'Failed to load archives.'));
      setArchives([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  const confirmDelete = async () => {
    if (!archiveToDelete) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/archives/events/${archiveToDelete}`, { method: 'DELETE', auth: true });
      setArchives(prev => prev.filter(a => a.id !== archiveToDelete));
      setDeleteDialogOpen(false);
    } catch (err) {
      toastError(err, 'Failed to delete archive');
    } finally {
      setIsDeleting(false);
      setArchiveToDelete(null);
    }
  };

  const confirmEmpty = async () => {
    setIsEmptying(true);
    try {
      await apiRequest('/api/archives/events/all', { method: 'DELETE', auth: true });
      setArchives([]);
      setEmptyDialogOpen(false);
      toastSuccess('All archives emptied successfully');
    } catch (err) {
      toastError(err, 'Failed to empty archives');
    } finally {
      setIsEmptying(false);
    }
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
      transition={{ duration: 0.4 }}
      className="space-y-8 px-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <ArchiveIcon className="text-textSecondary" size={32} />
          <div>
            <motion.h1 className="text-3xl sm:text-4xl font-extrabold text-textPrimary tracking-tighter">Database Archives</motion.h1>
            <p className="text-textSecondary mt-1 text-sm font-medium leading-relaxed max-w-xl">
              Historical records of deleted events, their bookings, and reports.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
          {isAdmin && archives.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setEmptyDialogOpen(true)} className="w-full sm:w-auto gap-2 shrink-0">
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

      {!error && archives.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-card border border-borderSoft rounded-2xl shadow-sm">
          <ArchiveIcon size={48} className="text-textMuted mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-textPrimary">No Archives Found</h3>
          <p className="text-textSecondary max-w-sm mt-2 text-sm">
            When events are deleted, their records will appear here for historical reference.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {(() => {
          const totalPages = Math.ceil(archives.length / itemsPerPage);
          const startIndex = (currentPage - 1) * itemsPerPage;
          const paginatedArchives = archives.slice(startIndex, startIndex + itemsPerPage);

          return (
            <>
              {paginatedArchives.map((event, i) => (
                <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border border-borderSoft rounded-xl overflow-hidden shadow-sm">
              <CardHeader className="bg-bgMain border-b border-borderSoft p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-lg text-textPrimary break-words">{event.name}</CardTitle>
                    <div className="text-sm font-medium text-textSecondary mt-1">{event.club_name || 'Unknown Club'}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs text-textSecondary">
                      <span className="flex items-center gap-1 shrink-0"><Calendar size={12}/> {new Date(event.date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</span>
                      {event.venue && <span className="flex items-center gap-1 shrink-0"><MapPin size={12}/> {event.venue}</span>}
                      <span className="flex items-center gap-1 shrink-0">Archived: {new Date(event.archived_at).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                    <Badge variant="outline" className="text-xs bg-bgMain border-borderSoft">Event Record</Badge>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setArchiveToDelete(event.id);
                        setDeleteDialogOpen(true);
                      }}
                      className="text-textMuted hover:text-error hover:bg-error/10 h-8 w-8 p-0 rounded-lg shrink-0"
                      title="Delete Archive"
                    >
                      <Trash2 size={16} />
                    </Button>
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
                      {event.bookings.map(b => (
                        <div key={b.id} className="text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 sm:p-2 rounded-lg bg-bgMain">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-textPrimary">{b.venue_name || 'Unknown Venue'}</span>
                            <span className="text-textSecondary">{new Date(b.start_time).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} - {new Date(b.end_time).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] self-start sm:self-auto shrink-0">{b.status}</Badge>
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
                      <a href={event.report.report_doc_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand hover:underline shrink-0"><Download size={12}/> Doc</a>
                      {event.report.photos_drive_link && (
                        <a href={event.report.photos_drive_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand hover:underline shrink-0"><Download size={12}/> Photos</a>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
        </>
      );
    })()}
        {archives.length > 0 && Math.ceil(archives.length / itemsPerPage) > 1 && (() => {
          const totalPages = Math.ceil(archives.length / itemsPerPage);
          const startIndex = (currentPage - 1) * itemsPerPage;
          return (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-4 border-t border-borderSoft gap-4">
              <div className="flex items-center text-sm text-textMuted">
                Showing <span className="font-medium mx-1">{startIndex + 1}</span> to <span className="font-medium mx-1">{Math.min(startIndex + itemsPerPage, archives.length)}</span> of <span className="font-medium mx-1">{archives.length}</span> results
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
          );
        })()}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-error flex items-center gap-1.5">
              <Trash2 size={20} />
              Delete Archive Permanently
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to completely delete this event record and all its associated bookings and reports? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting} className="rounded-xl bg-error hover:bg-error/90 text-white font-semibold">
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
              Are you sure you want to completely delete ALL event records, bookings, and reports in the archives? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEmptyDialogOpen(false)} disabled={isEmptying} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmEmpty} disabled={isEmptying} className="rounded-xl bg-error hover:bg-error/90 text-white font-semibold">
              {isEmptying ? 'Emptying...' : 'Yes, Empty All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default Archives;
