import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { toastError, toastSuccess } from '../lib/toast';
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
import { Label } from './ui/label';
import { TimePicker } from './ui/time-picker';
import { Booking } from '../types';

type EditBookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  booking: Booking | null;
};

const EditBookingDialog: React.FC<EditBookingDialogProps> = ({ open, onOpenChange, onUpdated, booking }) => {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && booking) {
      const start = new Date(booking.startTimeISO || booking.date);
      const end = new Date(booking.endTimeISO || booking.endDate || booking.date);
      
      setStartDate(start);
      setEndDate(end);

      const formatTime = (d: Date) => {
        // Enforce IST (Asia/Kolkata) using a 24-hour HH:mm format
        return d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
      };

      setStartTime(formatTime(start));
      setEndTime(formatTime(end));
      setError(null);
    }
  }, [open, booking]);

  const handleUpdate = async () => {
    if (!booking) return;
    if (!startDate || !endDate || !startTime || !endTime) {
      setError('Start Date, End Date, start time, and end time are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const sYear = startDate.getFullYear();
      const sMonth = String(startDate.getMonth() + 1).padStart(2, '0');
      const sDay = String(startDate.getDate()).padStart(2, '0');
      const sDateString = `${sYear}-${sMonth}-${sDay}`;

      const eYear = endDate.getFullYear();
      const eMonth = String(endDate.getMonth() + 1).padStart(2, '0');
      const eDay = String(endDate.getDate()).padStart(2, '0');
      const eDateString = `${eYear}-${eMonth}-${eDay}`;

      const newStartTime = new Date(`${sDateString}T${startTime}:00`).toISOString();
      const newEndTime = new Date(`${eDateString}T${endTime}:00`).toISOString();

      await apiRequest(`/api/admin/bookings/${booking.id}`, {
        method: 'PUT',
        auth: true,
        body: {
          start_time: newStartTime,
          end_time: newEndTime,
        }
      });

      toastSuccess('Booking updated successfully');
      onUpdated();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to update booking:', err);
      setError(err.message || 'Failed to update booking. Please try again.');
      toastError(err, 'Failed to update booking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Booking Timings</DialogTitle>
          <DialogDescription>
            {booking ? `Editing timings for "${booking.bookingName || booking.eventName}"` : 'Loading...'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center justify-between border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="booking-start-date">Start Date</Label>
              <DatePicker id="booking-start-date" date={startDate} setDate={setStartDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-start-time">Start Time</Label>
              <TimePicker id="booking-start-time" value={startTime} onChange={setStartTime} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="booking-end-date">End Date</Label>
              <DatePicker id="booking-end-date" date={endDate} setDate={setEndDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-end-time">End Time</Label>
              <TimePicker id="booking-end-time" value={endTime} onChange={setEndTime} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditBookingDialog;
