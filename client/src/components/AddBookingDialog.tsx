import { cn } from '@/lib/utils';
import { Loader2, Plus, Check } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { apiRequest, ApiVenue } from '../lib/api';
import { Button } from './ui/button';
import { DatePicker } from './ui/date-picker';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';
import { TimePicker } from './ui/time-picker';

type Club = {
    id: string;
    name: string;
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
};

const EVENT_TYPES = [
    { value: 'co_curricular', label: 'Co-Curricular' },
    { value: 'open_all', label: 'Open for All' },
    { value: 'closed_club', label: 'Closed Club' },
];

const AddBookingDialog: React.FC<Props> = ({ open, onOpenChange, onCreated }) => {
    const [eventName, setEventName] = useState('');
    const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
    const [allClubs, setAllClubs] = useState<Club[]>([]);
    const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [startTime, setStartTime] = useState('12:00');
    const [endTime, setEndTime] = useState('13:00');
    const [eventType, setEventType] = useState('');
    const [expectedAttendees, setExpectedAttendees] = useState('');
    const [bookingType, setBookingType] = useState<'recurring' | 'continuous'>('recurring');
    
    const [clubEvents, setClubEvents] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [bookingName, setBookingName] = useState('');
    const [isMeeting, setIsMeeting] = useState(false);

    const [venues, setVenues] = useState<ApiVenue[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [coCurricularWarning, setCoCurricularWarning] = useState('');

    // Load venues and clubs
    useEffect(() => {
        if (open) {
            apiRequest<ApiVenue[]>('/api/venues')
                .then(data => setVenues(data.filter(v => v.is_active !== false)))
                .catch(() => setVenues([]));
            // Auto-resolve SBG club
            apiRequest<Club[]>('/api/clubs')
                .then((clubs) => {
                    setAllClubs(clubs);
                    const sbg = clubs.find((c) =>
                        c.name.toLowerCase().includes('sbg') ||
                        c.name.toLowerCase().includes('student body')
                    );
                    const clubId = sbg?.id || clubs[0]?.id || null;
                    setSelectedClubId(clubId);
                })
                .catch(() => {
                    setSelectedClubId(null);
                    setAllClubs([]);
                });
        }
    }, [open]);

    // Fetch events when club changes
    useEffect(() => {
        if (selectedClubId) {
            apiRequest<any[]>(`/api/admin/clubs/${selectedClubId}/events`, { auth: true })
                .then(setClubEvents)
                .catch(() => setClubEvents([]));
        } else {
            setClubEvents([]);
        }
    }, [selectedClubId]);

    // Reset form when opened
    useEffect(() => {
        if (open) {
            setEventName('');
            setSelectedVenues([]);
            setStartDate(undefined);
            setEndDate(undefined);
            setStartTime('12:00');
            setEndTime('13:00');
            setEventType('');
            setExpectedAttendees('');
            setSelectedEventId('');
            setBookingName('');
            setIsMeeting(false);
            setError(null);
            setCoCurricularWarning('');
            setBookingType('recurring');
        }
    }, [open]);

    // Sync eventType and bookingName with selected event
    useEffect(() => {
        if (selectedEventId) {
            const evt = clubEvents.find(e => e.id === selectedEventId);
            if (evt) {
                if (evt.event_type) setEventType(evt.event_type);
                if (evt.name) setBookingName(prev => prev || evt.name);
            }
        }
    }, [selectedEventId, clubEvents]);

    // Co-curricular limit check
    useEffect(() => {
        if (eventType !== 'co_curricular' || !selectedClubId) {
            setCoCurricularWarning('');
            return;
        }

        apiRequest<{ count: number; limit: number }>(
            `/api/bookings/co-curricular-count?clubId=${selectedClubId}`,
            { auth: true }
        )
            .then(({ count, limit }) => {
                if (count >= limit) {
                    setCoCurricularWarning(
                        `This club has already booked ${limit} co-curricular events this semester. (Admin Override Active - You can still book)`
                    );
                } else if (count === limit - 1) {
                    setCoCurricularWarning(
                        `Warning: This will be the last co-curricular event allowed this semester (${count}/${limit} used).`
                    );
                } else {
                    setCoCurricularWarning('');
                }
            })
            .catch(() => setCoCurricularWarning(''));
    }, [eventType, selectedClubId]);

    const toggleVenue = (venueId: string) => {
        setSelectedVenues((prev) =>
            prev.includes(venueId)
                ? prev.filter((v) => v !== venueId)
                : [...prev, venueId]
        );
    };

    const handleCreate = async () => {
        if (!selectedClubId) {
            setError('Please select an organizing club.');
            return;
        }
        if (!selectedEventId && !isMeeting) {
            setError('Please select an existing event or mark as a club meeting');
            return;
        }
        if (selectedVenues.length === 0) {
            setError('Please select at least one venue');
            return;
        }
        if (!startDate || !endDate || !startTime || !endTime) {
            setError('Start Date, End Date, start time, and end time are required');
            return;
        }
        if (!bookingName || bookingName.trim().length === 0) {
            setError('Booking Name is required.');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const generateTimeSlots = () => {
                if (bookingType === 'continuous') {
                    const sYear = startDate.getFullYear();
                    const sMonth = String(startDate.getMonth() + 1).padStart(2, '0');
                    const sDay = String(startDate.getDate()).padStart(2, '0');
                    const sDateString = `${sYear}-${sMonth}-${sDay}`;
        
                    const activeEndDate = endDate;
                    const eYear = activeEndDate.getFullYear();
                    const eMonth = String(activeEndDate.getMonth() + 1).padStart(2, '0');
                    const eDay = String(activeEndDate.getDate()).padStart(2, '0');
                    const eDateString = `${eYear}-${eMonth}-${eDay}`;

                    return [{
                        startTime: new Date(`${sDateString}T${startTime}:00`).toISOString(),
                        endTime: new Date(`${eDateString}T${endTime}:00`).toISOString()
                    }];
                }
                
                const slots = [];
                const curr = new Date(startDate);
                curr.setHours(0,0,0,0);
                const end = new Date(endDate);
                end.setHours(0,0,0,0);
                while (curr <= end) {
                    const yyyy = curr.getFullYear();
                    const mm = String(curr.getMonth() + 1).padStart(2, '0');
                    const dd = String(curr.getDate()).padStart(2, '0');
                    const dateStr = `${yyyy}-${mm}-${dd}`;
                    slots.push({
                        startTime: new Date(`${dateStr}T${startTime}:00`).toISOString(),
                        endTime: new Date(`${dateStr}T${endTime}:00`).toISOString()
                    });
                    curr.setDate(curr.getDate() + 1);
                }
                return slots;
            };

            const timeSlots = generateTimeSlots();

            await apiRequest('/api/admin/bookings', {
                method: 'POST',
                auth: true,
                body: {
                    club_id: selectedClubId,
                    venue_ids: selectedVenues,
                    event_id: isMeeting ? undefined : selectedEventId,
                    bookingMode: isMeeting ? 'meet' : 'event',
                    bookingName: bookingName.trim(),
                    timeSlots,
                    expected_attendees: expectedAttendees
                        ? parseInt(expectedAttendees)
                        : undefined,
                },
            });
            onCreated();
            onOpenChange(false);
        } catch (err: any) {
            setError(err?.message || 'Failed to register/book');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Book Venues</DialogTitle>
                    <DialogDescription>
                        Book venues for an existing event.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="grid gap-4 py-2">
                    {/* Club Selection */}
                    <div className="grid gap-2">
                        <Label htmlFor="organizing-club">Organizing Club</Label>
                        <Select value={selectedClubId || ''} onValueChange={setSelectedClubId}>
                            <SelectTrigger id="organizing-club" className="bg-card border-borderSoft">
                                <SelectValue placeholder="Select club..." />
                            </SelectTrigger>
                            <SelectContent>
                                {allClubs.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="select-event">Select Event</Label>
                        <Select value={selectedEventId} onValueChange={setSelectedEventId} disabled={isMeeting}>
                            <SelectTrigger id="select-event" className="bg-card">
                                <SelectValue placeholder="Select an event" />
                            </SelectTrigger>
                            <SelectContent>
                                {clubEvents.filter(evt => {
                                    const d = new Date(evt.dynamic_end_date || evt.end_date || evt.date);
                                    if (isNaN(d.getTime())) return true;
                                    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
                                    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(d);
                                    const y = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
                                    const m = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10) - 1;
                                    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
                                    const eventMidnight = new Date(y, m, day).getTime();
                                    
                                    const today = new Date();
                                    const todayParts = new Intl.DateTimeFormat('en-US', options).formatToParts(today);
                                    const ty = parseInt(todayParts.find(p => p.type === 'year')?.value || '0', 10);
                                    const tm = parseInt(todayParts.find(p => p.type === 'month')?.value || '0', 10) - 1;
                                    const tday = parseInt(todayParts.find(p => p.type === 'day')?.value || '0', 10);
                                    const todayMidnight = new Date(ty, tm, tday).getTime();
                                    
                                    return eventMidnight >= todayMidnight;
                                }).map((evt) => (
                                    <SelectItem key={evt.id} value={evt.id}>
                                        {evt.name}
                                    </SelectItem>
                                ))}
                                {clubEvents.length === 0 && (
                                    <div className="px-2 py-3 text-sm text-textMuted text-center">No events found for this club</div>
                                )}
                            </SelectContent>
                        </Select>
                        {selectedEventId && (
                            <button
                                type="button"
                                onClick={() => setSelectedEventId('')}
                                className="text-xs text-textMuted hover:text-error transition-colors underline underline-offset-2 text-left"
                            >
                                Clear event link
                            </button>
                        )}
                        
                        <div
                            className={cn(
                                'p-3 rounded-xl border-2 transition-all cursor-pointer select-none mt-1',
                                isMeeting
                                    ? 'bg-brand/5 border-brand/30'
                                    : selectedEventId
                                        ? 'bg-hoverSoft/10 border-borderSoft opacity-50 cursor-not-allowed'
                                        : 'bg-hoverSoft/30 border-borderSoft hover:border-brand/20'
                            )}
                            onClick={() => { if (!selectedEventId) setIsMeeting(prev => !prev) }}
                            role="checkbox"
                            aria-checked={isMeeting}
                            aria-disabled={!!selectedEventId}
                            tabIndex={selectedEventId ? -1 : 0}
                            onKeyDown={(e) => { if (!selectedEventId && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setIsMeeting(prev => !prev); } }}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    'h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                                    isMeeting ? 'bg-brand border-brand text-white shadow-sm' : 'border-textMuted/40 bg-transparent'
                                )}>
                                    {isMeeting && <Check className="h-3 w-3" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-textPrimary">This is a club meeting</p>
                                </div>
                                {isMeeting && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 shrink-0 whitespace-nowrap">
                                        Closed Club
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="booking-name">Booking Name</Label>
                        <Input
                            id="booking-name"
                            placeholder="e.g. Event Name / Committee Meet"
                            value={bookingName}
                            onChange={(e) => setBookingName(e.target.value)}
                        />
                    </div>


                    {/* Venues */}
                    <div className="grid gap-2">
                        <Label htmlFor="booking-venues">Venues</Label>
                        <div className="max-h-36 overflow-y-auto rounded-md border border-borderSoft p-2 space-y-1 bg-card">
                            {venues.length === 0 ? (
                                <p className="text-xs text-textMuted py-2 text-center">Loading venues...</p>
                            ) : (
                                venues.map((v) => (
                                    <label
                                        key={v.id}
                                        className={`
                                            flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors
                                            ${selectedVenues.includes(v.id)
                                                ? 'bg-brand/10 text-brand font-medium'
                                                : 'hover:bg-hoverSoft text-textPrimary'
                                            }
                                        `}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedVenues.includes(v.id)}
                                            onChange={() => toggleVenue(v.id)}
                                            className="accent-[var(--brand)] rounded"
                                        />
                                        {v.name}
                                        {v.capacity && (
                                            <span className="text-xs text-textMuted ml-auto">
                                                Cap: {v.capacity}
                                            </span>
                                        )}
                                    </label>
                                ))
                            )}
                        </div>
                        {selectedVenues.length > 0 && (
                            <p className="text-xs text-textMuted">
                                {selectedVenues.length} venue{selectedVenues.length > 1 ? 's' : ''} selected
                            </p>
                        )}
                    </div>

                    {/* Date / Time */}
                    <div className="grid gap-2">
                        <Label htmlFor="booking-schedule">Schedule</Label>
                        <div className="grid gap-3 p-3 rounded-md border border-borderSoft bg-card">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="add-booking-start-date" className="text-xs text-textSecondary">Start Date</Label>
                                        <DatePicker
                                            id="add-booking-start-date"
                                            date={startDate}
                                            setDate={setStartDate}
                                            className="bg-card w-full"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="add-booking-end-date" className="text-xs text-textSecondary">End Date</Label>
                                        <DatePicker
                                            id="add-booking-end-date"
                                            date={endDate}
                                            setDate={setEndDate}
                                            className="bg-card w-full"
                                        />
                                    </div>
                                </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="add-booking-start-time" className="text-xs text-textSecondary">Start Time</Label>
                                    <TimePicker
                                        id="add-booking-start-time"
                                        value={startTime}
                                        onChange={setStartTime}
                                        className="h-10 rounded-md"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="add-booking-end-time" className="text-xs text-textSecondary">End Time</Label>
                                    <TimePicker
                                        id="add-booking-end-time"
                                        value={endTime}
                                        onChange={setEndTime}
                                        className="h-10 rounded-md"
                                    />
                                </div>
                            </div>
                            
                            {startDate && endDate && startDate.getTime() !== endDate.getTime() && (
                                <div className="pt-3 border-t border-borderSoft mt-2">
                                    <Label className="text-textPrimary font-bold text-sm md:text-base mb-3 block">Multi-Day Booking Type</Label>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Button
                                            type="button"
                                            variant={bookingType === 'recurring' ? 'default' : 'outline'}
                                            className={cn("flex-1 justify-start h-auto py-3 px-4", bookingType === 'recurring' ? "bg-brand text-white border-transparent" : "border-borderSoft")}
                                            onClick={() => setBookingType('recurring')}
                                        >
                                            <div className="text-left whitespace-normal">
                                                <div className="font-bold text-sm md:text-base">Recurring Daily</div>
                                                <div className="text-xs font-normal opacity-80 mt-1">Book specific hours each day</div>
                                            </div>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={bookingType === 'continuous' ? 'default' : 'outline'}
                                            className={cn("flex-1 justify-start h-auto py-3 px-4", bookingType === 'continuous' ? "bg-brand text-white border-transparent" : "border-borderSoft")}
                                            onClick={() => setBookingType('continuous')}
                                        >
                                            <div className="text-left whitespace-normal">
                                                <div className="font-bold text-sm md:text-base">Continuous</div>
                                                <div className="text-xs font-normal opacity-80 mt-1">Book continuously from start to end</div>
                                            </div>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                    {coCurricularWarning && (
                        <div className={`text-sm rounded-md px-3 py-2 border ${coCurricularWarning.startsWith('SBG has already')
                            ? 'text-error bg-error/10 border-error/20'
                            : 'text-warning bg-warning/10 border-warning/20'
                            }`}>
                            {coCurricularWarning}
                        </div>
                    )}

                    {/* Expected Attendees */}
                    <div className="grid gap-2">
                        <Label htmlFor="add-attendees">Expected Attendees</Label>
                        <Input
                            id="add-attendees"
                            type="number"
                            value={expectedAttendees}
                            onChange={(e) => setExpectedAttendees(e.target.value)}
                            placeholder="e.g. 100 (optional)"
                            className="bg-card"
                        />
                    </div>

                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleCreate} 
                        disabled={
                            saving || 
                            !selectedClubId || 
                            (!selectedEventId && !isMeeting) || 
                            selectedVenues.length === 0 || 
                            !startDate || 
                            !endDate || 
                            !startTime || 
                            !endTime || 
                            (startDate?.getTime() === endDate?.getTime() && endTime <= startTime)
                        } 
                        className="gap-2 bg-brand text-bgMain disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Plus size={14} />
                        )}
                        Book Venues
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddBookingDialog;