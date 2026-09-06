import { motion } from 'framer-motion';
import { CheckCircle, ChevronDown, Download, FileText } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GlassCard } from '../components/glass-card';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { apiRequest } from '../lib/api';
import { toastError } from '../lib/toast';
import { cn } from '../lib/utils';
export default function EventReports() {
  const [pending, setPending] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState<any[]>([]);
  const [tab, setTab] = useState<'pending' | 'submitted'>('pending');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Form State
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [form, setForm] = useState({
    level: 'institutional',
    report_doc_link: '',
    participants_sheet_link: '',
    photos_drive_link: '',
    awards_doc_link: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const p = await apiRequest<any[]>('/api/event-reports/pending', { auth: true });
      const s = await apiRequest<any[]>('/api/event-reports', { auth: true });
      const settingsData = await apiRequest<Record<string, string>>('/api/settings', { auth: false }).catch(() => ({} as Record<string, string>));
      setPending(p);
      setSubmitted(s);
      setSettings(settingsData);
    } catch (e: any) {
      toastError('Failed to fetch event reports', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId && !editingReportId) return;

    try {
      if (editingReportId) {
        await apiRequest(`/api/event-reports/${editingReportId}`, {
          method: 'PUT',
          auth: true,
          body: {
            ...form
          }
        });
        toast.success('Event Report Updated!');
      } else {
        await apiRequest('/api/event-reports', {
          method: 'POST',
          auth: true,
          body: {
            event_id: selectedEventId,
            ...form
          }
        });
        toast.success('Event Report Submitted!');
      }
      closeDialog();
      fetchData();
    } catch (error: any) {
      toastError(editingReportId ? 'Update failed' : 'Submission failed', error);
    }
  };

  const handleEdit = (report: any) => {
    setEditingReportId(report.id);
    setForm({
      level: report.level || 'institutional',
      report_doc_link: report.report_doc_link || '',
      participants_sheet_link: report.participants_sheet_link || '',
      photos_drive_link: report.photos_drive_link || '',
      awards_doc_link: report.awards_doc_link || '',
    });
  };

  const closeDialog = () => {
    setSelectedEventId(null);
    setEditingReportId(null);
    setForm({
      level: 'institutional',
      report_doc_link: '',
      participants_sheet_link: '',
      photos_drive_link: '',
      awards_doc_link: '',
    });
  };

  const getDeadlineText = (event: any) => {
    if (!event.final_end_date) return '';
    const date = new Date(event.final_end_date);
    // Rough calculation matching backend rules
    const next7Days = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const deadline = new Date(Math.min(next7Days.getTime(), endOfMonth.getTime()));
    
    const now = new Date();
    const isPast = now > deadline;
    return (
      <span className={isPast ? "text-error font-semibold" : "text-brand"}>
        Due by: {deadline.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })} {isPast && "(Overdue!)"}
      </span>
    );
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
          <motion.h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-textPrimary tracking-tighter">Event Reports</motion.h1>
          <p className="text-textSecondary mt-2 sm:mt-3 text-sm sm:text-base font-medium leading-relaxed max-w-xl">
            Submit reports for your past events. If reports are overdue (7 days or end of month), you will not be able to make new bookings.
          </p>
        </div>
        {(settings.event_report_format_link || settings.awards_format_link) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-xl shrink-0 shadow-sm border-borderSoft bg-card hover:bg-hoverSoft">
                <Download size={16} className="text-brand" />
                Report Format Links
                <ChevronDown size={14} className="text-textMuted ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[200px] rounded-xl">
              {settings.event_report_format_link && (
                <DropdownMenuItem asChild className="cursor-pointer">
                  <a href={settings.event_report_format_link} target="_blank" rel="noreferrer" className="flex items-center">
                    <FileText size={16} className="mr-2 text-brand" />
                    Event Report Format
                  </a>
                </DropdownMenuItem>
              )}
              {settings.awards_format_link && (
                <DropdownMenuItem asChild className="cursor-pointer">
                  <a href={settings.awards_format_link} target="_blank" rel="noreferrer" className="flex items-center">
                    <FileText size={16} className="mr-2 text-brand" />
                    Awards Format
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

        <div className="flex bg-card p-1 rounded-xl border border-borderSoft w-fit">
          <button
            onClick={() => setTab('pending')}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === 'pending' ? "bg-brand text-white shadow-sm" : "text-textMuted hover:text-textPrimary hover:bg-hoverSoft cursor-pointer"
            )}
          >
            Pending Reports ({pending.length})
          </button>
          <button
            onClick={() => setTab('submitted')}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-semibold transition-all",
              tab === 'submitted' ? "bg-brand text-white shadow-sm" : "text-textMuted hover:text-textPrimary hover:bg-hoverSoft cursor-pointer"
            )}
          >
            Submitted Reports
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <GlassCard key={i} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 w-full max-w-sm">
                  <Skeleton className="h-6 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/2 rounded-md" />
                  <Skeleton className="h-4 w-1/3 rounded-md" />
                </div>
                <Skeleton className="h-10 w-32 rounded-md shrink-0" />
              </GlassCard>
            ))}
          </div>
        ) : (
          <>
            {tab === 'pending' && (
          <div className="space-y-4">
            {pending.length === 0 ? (
              <Card className="border-2 border-dashed border-borderSoft rounded-lg p-16 text-center bg-card shadow-none">
                <CheckCircle className="h-16 w-16 mx-auto text-textMuted/60 mb-4" />
                <p className="text-textMuted text-lg font-semibold">You have no pending event reports.</p>
              </Card>
            ) : (
              pending.map(p => (
                <div key={p.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-borderSoft rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg text-textPrimary">{p.name}</h3>
                    <p className="text-sm text-textMuted">Ended: {new Date(p.final_end_date).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</p>
                    <p className="text-sm mt-1">{getDeadlineText(p)}</p>
                  </div>
                  <Button className="shrink-0 rounded-xl bg-brand text-white hover:bg-brand/90" onClick={() => setSelectedEventId(p.id)}>Submit Report</Button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'submitted' && (
          <div className="space-y-4">
            {submitted.length === 0 ? (
              <Card className="border-2 border-dashed border-borderSoft rounded-lg p-16 text-center bg-card shadow-none">
                <FileText className="h-16 w-16 mx-auto text-textMuted/40 mb-4" />
                <p className="text-textMuted text-lg font-semibold">No reports submitted yet.</p>
              </Card>
            ) : (
              submitted.map(s => (
                <div key={s.id} className="p-5 space-y-3 bg-card border border-borderSoft rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-0.5">
                      <h3 className="font-semibold text-lg text-textPrimary">{s.event_name}</h3>
                      <p className="text-sm text-textMuted">Submitted on: {new Date(s.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' })}</p>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0 rounded-lg hover:bg-hoverSoft" onClick={() => handleEdit(s)}>Edit Report</Button>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm pt-3 mt-1 border-t border-borderSoft">
                    <a href={s.report_doc_link} target="_blank" rel="noreferrer" className="text-brand hover:underline flex items-center gap-1 font-medium">📄 Report Doc</a>
                    <a href={s.photos_drive_link} target="_blank" rel="noreferrer" className="text-brand hover:underline flex items-center gap-1 font-medium">📸 Photos</a>
                    {s.participants_sheet_link && <a href={s.participants_sheet_link} target="_blank" rel="noreferrer" className="text-brand hover:underline flex items-center gap-1 font-medium">👥 Participants</a>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <Dialog open={!!selectedEventId || !!editingReportId} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent className="sm:max-w-md rounded-2xl bg-card border border-borderSoft text-textPrimary overflow-y-auto max-h-[85dvh]">
            <DialogHeader className="pb-1">
              <DialogTitle className="text-xl font-bold">{editingReportId ? 'Edit Event Report' : 'Submit Event Report'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              <div className="grid gap-2">
                <Label className="text-textSecondary font-semibold">Level of Event</Label>
                <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                  <SelectTrigger className="bg-bgMain h-10 rounded-xl border-borderSoft w-full">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institutional">Institutional</SelectItem>
                    <SelectItem value="state">State</SelectItem>
                    <SelectItem value="national">National</SelectItem>
                    <SelectItem value="international">International</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              

              
              <div className="grid gap-2">
                <Label className="text-textSecondary font-semibold">Google Docs Link to Report *</Label>
                <Input 
                  type="url" 
                  required 
                  value={form.report_doc_link} 
                  onChange={e => setForm({...form, report_doc_link: e.target.value})} 
                  placeholder="https://docs.google.com/..."
                  className="bg-bgMain h-10 rounded-xl border-borderSoft"
                />
              </div>
              
              <div className="grid gap-2">
                <Label className="text-textSecondary font-semibold">Participants Sheet Link <span className="text-textMuted font-normal text-xs">(Optional)</span></Label>
                <Input 
                  type="url" 
                  value={form.participants_sheet_link} 
                  onChange={e => setForm({...form, participants_sheet_link: e.target.value})} 
                  placeholder="https://docs.google.com/spreadsheets/..."
                  className="bg-bgMain h-10 rounded-xl border-borderSoft"
                />
              </div>
              
              <div className="grid gap-2">
                <Label className="text-textSecondary font-semibold">Google Drive Photos Link <span className="text-textMuted font-normal text-xs">(Min 3 photos) *</span></Label>
                <Input 
                  type="url" 
                  required 
                  value={form.photos_drive_link} 
                  onChange={e => setForm({...form, photos_drive_link: e.target.value})} 
                  placeholder="https://drive.google.com/..."
                  className="bg-bgMain h-10 rounded-xl border-borderSoft"
                />
              </div>
              
              <div className="grid gap-2">
                <Label className="text-textSecondary font-semibold">Awards and Achievements Link <span className="text-textMuted font-normal text-xs">(Optional)</span></Label>
                <Input 
                  type="url" 
                  value={form.awards_doc_link} 
                  onChange={e => setForm({...form, awards_doc_link: e.target.value})} 
                  placeholder="https://docs.google.com/..."
                  className="bg-bgMain h-10 rounded-xl border-borderSoft"
                />
              </div>
              
              <DialogFooter className="pt-4 mt-2 border-t border-borderSoft">
                <Button type="submit" className="w-full sm:w-auto rounded-xl bg-brand text-white hover:bg-brand/90">
                  {editingReportId ? 'Update Report' : 'Submit Report'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

          </>
        )}
      </motion.div>
  );
}