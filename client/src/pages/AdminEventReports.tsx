import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GlassCard } from '../components/glass-card';
import { GradientBackground } from '../components/gradient-background';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { apiRequest } from '../lib/api';
import { toastError } from '../lib/toast';
import { DatePicker } from '../components/ui/date-picker';

export default function AdminEventReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [tab, setTab] = useState<'submitted' | 'tracking' | 'exempt'>('submitted');
  const [loading, setLoading] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncFromDate, setSyncFromDate] = useState<Date | undefined>(undefined);
  const [syncToDate, setSyncToDate] = useState<Date | undefined>(undefined);
  const [settings, setSettings] = useState({
    event_report_format_link: '',
    awards_format_link: '',
    google_sheet_webhook_url: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const s = await apiRequest<any[]>('/api/event-reports', { auth: true });
      const p = await apiRequest<any[]>('/api/event-reports/all-past-events', { auth: true });
      const config = await apiRequest<Record<string, string>>('/api/settings', { auth: true }).catch(() => ({} as Record<string, string>));
      
      setReports(s);
      setPastEvents(p);
      setSettings({
        event_report_format_link: config.event_report_format_link || '',
        awards_format_link: config.awards_format_link || '',
        google_sheet_webhook_url: config.google_sheet_webhook_url || ''
      });
    } catch (e: any) {
      toastError('Failed to fetch admin reports data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExport = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
      const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/event-reports/export`;
      const response = await fetch(apiUrl, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Event_Reports.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toastError('Export failed', error);
    }
  };

  const handleSyncSheets = async () => {
    setSyncingSheets(true);
    try {
      const body: any = {};
      if (syncFromDate) {
        const y = syncFromDate.getFullYear();
        const m = String(syncFromDate.getMonth() + 1).padStart(2, '0');
        const d = String(syncFromDate.getDate()).padStart(2, '0');
        body.from_date = `${y}-${m}-${d}`;
      }
      if (syncToDate) {
        const y = syncToDate.getFullYear();
        const m = String(syncToDate.getMonth() + 1).padStart(2, '0');
        const d = String(syncToDate.getDate()).padStart(2, '0');
        body.to_date = `${y}-${m}-${d}`;
      }

      const res = await apiRequest<{ success: boolean; message: string; count?: number }>(
        '/api/event-reports/sync-sheets',
        { method: 'POST', auth: true, body }
      );
      toast.success(res.message || 'Synced to Google Sheet successfully');
      setIsSyncModalOpen(false);
    } catch (error: any) {
      toastError('Google Sheet sync failed', error);
    } finally {
      setSyncingSheets(false);
    }
  };

  const toggleExempt = async (eventId: string, currentExempt: boolean) => {
    try {
      await apiRequest(`/api/event-reports/exempt/${eventId}`, {
        method: 'PATCH',
        auth: true,
        body: { exempt: !currentExempt }
      });
      toast.success(`Event marked as ${!currentExempt ? 'exempt' : 'requires report'}`);
      fetchData();
    } catch (e: any) {
      toastError('Failed to toggle exemption', e);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await apiRequest('/api/settings', {
        method: 'POST',
        auth: true,
        body: settings
      });
      toast.success('Settings saved successfully');
      setIsSettingsOpen(false);
    } catch (error: any) {
      toastError('Failed to save settings', error);
    } finally {
      setSavingSettings(false);
    }
  };

  const currentData = tab === 'submitted' 
    ? reports 
    : tab === 'tracking' 
      ? pastEvents.filter(e => !e.has_report && !e.report_exempt)
      : pastEvents.filter(e => e.report_exempt);

  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = currentData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="relative min-h-dvh">
      <GradientBackground />
      <div className="relative z-10 space-y-6">
        <div className="w-full flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Title */}
          <div className="min-w-0 lg:flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary leading-tight">
              Event Reports
            </h1>

            <p className="mt-1 text-sm sm:text-base text-textMuted max-w-md">
              Manage and export all club/committee event reports.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:gap-3 lg:shrink-0">
            {/* Settings - full width row */}
            <Button
              variant="outline"
              onClick={() => setIsSettingsOpen(true)}
              className="h-10 rounded-xl px-4 whitespace-nowrap w-full"
            >
              <Settings className="w-4 h-4 mr-2 shrink-0" />
              Settings & Formats
            </Button>

            {/* Sync + Export side by side */}
            <div className="flex gap-2 sm:gap-3">
              <Button
                onClick={() => setIsSyncModalOpen(true)}
                className="h-10 gap-2 rounded-xl px-4 font-semibold border-[1.5px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-sm whitespace-nowrap flex-1"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                Sync Sheet
              </Button>

              <Button
                onClick={handleExport}
                className="hover:bg-hoverSoft shadow-sm whitespace-nowrap flex-1"
              >
                <Download className="w-4 h-4 shrink-0" />
                Export
              </Button>
            </div>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "submitted" | "tracking" | "exempt");
            setCurrentPage(1);
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="submitted">
              Submitted ({reports.length})
            </TabsTrigger>
            <TabsTrigger value="tracking">
              Tracking (
              {
                pastEvents.filter((e) => !e.has_report && !e.report_exempt)
                  .length
              }
              )
            </TabsTrigger>
            <TabsTrigger value="exempt">
              Exempt ({pastEvents.filter((e) => e.report_exempt).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <GlassCard
                key={i}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
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
            {tab === "submitted" && (
              <div className="space-y-4">
                {paginatedData.map((r) => (
                  <GlassCard key={r.id} className="p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <h3 className="font-semibold text-lg leading-tight">
                        {r.event_name}
                        <span className="block sm:inline text-sm font-normal text-textMuted sm:ml-2">
                          by {r.club_name}
                        </span>
                      </h3>
                      <span className="text-sm bg-brand/10 text-brand px-2 py-1 rounded-md capitalize self-start shrink-0">
                        {r.level}
                      </span>
                    </div>
                    <p className="text-sm text-textMuted mt-1">
                      Submitted:{" "}
                      {new Date(r.created_at).toLocaleDateString("en-GB", {
                        timeZone: "Asia/Kolkata",
                      })}{" "}
                      | Event:{" "}
                      {new Date(r.date).toLocaleDateString("en-GB", {
                        timeZone: "Asia/Kolkata",
                      })}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm mt-2">
                      <a
                        href={r.report_doc_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        Report Doc
                      </a>
                      <a
                        href={r.photos_drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        Photos
                      </a>
                      {r.participants_sheet_link && (
                        <a
                          href={r.participants_sheet_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand hover:underline"
                        >
                          Participants
                        </a>
                      )}
                      {r.awards_doc_link && (
                        <a
                          href={r.awards_doc_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand hover:underline"
                        >
                          Awards
                        </a>
                      )}
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}

            {tab === "tracking" && (
              <div className="overflow-x-auto bg-white dark:bg-card border border-borderSoft rounded-xl">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-[30%] text-textSecondary text-center">
                        Event
                      </th>
                      <th className="px-4 py-3 font-semibold w-[30%] text-textSecondary text-center">
                        Club / Committee
                      </th>
                      <th className="px-4 py-3 font-semibold w-[15%] text-textSecondary text-center">
                        End Date
                      </th>
                      <th className="px-4 py-3 font-semibold w-[25%] text-textSecondary text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderSoft">
                    {paginatedData.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3 text-textMuted">
                          {e.club_name}
                        </td>
                        <td className="px-4 py-3 text-textMuted text-center">
                          {new Date(e.end_date || e.date).toLocaleDateString(
                            "en-GB",
                            { timeZone: "Asia/Kolkata" },
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExempt(e.id, e.report_exempt)}
                          >
                            Mark Exempt
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center text-textMuted py-8"
                        >
                          No pending events require a report.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "exempt" && (
              <div className="overflow-x-auto bg-white dark:bg-card border border-borderSoft rounded-xl">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-[30%] text-textSecondary text-center">
                        Event
                      </th>
                      <th className="px-4 py-3 font-semibold w-[30%] text-textSecondary text-center">
                        Club / Committee
                      </th>
                      <th className="px-4 py-3 font-semibold w-[15%] text-textSecondary text-center">
                        End Date
                      </th>
                      <th className="px-4 py-3 font-semibold w-[25%] text-textSecondary text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borderSoft">
                    {paginatedData.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3 text-textMuted">
                          {e.club_name}
                        </td>
                        <td className="px-4 py-3 text-textMuted text-center">
                          {new Date(e.end_date || e.date).toLocaleDateString(
                            "en-GB",
                            { timeZone: "Asia/Kolkata" },
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExempt(e.id, e.report_exempt)}
                          >
                            Clear Exemption
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {paginatedData.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center text-textMuted py-8"
                        >
                          No exempt events.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {currentData.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between mt-6 p-4 border-t border-borderSoft bg-card rounded-xl shadow-sm gap-4">
            <div className="flex items-center text-sm text-textMuted">
              Showing <span className="font-medium mx-1">{startIndex + 1}</span>{" "}
              to{" "}
              <span className="font-medium mx-1">
                {Math.min(startIndex + itemsPerPage, currentData.length)}
              </span>{" "}
              of <span className="font-medium mx-1">{currentData.length}</span>{" "}
              results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} className="mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Format Links</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="event-report-link">
                Event Report Format Link
              </Label>
              <Input
                id="event-report-link"
                type="url"
                value={settings.event_report_format_link}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    event_report_format_link: e.target.value,
                  })
                }
                placeholder="https://docs.google.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="awards-link">Awards Format Link</Label>
              <Input
                id="awards-link"
                type="url"
                value={settings.awards_format_link}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    awards_format_link: e.target.value,
                  })
                }
                placeholder="https://docs.google.com/..."
              />
            </div>

            <div className="pt-2 border-t border-borderSoft space-y-3">
              <div>
                <Label
                  htmlFor="webhook-url"
                  className="font-semibold text-textPrimary"
                >
                  Google Sheet Webhook URL
                </Label>
                <p className="text-xs text-textMuted mb-1.5">
                  Auto-updates event reports directly in your Google Sheet.
                </p>
                <Input
                  id="webhook-url"
                  type="url"
                  value={settings.google_sheet_webhook_url}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      google_sheet_webhook_url: e.target.value,
                    })
                  }
                  placeholder="https://script.google.com/macros/s/.../exec"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Date Range Dialog */}
      <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
              Sync Event Reports to Google Sheet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-3">
            <p className="text-sm text-textMuted">
              Select the date range of events you want to sync. Existing rows in
              the Google Sheet that were not submitted through the website will
              remain untouched.
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold text-textSecondary mb-1.5 block">
                  From Event Date{" "}
                  <span className="text-textMuted font-normal text-xs">
                    (Optional)
                  </span>
                </Label>
                <DatePicker
                  date={syncFromDate}
                  setDate={setSyncFromDate}
                  className="h-10 text-sm"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-textSecondary mb-1.5 block">
                  To Event Date{" "}
                  <span className="text-textMuted font-normal text-xs">
                    (Optional)
                  </span>
                </Label>
                <DatePicker
                  date={syncToDate}
                  setDate={setSyncToDate}
                  className="h-10 text-sm"
                />
              </div>

              {(syncFromDate || syncToDate) && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSyncFromDate(undefined);
                      setSyncToDate(undefined);
                    }}
                    className="text-xs text-textMuted hover:text-textPrimary h-7 px-2"
                  >
                    Reset to All Dates
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsSyncModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSyncSheets}
              disabled={syncingSheets}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              <FileSpreadsheet
                size={16}
                className={syncingSheets ? "animate-spin" : ""}
              />
              {syncingSheets ? "Syncing..." : "Start Sync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}