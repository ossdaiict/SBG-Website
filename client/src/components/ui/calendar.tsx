import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock,
  MapPin,
} from "lucide-react";
import * as React from "react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";
import { createPortal } from "react-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface CalendarEvent {
  eventName: string;
  bookingName?: string;
  clubName: string;
  date: string;
  startTime: string;
  endTime: string;
  startTimeISO?: string;
  venueName?: string;
  status?: string;
  eventType?: string;
}

type EventsByDateMap = Map<string, CalendarEvent[]>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function makeDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

const CalendarEventsContext = React.createContext<EventsByDateMap | null>(null);

/* -------------------------------------------------------------------------- */
/* Calendar Root                                                              */
/* -------------------------------------------------------------------------- */

const CalendarRoot = ({ className, rootRef, ...props }: any) => {
  return (
    <motion.div
      data-slot="calendar"
      ref={rootRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={cn("w-full min-w-0 max-w-full", className)}
      {...props}
    />
  );
};
/* -------------------------------------------------------------------------- */
/* Chevron                                                                    */
/* -------------------------------------------------------------------------- */

const CalendarChevron = ({
  orientation,
  className,
  ...props
}: React.SVGProps<SVGSVGElement> & {
  orientation?: "left" | "right" | "up" | "down";
}) => {
  if (orientation === "left") {
    return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
  }

  if (orientation === "right") {
    return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
  }

  return <ChevronDownIcon className={cn("size-4", className)} {...props} />;
};

/* -------------------------------------------------------------------------- */
/* Day Button                                                                 */
/* -------------------------------------------------------------------------- */

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const eventsByDate = React.useContext(CalendarEventsContext);

  const dateKey = makeDateKey(day.date);
  const dayEvents = eventsByDate?.get(dateKey) || [];

  const hasEvents = dayEvents.length > 0;
  const isDisabled = modifiers?.disabled;
  const isSelected = modifiers?.selected;
  const isToday = modifiers?.today;
  const isOutside = modifiers?.outside;

  return (
    <motion.div
      className={cn(
        "w-full h-full min-w-0",
        "flex items-center justify-center",
        "rounded-full transition-shadow duration-300",
        hasEvents &&
          !isDisabled &&
          "cursor-pointer hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]",
      )}
      whileTap={!isDisabled ? { scale: 0.96 } : undefined}
    >
      <DayButton
        day={day}
        modifiers={modifiers}
        {...props}
        className={cn(
          className,
          /* -------------------------------------------------------------- */
          /* IMPORTANT: fluid date button                                  */
          /* -------------------------------------------------------------- */

          "w-[90%]",
          "max-w-[var(--cell-size)]",
          "aspect-square",
          "h-auto",
          "mx-auto",

          "flex flex-col",
          "justify-center",
          "items-center",
          "gap-0.5",

          "font-medium",
          "leading-none",
          "rounded-full",
          "transition-all",
          "duration-200",
          "relative",

          "text-textPrimary",

          /* Selected */
          isSelected && "bg-brand text-white hover:bg-brand hover:text-white",

          /* Today */
          isToday && !isSelected && "ring-1 ring-brand/60 text-brand",

          /* Outside days */
          isOutside && "text-textMuted/40",

          /* Disabled */
          isDisabled && "text-textMuted/40 opacity-50 cursor-not-allowed",
        )}
      >
        {props.children}

        {/* Event indicator */}
        {hasEvents && !isDisabled && (
          <span
            className={cn(
              "absolute",
              "bottom-[8%]",
              "left-1/2",
              "-translate-x-1/2",
              "w-1.5",
              "h-1.5",
              "rounded-full",
              isSelected ? "bg-white" : "bg-primary",
            )}
          />
        )}
      </DayButton>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Week Number                                                                */
/* -------------------------------------------------------------------------- */

const CalendarWeekNumber = ({
  children,
  ...props
}: React.HTMLAttributes<HTMLTableCellElement>) => {
  return (
    <td {...props}>
      <div className="flex size-[--cell-size] items-center justify-center text-center">
        {children}
      </div>
    </td>
  );
};

/* -------------------------------------------------------------------------- */
/* Event Hover Card                                                           */
/* -------------------------------------------------------------------------- */

function EventHoverCard({
  containerRef,
  eventsByDate,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  eventsByDate: EventsByDateMap;
}) {
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null);
  const [position, setPosition] = React.useState<{
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);
  const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const handleMouseOver = (event: MouseEvent) => {
      if (window.matchMedia && window.matchMedia("(hover: none)").matches) return;

      const target = event.target as HTMLElement;

      const dayButton = target.closest("[data-day]") as HTMLElement | null;

      if (!dayButton) return;

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      const dateValue = dayButton.getAttribute("data-day");

      if (!dateValue) return;

      let date: Date;

      try {
        date = new Date(dateValue);
      } catch {
        return;
      }

      if (Number.isNaN(date.getTime())) return;

      const key = makeDateKey(date);
      const events = eventsByDate.get(key);

      if (!events || events.length === 0) {
        setHoveredDate(null);
        return;
      }

      const rect = dayButton.getBoundingClientRect();

      const popupWidth = Math.min(300, window.innerWidth - 24);

      let left = rect.left + rect.width / 2 - popupWidth / 2;

      left = Math.max(12, Math.min(left, window.innerWidth - popupWidth - 12));

      let top: number | undefined = rect.bottom + 8;
      let bottom: number | undefined = undefined;

      const estimatedHeight = events.length === 1 ? 140 : 240;

      if (top + estimatedHeight > window.innerHeight - 12) {
        top = undefined;
        bottom = window.innerHeight - rect.top + 8;
      }

      setPosition({
        top,
        bottom,
        left,
      });

      setHoveredDate(key);
    };

    const handleMouseOut = (event: MouseEvent) => {
      hideTimeoutRef.current = setTimeout(() => {
        setHoveredDate(null);
        setPosition(null);
      }, 150);
    };

    container.addEventListener("mouseover", handleMouseOver);

    container.addEventListener("mouseout", handleMouseOut);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);

      container.removeEventListener("mouseout", handleMouseOut);
    };
  }, [containerRef, eventsByDate]);

  const events = hoveredDate ? eventsByDate.get(hoveredDate) || [] : [];

  if (typeof document === "undefined" || !position || events.length === 0) {
    return null;
  }

  const displayEvents = events.slice(0, 2);
  const remainingCount = events.length - 2;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{
          opacity: 0,
          y: 4,
          scale: 0.98,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        exit={{
          opacity: 0,
          y: 4,
          scale: 0.98,
        }}
        transition={{
          duration: 0.15,
        }}
        className="fixed z-[9999]"
        onMouseEnter={() => {
          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
          }
        }}
        onMouseLeave={() => {
          hideTimeoutRef.current = setTimeout(() => {
            setHoveredDate(null);
            setPosition(null);
          }, 150);
        }}
        style={{
          top: position.top,
          bottom: position.bottom,
          left: position.left,
          width: "min(300px, calc(100vw - 24px))",
        }}
      >
        <div
          className={cn(
            "rounded-xl",
            "border",
            "border-borderSoft",
            "bg-popover",
            "shadow-[0_24px_80px_-16px_rgba(0,0,0,0.2),0_8px_20px_-4px_rgba(0,0,0,0.08)]",
            "dark:shadow-[0_24px_80px_-16px_rgba(0,0,0,0.6),0_8px_20px_-4px_rgba(0,0,0,0.3)]",
            "p-3",
            "max-h-[420px]",
            "overflow-y-auto",
            "backdrop-blur-2xl",
          )}
        >
          <div className="space-y-3">
            {displayEvents.map((event, index) => (
              <div
                key={`${event.eventName}-${event.startTime}-${index}`}
                className={cn(index > 0 && "border-t border-borderSoft pt-3")}
              >
                <div className="font-semibold text-sm text-textPrimary break-words">
                  {event.bookingName || event.eventName}
                </div>

                {event.bookingName &&
                  event.eventName &&
                  event.bookingName !== event.eventName && (
                    <div className="text-xs text-textMuted mt-0.5 break-words">
                      {event.eventName}
                    </div>
                  )}

                <div className="text-xs text-brand font-medium mt-1.5">
                  {event.clubName}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-textMuted mt-2">
                  <Clock className="size-3 shrink-0" />
                  <span>
                    {event.startTime} - {event.endTime}
                  </span>
                </div>

                {event.venueName && (
                  <div className="flex items-start gap-1.5 text-xs text-textMuted mt-1">
                    <MapPin className="size-3 shrink-0 mt-0.5" />
                    <span className="break-words">{event.venueName}</span>
                  </div>
                )}
              </div>
            ))}

            {remainingCount > 0 && (
              <div className="pt-2 mt-2 border-t border-borderSoft text-xs text-textMuted text-center font-medium">
                + {remainingCount} more{" "}
                {remainingCount === 1 ? "event" : "events"}. Click date to view
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Calendar                                                                   */
/* -------------------------------------------------------------------------- */

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  events,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
  events?: CalendarEvent[];
}) {
  const defaultClassNames = getDefaultClassNames();

  const calendarRef = React.useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------------ */
  /* Group events by date                                                     */
  /* ------------------------------------------------------------------------ */

  const eventsByDate = React.useMemo(() => {
    const map: EventsByDateMap = new Map();

    for (const event of events || []) {
      const raw = new Date(event.date);

      if (Number.isNaN(raw.getTime())) {
        continue;
      }

      const d = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());

      const key = makeDateKey(d);

      const existing = map.get(key) || [];

      existing.push(event);

      map.set(key, existing);
    }

    return map;
  }, [events]);

  /* ------------------------------------------------------------------------ */
  /* Event dates                                                               */
  /* ------------------------------------------------------------------------ */

  const eventDates = React.useMemo(() => {
    return Array.from(eventsByDate.keys()).map((key) => {
      const [year, month, day] = key.split("-").map(Number);

      return new Date(year, month - 1, day);
    });
  }, [eventsByDate]);

  return (
    <CalendarEventsContext.Provider value={eventsByDate}>
      <div
        ref={calendarRef}
        className={cn(
          "w-full min-w-0 max-w-full",
          /* -------------------------------------------------------------- */
          /* Allow horizontal scrolling                                    */
          /* -------------------------------------------------------------- */
          "overflow-x-auto",
        )}
      >
        <DayPicker
          showOutsideDays={showOutsideDays}
          modifiers={{
            hasEvents: eventDates,
          }}
          className={cn(
            /* ------------------------------------------------------------ */
            /* Base responsive width                                       */
            /* ------------------------------------------------------------ */

            "group/calendar",
            "w-max",
            "mx-auto",
            "rounded-xl",

            /* ------------------------------------------------------------ */
            /* Calendar sizing                                             */
            /* ------------------------------------------------------------ */

            "mx-auto",
            "[--cell-size:2.25rem]",
            "sm:[--cell-size:2.5rem]",
            "md:[--cell-size:2.75rem]",

            /* ------------------------------------------------------------ */
            /* IMPORTANT: only below 320px                                */
            /* Give the calendar a usable minimum width and let the       */
            /* outer wrapper scroll horizontally.                        */
            /* ------------------------------------------------------------ */

            "max-[319px]:min-w-[320px]",

            "[[data-slot=card-content]_&]:bg-transparent",
            "[[data-slot=popover-content]_&]:bg-transparent",

            String.raw`rtl:**:[.rdp-button_next>svg]:rotate-180`,
            String.raw`rtl:**:[.rdp-button_previous>svg]:rotate-180`,

            className,
          )}
          captionLayout={captionLayout}
          formatters={{
            formatMonthDropdown: (date) =>
              date.toLocaleString("default", {
                timeZone: "Asia/Kolkata",
                month: "short",
              }),
            ...formatters,
          }}
          classNames={{
            /* ------------------------------------------------------------ */
            /* Root                                                         */
            /* ------------------------------------------------------------ */

            root: cn("w-max mx-auto", defaultClassNames.root),

            /* ------------------------------------------------------------ */
            /* Months                                                       */
            /* ------------------------------------------------------------ */

            months: cn(
              "relative flex w-max mx-auto",
              "flex-col gap-4 md:flex-row",
              defaultClassNames.months,
            ),

            month: cn(
              "flex w-max mx-auto flex-col gap-4",
              defaultClassNames.month,
            ),

            /* ------------------------------------------------------------ */
            /* Navigation                                                    */
            /* ------------------------------------------------------------ */

            nav: cn(
              "absolute inset-x-0 top-0",
              "flex w-full items-center justify-between gap-1",
              defaultClassNames.nav,
            ),

            button_previous: cn(
              buttonVariants({
                variant: buttonVariant,
              }),
              "h-[--cell-size]",
              "w-[--cell-size]",
              "select-none",
              "p-0",
              "rounded-lg",
              "text-textMuted",
              "hover:text-textPrimary",
              "hover:bg-hoverSoft",
              "aria-disabled:opacity-50",
              defaultClassNames.button_previous,
            ),

            button_next: cn(
              buttonVariants({
                variant: buttonVariant,
              }),
              "h-[--cell-size]",
              "w-[--cell-size]",
              "select-none",
              "p-0",
              "rounded-lg",
              "text-textMuted",
              "hover:text-textPrimary",
              "hover:bg-hoverSoft",
              "aria-disabled:opacity-50",
              defaultClassNames.button_next,
            ),

            /* ------------------------------------------------------------ */
            /* Caption                                                       */
            /* ------------------------------------------------------------ */

            month_caption: cn(
              "flex",
              "h-[--cell-size]",
              "w-full",
              "items-center",
              "justify-center",
              "px-[--cell-size]",
              defaultClassNames.month_caption,
            ),

            dropdowns: cn(
              "flex",
              "h-[--cell-size]",
              "w-full",
              "items-center",
              "justify-center",
              "gap-1.5",
              "text-sm",
              "font-medium",
              defaultClassNames.dropdowns,
            ),

            dropdown_root: cn(
              "has-focus:border-brand",
              "border-borderSoft",
              "has-focus:ring-2",
              "has-focus:ring-brand/30",
              "relative",
              "rounded-lg",
              defaultClassNames.dropdown_root,
            ),

            dropdown: cn(
              "bg-popover",
              "absolute",
              "inset-0",
              "opacity-0",
              defaultClassNames.dropdown,
            ),

            caption_label: cn(
              "select-none",
              "font-semibold",
              "text-textPrimary",
              captionLayout === "label"
                ? "text-base"
                : "[&>svg]:text-textMuted flex h-8 items-center gap-1 rounded-lg pl-2 pr-1 text-sm [&>svg]:size-3.5",
              defaultClassNames.caption_label,
            ),

            /* ------------------------------------------------------------ */
            /* IMPORTANT: react-day-picker v9                              */
            /* Use month_grid, NOT table                                   */
            /* ------------------------------------------------------------ */

            month_grid: cn(
              "w-max",
              "mx-auto",
              "border-collapse",
              defaultClassNames.month_grid,
            ),

            /* ------------------------------------------------------------ */
            /* Weekdays                                                      */
            /* ------------------------------------------------------------ */

            weekdays: cn(
              "grid",
              "grid-cols-7",
              "w-full",
              "min-w-0",
              defaultClassNames.weekdays,
            ),

            weekday: cn(
              "min-w-0",
              "w-auto",
              "text-center",
              "text-textMuted",
              "select-none",
              "rounded-lg",
              "text-xs",
              "sm:text-sm",
              "font-medium",
              "uppercase",
              "tracking-wider",
              defaultClassNames.weekday,
            ),

            /* ------------------------------------------------------------ */
            /* Week                                                          */
            /* ------------------------------------------------------------ */

            week: cn(
              "mt-2",
              "grid",
              "grid-cols-7",
              "w-full",
              "min-w-0",
              defaultClassNames.week,
            ),

            /* ------------------------------------------------------------ */
            /* Week Number                                                    */
            /* ------------------------------------------------------------ */

            week_number_header: cn(
              "w-[--cell-size]",
              "select-none",
              defaultClassNames.week_number_header,
            ),

            week_number: cn(
              "text-textMuted",
              "select-none",
              "text-xs",
              defaultClassNames.week_number,
            ),

            /* ------------------------------------------------------------ */
            /* Day Cell                                                       */
            /* ------------------------------------------------------------ */

            day: cn(
              "relative",
              "min-w-0",
              "w-auto",
              "p-0",
              "text-center",
              "bg-transparent",
              "border",
              "border-borderSoft/20",
              "hover:bg-transparent",
              defaultClassNames.day,
            ),

            /* ------------------------------------------------------------ */
            /* Range                                                         */
            /* ------------------------------------------------------------ */

            range_start: cn("rounded-l-full", defaultClassNames.range_start),

            range_middle: cn("rounded-none", defaultClassNames.range_middle),

            range_end: cn("rounded-r-full", defaultClassNames.range_end),

            /* ------------------------------------------------------------ */
            /* States                                                        */
            /* ------------------------------------------------------------ */

            today: cn("text-brand", "font-semibold", defaultClassNames.today),

            outside: cn("text-textMuted/40", defaultClassNames.outside),

            disabled: cn(
              "text-textMuted/40",
              "opacity-50",
              defaultClassNames.disabled,
            ),

            hidden: cn("invisible", defaultClassNames.hidden),

            /* ------------------------------------------------------------ */
            /* Day button                                                     */
            /* ------------------------------------------------------------ */

            day_button: cn(
              "w-full",
              "min-w-0",
              "aspect-square",
              "h-auto",
              "max-w-none",
              "mx-auto",
              "flex",
              "items-center",
              "justify-center",
              "rounded-full",
              defaultClassNames.day_button,
            ),

            /* ------------------------------------------------------------ */
            /* Chevron                                                        */
            /* ------------------------------------------------------------ */

            chevron: cn("size-4", "text-textMuted", defaultClassNames.chevron),
          }}
          components={{
            Root: CalendarRoot,
            Chevron: CalendarChevron,
            DayButton: CalendarDayButton,
            WeekNumber: CalendarWeekNumber,
            ...components,
          }}
          {...props}
        />
      </div>

      <EventHoverCard containerRef={calendarRef} eventsByDate={eventsByDate} />
    </CalendarEventsContext.Provider>
  );
}

export { Calendar };
export type { CalendarEvent };