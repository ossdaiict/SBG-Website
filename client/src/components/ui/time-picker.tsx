import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import * as React from "react";

interface TimePickerProps {
    value?: string; // "HH:mm" in 24h format
    onChange: (time: string) => void;
    className?: string;
    hideIcon?: boolean;
    id?: string;
}

export function TimePicker({ value, onChange, className, hideIcon = false, id }: TimePickerProps) {
    const [hour, setHour] = React.useState<string>("12");
    const [minute, setMinute] = React.useState<string>("00");
    const [period, setPeriod] = React.useState<string>("PM");

    React.useEffect(() => {
        if (value) {
            const [rawH, rawM] = value.split(":");
            let h = parseInt(rawH, 10);
            const m = parseInt(rawM, 10);
            
            if (!isNaN(h) && !isNaN(m)) {
                setPeriod(h >= 12 ? "PM" : "AM");
                h = h % 12 || 12;
                setHour(h.toString().padStart(2, '0'));
                setMinute(m.toString().padStart(2, '0'));
            }
        }
    }, [value]);

    const handleTimeChange = (newHour: string, newMinute: string, newPeriod: string) => {
        setHour(newHour);
        setMinute(newMinute);
        setPeriod(newPeriod);

        let h24 = parseInt(newHour, 10);
        if (newPeriod === "PM" && h24 < 12) h24 += 12;
        if (newPeriod === "AM" && h24 === 12) h24 = 0;

        onChange(`${h24.toString().padStart(2, '0')}:${newMinute}`);
    };

    const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    const minuteOptions = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

    return (
        <div id={id} className={cn("flex items-center", className)}>
            <div className={cn(
                "flex items-center w-full h-10 rounded-md border border-borderSoft bg-white/90 dark:bg-white/5 backdrop-blur-sm hover:border-brand/50 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20",
                hideIcon ? "px-1 sm:px-2" : "px-2 sm:px-3"
            )}>
                 {!hideIcon && <Clock className="mr-1.5 sm:mr-2 h-4 w-4 text-brand shrink-0" />}
                 <div className="flex items-center gap-1 w-full justify-between">
                     <Select value={hour} onValueChange={(v) => handleTimeChange(v, minute, period)}>
                         <SelectTrigger className="h-8 sm:h-8 py-0 border-0 bg-transparent dark:bg-transparent px-0 focus:ring-0 focus:ring-offset-0 text-textPrimary font-semibold flex-1 shadow-none hover:bg-hoverSoft rounded-md transition-none text-center justify-center [&>svg]:hidden">
                             <SelectValue placeholder="HH" />
                         </SelectTrigger>
                         <SelectContent hideScrollButtons className="max-h-[200px]">
                             {hours.map((h) => (
                                 <SelectItem key={h} value={h} className="justify-center font-medium">{h}</SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                     
                     <span className="text-textMuted font-bold">:</span>
                     
                     <Select value={minute} onValueChange={(v) => handleTimeChange(hour, v, period)}>
                         <SelectTrigger className="h-8 sm:h-8 py-0 border-0 bg-transparent dark:bg-transparent px-0 focus:ring-0 focus:ring-offset-0 text-textPrimary font-semibold flex-1 shadow-none hover:bg-hoverSoft rounded-md transition-none text-center justify-center [&>svg]:hidden">
                             <SelectValue placeholder="MM" />
                         </SelectTrigger>
                         <SelectContent hideScrollButtons className="max-h-[200px]">
                             {minuteOptions.map((m) => (
                                 <SelectItem key={m} value={m} className="justify-center font-medium">{m}</SelectItem>
                             ))}
                         </SelectContent>
                     </Select>
                     
                     <div className="w-px h-4 bg-borderSoft mx-1" />
                     
                     <Select value={period} onValueChange={(v) => handleTimeChange(hour, minute, v)}>
                         <SelectTrigger className="h-8 sm:h-8 py-0 border-0 bg-transparent dark:bg-transparent px-0 focus:ring-0 focus:ring-offset-0 text-brand font-bold flex-1 shadow-none hover:bg-brand/10 rounded-md transition-none text-center justify-center [&>svg]:hidden">
                             <SelectValue placeholder="AM" />
                         </SelectTrigger>
                         <SelectContent hideScrollButtons>
                             <SelectItem value="AM" className="justify-center font-bold text-brand">AM</SelectItem>
                             <SelectItem value="PM" className="justify-center font-bold text-brand">PM</SelectItem>
                         </SelectContent>
                     </Select>
                 </div>
            </div>
        </div>
    );
}
