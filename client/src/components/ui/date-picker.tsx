import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
    date?: Date;
    setDate: (date?: Date) => void;
    minDate?: Date;
    className?: string;
    id?: string;
}

export function DatePicker({ date, setDate, minDate, className, id }: DatePickerProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant={"outline"}
                    className={cn(
                        "w-full h-7 sm:h-8 justify-start text-left font-normal border-borderSoft bg-white/90 dark:bg-white/5 backdrop-blur-sm hover:bg-hoverSoft transition-all text-textPrimary rounded-xl shadow-sm overflow-hidden",
                        !date && "text-textMuted",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-brand opacity-70" />
                    <span className="truncate">{date ? format(date, "PPP") : "Pick a date"}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 bg-popover border border-borderSoft rounded-xl shadow-[0_16px_64px_rgba(0,0,0,0.15)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto pointer-events-auto z-50" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                        setDate(d);
                        setOpen(false);
                    }}
                    disabled={(d) => {
                        if (!minDate) return false;
                        const min = new Date(minDate);
                        min.setHours(0, 0, 0, 0);
                        return d < min;
                    }}
                    defaultMonth={date || minDate}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    );
}
