import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarPlus,
  Clock,
  Info,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Calendar, type CalendarEvent } from "../components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Skeleton } from "../components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { AppEvent, Booking, GroupedBooking, User } from "../types";
import {
  apiRequest,
  groupBookings,
  mapBooking,
  splitGroupedBookingsByDay,
  type ApiBooking,
  type ApiVenue,
} from "./api";
import { getErrorMessage } from "./errors";
import { getSocket, SOCKET_EVENTS } from "./socket";

import { cn, formatISTDate, toLocalISOString } from "@/lib/utils";

interface ClubDashboardProps {
  user: User;
}

const formatEventType = (eventType?: string) => {
  if (!eventType) return "";
  return eventType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

type ScheduleCalendarCardProps = {
  title: string;
  headerAction?: React.ReactNode;
  selectedDate?: Date;
  onSelectDate: (date?: Date) => void;
  sourceGroupedEvents: GroupedBooking[];
  calendarEvents: CalendarEvent[];
  eventDates: Date[];
  venues: ApiVenue[];
  emptyMessage: string;
};

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const ScheduleCalendarCard = ({
  title,
  headerAction,
  selectedDate,
  onSelectDate,
  sourceGroupedEvents,
  calendarEvents,
  eventDates,
  venues,
  emptyMessage,
}: ScheduleCalendarCardProps) => {
  const selectedDateEvents = selectedDate
    ? sourceGroupedEvents
        .filter((event) => isSameDay(new Date(event.date), selectedDate))
        .sort(
          (a, b) =>
            new Date(a.startTimeISO || a.date).getTime() -
            new Date(b.startTimeISO || b.date).getTime(),
        )
    : [];

  return (
    <Card className="rounded-xl h-full border border-borderSoft overflow-hidden">
      <CardHeader className="border-b border-borderSoft p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
          <CardTitle className="text-base sm:text-lg md:text-xl font-bold truncate min-w-0">{title}</CardTitle>
          <div className="shrink-0 max-w-full">
            {headerAction}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-2 sm:p-3">
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="w-full min-w-0">
            <div className="w-full min-w-0 max-w-[380px] mx-auto overflow-x-auto">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={onSelectDate}
                events={calendarEvents}
                modifiers={{ hasEvents: eventDates }}
                modifiersClassNames={{
                  hasEvents:
                    "relative after:absolute after:bottom-[8%] after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary",
                }}
                className="rounded-2xl mx-auto xl:mx-0"
              />
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-1 flex-col border-t border-borderSoft pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-1">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              {selectedDate
                ? selectedDate.toLocaleDateString("en-US", {
                    timeZone: "Asia/Kolkata",
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })
                : "Select a date"}
            </h4>

            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 xl:max-h-[320px]">
              {selectedDate
                ? (() => {
                    return selectedDateEvents.length > 0 ? (
                      selectedDateEvents.map((event, index) => (
                        <motion.div
                          key={event.batchId || event.ids?.[0] || index}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          <Card className="border border-borderSoft rounded-xl transition-colors">
                            <CardContent className="p-4">
                              <div className="font-semibold text-foreground text-sm mb-1">
                                {event.bookingName}
                              </div>
                              {event.eventName &&
                                event.eventName !== event.bookingName && (
                                  <div className="text-xs text-muted-foreground font-medium mb-1">
                                    Linked Event: {event.eventName}
                                  </div>
                                )}
                              <div className="mt-0.5 mb-2 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-primary font-medium">
                                  {event.clubName}
                                </span>
                                {event.eventType && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-5"
                                  >
                                    {formatEventType(event.eventType)}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                                <Clock
                                  size={12}
                                  className="text-primary/60 mt-0.5"
                                />
                                <span>
                                  {event.startTime} - {event.endTime}
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-start gap-2 text-xs text-muted-foreground">
                                <MapPin
                                  size={12}
                                  className="text-primary/60 mt-0.5"
                                />
                                <span>{event.venueName}</span>
                              </div>
                              {event.status === "partial" && (
                                <div className="mt-2">
                                  <Badge
                                    variant="warning"
                                    className="text-[10px]"
                                  >
                                    PARTIAL APPROVAL
                                  </Badge>
                                </div>
                              )}
                              {event.status === "pending" && (
                                <div className="mt-2">
                                  <Badge
                                    variant="pending"
                                    className="text-[10px]"
                                  >
                                    PENDING
                                  </Badge>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        {emptyMessage}
                      </div>
                    );
                  })()
                : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ClubDashboard: React.FC<ClubDashboardProps> = ({ user }) => {
  const [allEvents, setAllEvents] = React.useState<Booking[]>([]);
  const [myEvents, setMyEvents] = React.useState<Booking[]>([]);
  const [venues, setVenues] = React.useState<ApiVenue[]>([]);
  const [registeredEvents, setRegisteredEvents] = React.useState<AppEvent[]>(
    [],
  );
  const [publicCampusEvents, setPublicCampusEvents] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [calendarView, setCalendarView] = React.useState<
    "campus_events" | "global" | "club"
  >("global");
  const navigate = useNavigate();

  const [clubDetails, setClubDetails] = React.useState<{
    description: string;
    key_activities: string;
    linkedin_url: string;
    instagram_url: string;
    youtube_url: string;
    website_url: string;
    logo_url?: string;
    logo_bg?: string;
    member_tag?: string;
  } | null>(null);
  const [isEditAboutOpen, setIsEditAboutOpen] = React.useState(false);
  const [isSavingAbout, setIsSavingAbout] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    description: "",
    key_activities: "",
    linkedin_url: "",
    instagram_url: "",
    youtube_url: "",
    website_url: "",
    logo_url: "",
    logo_bg: "transparent",
    member_tag: "",
  });

  const entityType = user.organization_type
    ? user.organization_type === "other"
      ? "Club"
      : user.organization_type.charAt(0).toUpperCase() +
        user.organization_type.slice(1)
    : user.name.toLowerCase().includes("committee")
      ? "Committee"
      : "Club";

  const fetchEvents = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        venuesData,
        myBookings,
        publicBookings,
        eventsData,
        myClubData,
        publicEventsData,
      ] = await Promise.all([
        apiRequest<ApiVenue[]>("/api/venues"),
        apiRequest<ApiBooking[]>("/api/my-bookings", { auth: true }),
        apiRequest<ApiBooking[]>("/api/campus-bookings", { auth: true }),
        apiRequest<AppEvent[]>("/api/events", { auth: true }),
        apiRequest<any>("/api/clubs/my-club", { auth: true }),
        apiRequest<any[]>("/api/events/public").catch(() => []),
      ]);

      const mappedMyBookings = myBookings.map(mapBooking);
      const mappedPublicBookings = publicBookings.map(mapBooking);

      setVenues(venuesData);
      setMyEvents(mappedMyBookings);
      setAllEvents(mappedPublicBookings);
      setRegisteredEvents(eventsData);
      setPublicCampusEvents(publicEventsData || []);
      setClubDetails(myClubData);
      setEditForm({
        description: myClubData?.description || "",
        key_activities: myClubData?.key_activities || "",
        linkedin_url: myClubData?.linkedin_url || "",
        instagram_url: myClubData?.instagram_url || "",
        youtube_url: myClubData?.youtube_url || "",
        website_url: myClubData?.website_url || "",
        logo_url: myClubData?.logo_url || "",
        logo_bg: myClubData?.logo_bg || "transparent",
        member_tag: myClubData?.member_tag || "",
      });
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError(getErrorMessage(err, "Failed to load events."));
      setAllEvents([]);
      setMyEvents([]);
      setRegisteredEvents([]);
      setPublicCampusEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSaveAbout = async () => {
    setIsSavingAbout(true);
    try {
      await apiRequest("/api/clubs/my-club", {
        method: "PATCH",
        auth: true,
        body: editForm,
      });
      toast.success("Club profile updated successfully");
      setIsEditAboutOpen(false);
      window.location.reload();
    } catch (error) {
      console.error("Failed to update club profile:", error);
      toast.error("Failed to update club profile");
    } finally {
      setIsSavingAbout(false);
    }
  };

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Socket.io: join the club's own room and listen for booking status changes
  React.useEffect(() => {
    // We use the user's email to associate with the right club room
    // The server emits to `club:${data.club_id}`, so we need the club id
    // We'll figure it out once events load by checking myEvents[0]?.clubId
    const socket = getSocket();

    // Join club room if we have a clubId from the first event
    if (myEvents.length > 0) {
      socket.emit(SOCKET_EVENTS.JOIN_CLUB, myEvents[0].clubId);
    } else if (user?.role === "club") {
      // If we have at least one event, it works.
    }

    const handleStatusChanged = (payload: {
      eventName: string;
      status: "approved" | "rejected" | "deleted";
      clubId: string;
    }) => {
      fetchEvents(); // refresh to show updated status
    };

    const handleEventsUpdated = () => {
      fetchEvents();
    };

    socket.on(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleStatusChanged);
    socket.on(SOCKET_EVENTS.EVENTS_UPDATED, handleEventsUpdated);
    return () => {
      socket.off(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleStatusChanged);
      socket.off(SOCKET_EVENTS.EVENTS_UPDATED, handleEventsUpdated);
    };
  }, [fetchEvents, myEvents, user]);

  const getVenueName = (id: string) =>
    venues.find((v) => v.id === id)?.name || id;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );

  const visibleGlobalEvents = React.useMemo(() => {
    const myEventIds = new Set(myEvents.map((event) => event.id));
    const otherPublicEvents = allEvents.filter(
      (event) => !myEventIds.has(event.id),
    );
    return [...myEvents, ...otherPublicEvents];
  }, [allEvents, myEvents]);

  const splitPublicEventsByDay = React.useCallback(
    (events: any[]): GroupedBooking[] => {
      const result: GroupedBooking[] = [];

      for (const event of events) {
        const startDate = new Date(event.date);
        const endDate = event.end_date ? new Date(event.end_date) : startDate;

        const current = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
        );
        const last = new Date(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
        );

        const startTimeStr = startDate.toLocaleTimeString([], {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        });
        const endTimeStr = endDate.toLocaleTimeString([], {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
        });

        const clubName = event.clubs?.name || event.club_name || "Campus Event";

        while (current <= last) {
          const dayISO = new Date(current.getTime()).toISOString();
          result.push({
            id: `${event.id}-${current.toISOString().slice(0, 10)}`,
            ids: [event.id],
            bookingName: event.name,
            eventName: event.name,
            clubName: clubName,
            clubId: event.club_id || "",
            venueName: event.venue || "No Venue Specified",
            venueId: "",
            venueIds: [],
            date: dayISO,
            startTime: startTimeStr,
            endTime: endTimeStr,
            startTimeISO: event.date,
            endTimeISO: event.end_date || event.date,
            status: "approved",
            eventType: event.event_type,
            expectedAttendees: 0,
            createdAt: event.created_at || "",
            updatedAt: event.updated_at || "",
            bookings: [],
          } as unknown as GroupedBooking);

          current.setDate(current.getDate() + 1);
        }
      }

      return result;
    },
    [],
  );

  const getEventDates = React.useCallback(
    (events: GroupedBooking[]) =>
      events.map((e) => {
        const d = new Date(e.date);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
      }),
    [],
  );

  const toCalendarEvents = React.useCallback(
    (events: any[]): CalendarEvent[] =>
      events.map((e) => {
        // For partial bookings, only show the names of approved venues
        const approvedVenueName =
          e.status === "partial"
            ? (e.bookings || [])
                .filter((b: any) => b.status === "approved")
                .map((b: any) => getVenueName(b.venueId))
                .sort((a: string, b: string) => a.localeCompare(b))
                .join(", ")
            : e.venueName || getVenueName(e.venueId || e.venueIds?.[0]);
        return {
          eventName: e.eventName,
          bookingName: e.bookingName,
          clubName: e.clubName,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          startTimeISO: e.startTimeISO,
          venueName:
            approvedVenueName ||
            e.venueName ||
            getVenueName(e.venueId || e.venueIds?.[0]),
          status: e.status,
          eventType: e.eventType,
        };
      }),
    [venues],
  );

  // Campus Master Events
  const campusEventsWithDaySplit = React.useMemo(
    () => splitPublicEventsByDay(publicCampusEvents),
    [splitPublicEventsByDay, publicCampusEvents],
  );
  const campusEventDates = React.useMemo(
    () => getEventDates(campusEventsWithDaySplit),
    [getEventDates, campusEventsWithDaySplit],
  );
  const campusCalendarEventsWithVenue = React.useMemo(
    () => toCalendarEvents(campusEventsWithDaySplit),
    [toCalendarEvents, campusEventsWithDaySplit],
  );

  // Show approved/pending campus bookings plus this club's own approved/partial/pending bookings in the calendar views.
  const calendarEventsGrouped = React.useMemo(
    () =>
      groupBookings(
        visibleGlobalEvents.filter(
          (e) =>
            e.status === "approved" ||
            (e.status as string) === "partial" ||
            e.status === "pending",
        ),
        venues,
      ),
    [visibleGlobalEvents, venues],
  );
  const myCalendarEventsGrouped = React.useMemo(
    () =>
      groupBookings(
        myEvents.filter(
          (e) =>
            e.status === "approved" ||
            (e.status as string) === "partial" ||
            e.status === "pending",
        ),
        venues,
      ),
    [myEvents, venues],
  );

  const calendarEventsWithVenueSplit = React.useMemo(
    () => splitGroupedBookingsByDay(calendarEventsGrouped),
    [calendarEventsGrouped],
  );
  const myCalendarEventsWithVenueSplit = React.useMemo(
    () => splitGroupedBookingsByDay(myCalendarEventsGrouped),
    [myCalendarEventsGrouped],
  );

  // Normalize to local midnight so DayPicker's modifier date-matching works correctly
  const eventDates = React.useMemo(
    () => getEventDates(calendarEventsWithVenueSplit),
    [getEventDates, calendarEventsWithVenueSplit],
  );
  const myEventDates = React.useMemo(
    () => getEventDates(myCalendarEventsWithVenueSplit),
    [getEventDates, myCalendarEventsWithVenueSplit],
  );

  const calendarEventsWithVenue = React.useMemo(
    () => toCalendarEvents(calendarEventsWithVenueSplit),
    [toCalendarEvents, calendarEventsWithVenueSplit],
  );
  const myCalendarEventsWithVenue = React.useMemo(
    () => toCalendarEvents(myCalendarEventsWithVenueSplit),
    [toCalendarEvents, myCalendarEventsWithVenueSplit],
  );

  const activeCalendar = React.useMemo(() => {
    if (calendarView === "campus_events") {
      return {
        title: "Event Calendar",
        sourceGroupedEvents: campusEventsWithDaySplit,
        calendarEvents: campusCalendarEventsWithVenue,
        eventDates: campusEventDates,
        emptyMessage: "No campus events scheduled for this day.",
      };
    }

    if (calendarView === "club") {
      return {
        title: `My Calendar`,
        sourceGroupedEvents: myCalendarEventsWithVenueSplit,
        calendarEvents: myCalendarEventsWithVenue,
        eventDates: myEventDates,
        emptyMessage: `No ${entityType.toLowerCase()} events scheduled for this day.`,
      };
    }

    return {
      title: "Booking Calendar",
      sourceGroupedEvents: calendarEventsWithVenueSplit,
      calendarEvents: calendarEventsWithVenue,
      eventDates,
      emptyMessage: "No venue bookings scheduled for this day.",
    };
  }, [
    calendarView,
    campusEventsWithDaySplit,
    campusCalendarEventsWithVenue,
    campusEventDates,
    calendarEventsWithVenue,
    calendarEventsWithVenueSplit,
    eventDates,
    myCalendarEventsWithVenue,
    myCalendarEventsWithVenueSplit,
    myEventDates,
    entityType,
  ]);

  const upcomingEvents = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return publicCampusEvents
      .filter((e) => {
        const eventEnd = e.end_date ? new Date(e.end_date) : new Date(e.date);
        return eventEnd >= now && e.status !== "cancelled";
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [publicCampusEvents]);

  if (error) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary tracking-tight">
            Welcome, {user.name}
          </h1>
        </div>
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle size={16} />
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription className="mt-1">{error}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-2"
            onClick={fetchEvents}
          >
            <RefreshCw size={14} />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar
              className={cn(
                "h-16 w-16 border-2 border-brand/20 ring-4 ring-brand/5 shrink-0 rounded-2xl bg-white",
              )}
            >
              <AvatarFallback className="bg-brand text-white font-bold text-xl rounded-2xl flex items-center justify-center">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight leading-tight">
                Welcome, {user.name}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base font-medium">
                Manage your events and venue bookings efficiently.
              </p>
            </div>
          </div>
          <Skeleton className="h-11 w-full sm:w-40 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2">
            <Skeleton className="h-[420px] w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[320px] w-full rounded-2xl" />
        </div>
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 sm:space-y-8"
    >
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4 min-w-0">
          <Avatar
            className={cn(
              "h-16 w-16 border border-borderSoft shrink-0 rounded-2xl",
              clubDetails?.logo_bg === "white"
                ? "bg-white"
                : clubDetails?.logo_bg === "dark"
                  ? "bg-slate-900"
                  : "bg-transparent",
            )}
          >
            <AvatarImage
              src={clubDetails?.logo_url || ""}
              alt={user.name}
              className="object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
            />
            <AvatarFallback className="bg-brand text-white font-bold text-xl rounded-2xl flex items-center justify-center">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight leading-tight">
              Welcome, {user.name}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base font-medium">
              Manage your events and venue bookings efficiently.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Button
            onClick={() => setIsEditAboutOpen(true)}
            variant="outline"
            className="w-full sm:w-auto shrink-0 rounded-xl h-11 border-borderSoft hover:bg-hoverSoft font-semibold gap-1.5"
          >
            <Info size={18} className="text-brand" />
            <span>Edit About & Socials</span>
          </Button>
          <Button
            asChild
            className="w-full sm:w-auto shrink-0 rounded-xl h-11 shadow-lg shadow-primary/20 font-semibold gap-1.5"
          >
            <Link to="/book">
              <CalendarPlus size={20} />
              <span>Book a New Slot</span>
            </Link>
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6">
        {/* Schedule Calendar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="min-w-0"
        >
          <ScheduleCalendarCard
            title={activeCalendar.title}
            headerAction={
              <Tabs
                value={calendarView}
                onValueChange={(value) =>
                  setCalendarView(value as "campus_events" | "global" | "club")
                }
                className="w-full sm:w-auto"
              >
                <TabsList
                  aria-label="Calendar view"
                  className="grid grid-cols-3 w-full sm:w-auto sm:inline-flex"
                >
                  <TabsTrigger
                    value="global"
                    className="flex-1 sm:flex-initial whitespace-nowrap px-2.5 sm:px-3.5 text-xs sm:text-sm"
                  >
                    Bookings
                  </TabsTrigger>
                  <TabsTrigger
                    value="campus_events"
                    className="flex-1 sm:flex-initial whitespace-nowrap px-2.5 sm:px-3.5 text-xs sm:text-sm"
                  >
                    Events
                  </TabsTrigger>
                  <TabsTrigger
                    value="club"
                    className="flex-1 sm:flex-initial whitespace-nowrap px-2.5 sm:px-3.5 text-xs sm:text-sm"
                  >
                    My Calendar
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="campus_events" className="hidden" />
                <TabsContent value="global" className="hidden" />
                <TabsContent value="club" className="hidden" />
              </Tabs>
            }
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            sourceGroupedEvents={activeCalendar.sourceGroupedEvents}
            calendarEvents={activeCalendar.calendarEvents}
            eventDates={activeCalendar.eventDates}
            venues={venues}
            emptyMessage={activeCalendar.emptyMessage}
          />
        </motion.div>

        {/* Your Upcoming Events & Registered Events (Sidebar) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="space-y-6"
        >
          {/* Card 1: My Club Bookings */}
          <Card className="border border-borderSoft rounded-xl xl:max-h-[250px]">
            <CardHeader className="border-b border-borderSoft p-3.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  My {entityType} Bookings
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-brand/20 hover:bg-brand/5"
                  asChild
                >
                  <Link
                    to="/my-bookings"
                    className="text-xs text-brand font-semibold hover:text-brand/80"
                  >
                    View All
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px] xl:max-h-[160px]">
                {[...groupBookings(myEvents, venues)]
                  .sort(
                    (a, b) =>
                      new Date(a.startTimeISO || a.date).getTime() -
                      new Date(b.startTimeISO || b.date).getTime(),
                  )
                  .slice(0, 5)
                  .map((event, index) => (
                    <motion.div
                      key={event.batchId || event.ids?.[0] || index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="p-2 hover:bg-hoverSoft transition-colors"
                    >
                      <div className="font-semibold text-foreground text-sm">
                        <span className="text-xs text-muted-foreground font-normal mr-1.5">
                          Booking Name:
                        </span>
                        {event.bookingName}
                      </div>
                      {event.eventName &&
                        event.eventName !== event.bookingName && (
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <span className="font-medium text-[10px] uppercase tracking-wider text-muted-foreground/70">
                              Linked Event:
                            </span>{" "}
                            {event.eventName}
                          </div>
                        )}
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <CalendarPlus size={12} />
                        {new Date(event.date).toLocaleDateString("en-US", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <MapPin size={12} />
                        {event.venueName}
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        {event.eventType && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            {formatEventType(event.eventType)}
                          </Badge>
                        )}
                        {Boolean(event.expectedAttendees && event.expectedAttendees > 0) && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Users size={10} />
                            <span>{event.expectedAttendees}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        <Badge
                          variant={
                            event.status === "approved"
                              ? "success"
                              : event.status === "pending"
                                ? "pending"
                                : event.status === "partial"
                                  ? "warning"
                                  : "destructive"
                          }
                          className="text-[10px]"
                        >
                          <span>
                            {event.status === "partial"
                              ? "Partially Approved"
                              : event.status}
                          </span>
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                {myEvents.length === 0 && (
                  <div className="p-2 text-center text-muted-foreground text-sm">
                    No upcoming bookings.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Registered Events */}
          <Card className="border border-borderSoft rounded-xl xl:max-h-[250px]">
            <CardHeader className="border-b border-borderSoft p-3.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Registered {entityType} Events
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-brand/20 hover:bg-brand/5"
                  asChild
                >
                  <Link
                    to="/manage-events"
                    className="text-xs text-brand font-semibold hover:text-brand/80"
                  >
                    View All
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px] xl:max-h-[160px]">
                {[...registeredEvents]
                  .sort(
                    (a, b) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime(),
                  )
                  .slice(0, 5)
                  .map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="p-4 hover:bg-hoverSoft/40 transition-colors flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-foreground text-sm truncate">
                            {event.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Date:{" "}
                            {formatISTDate(event.date, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                            {event.end_date &&
                              new Date(event.end_date).getTime() !==
                                new Date(event.date).getTime() &&
                              formatISTDate(event.date, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }) !==
                                formatISTDate(event.end_date, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }) && (
                                <>
                                  {" – "}
                                  {formatISTDate(event.end_date, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </>
                              )}
                          </div>
                        </div>
                        {(() => {
                          const eventEndDate = event.dynamic_end_date
                            ? new Date(event.dynamic_end_date)
                            : new Date(event.date);
                          const isPast = eventEndDate < new Date();

                          return !isPast ? (
                            <Button
                              onClick={() =>
                                navigate("/book", {
                                  state: {
                                    prefill: {
                                      event_id: event.id,
                                      eventName: event.name,
                                      date: event.date
                                        ? toLocalISOString(new Date(event.date))
                                        : "",
                                      venueName: event.venue || "",
                                    },
                                  },
                                })
                              }
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] rounded-lg bg-brand/10 hover:bg-brand/20 border-brand/20 text-brand font-bold shrink-0 px-2.5 py-0"
                            >
                              Book Slot
                            </Button>
                          ) : null;
                        })()}
                      </div>
                    </motion.div>
                  ))}
                {registeredEvents.length === 0 && (
                  <div className="p-2 text-center text-muted-foreground text-sm">
                    No registered events yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming Events */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          delay: 0.35,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
      >
        <Card className="border border-borderSoft rounded-xl">
          <CardHeader className="border-b border-borderSoft">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  Upcoming Campus Events
                </CardTitle>
                <CardDescription className="mt-1">
                  Events happening in the coming days across all clubs and
                  venues
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-3">
            {upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingEvents.map((event, index) => {
                  const startDate = new Date(event.date);
                  const endDate = event.end_date
                    ? new Date(event.end_date)
                    : startDate;
                  const isMultiDay =
                    endDate.toDateString() !== startDate.toDateString();
                  const clubName = event.clubs?.name || event.club_name;
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card className="border border-borderSoft rounded-xl h-full">
                        <CardContent className="p-4">
                          <div className="font-semibold text-foreground text-sm leading-tight mb-1">
                            {event.name}
                          </div>
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            {clubName && (
                              <span className="text-xs text-primary font-medium">
                                {clubName}
                              </span>
                            )}
                            {(event as any).event_type && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-5"
                              >
                                {formatEventType((event as any).event_type)}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CalendarPlus
                                size={12}
                                className="text-primary/60 shrink-0"
                              />
                              <span>
                                {startDate.toLocaleDateString("en-US", {
                                  timeZone: "Asia/Kolkata",
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                                {isMultiDay &&
                                  ` – ${endDate.toLocaleDateString("en-US", {
                                    timeZone: "Asia/Kolkata",
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}`}
                              </span>
                            </div>
                            {event.venue && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <MapPin
                                  size={12}
                                  className="text-primary/60 shrink-0"
                                />
                                <span>{event.venue}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No upcoming campus events scheduled.
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Dialog for Edit About & Socials */}
      <Dialog open={isEditAboutOpen} onOpenChange={setIsEditAboutOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-card border border-borderSoft text-textPrimary max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {entityType} Profile</DialogTitle>
            <DialogDescription className="text-textMuted">
              Update your {entityType.toLowerCase()}'s description, key
              activities, and social media URLs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-textSecondary font-semibold">
                Club/Committee Logo
              </Label>
              <div className="flex items-center gap-4 p-3 rounded-xl bg-bgMain border border-borderSoft">
                <Avatar
                  className={cn(
                    "h-14 w-14 border border-borderSoft rounded-xl shrink-0",
                    editForm.logo_bg === "white"
                      ? "bg-white"
                      : editForm.logo_bg === "dark"
                        ? "bg-slate-900"
                        : "bg-transparent",
                  )}
                >
                  <AvatarImage
                    src={editForm.logo_url || ""}
                    alt={user.name}
                    className="object-contain"
                  />
                  <AvatarFallback className="bg-brand text-white font-semibold text-lg flex items-center justify-center">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <input
                    type="file"
                    id="edit-logo-file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error("Image size must be less than 2MB");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (
                            event.target?.result &&
                            typeof event.target.result === "string"
                          ) {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement("canvas");
                              const MAX_WIDTH = 256;
                              const MAX_HEIGHT = 256;
                              let width = img.width;
                              let height = img.height;

                              if (width > height) {
                                if (width > MAX_WIDTH) {
                                  height *= MAX_WIDTH / width;
                                  width = MAX_WIDTH;
                                }
                              } else {
                                if (height > MAX_HEIGHT) {
                                  width *= MAX_HEIGHT / height;
                                  height = MAX_HEIGHT;
                                }
                              }

                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext("2d");
                              if (ctx) {
                                ctx.drawImage(img, 0, 0, width, height);
                                const dataUrl = canvas.toDataURL("image/png");
                                setEditForm((prev) => ({
                                  ...prev,
                                  logo_url: dataUrl,
                                }));
                              }
                            };
                            img.src = event.target.result;
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-lg text-xs"
                      onClick={() =>
                        document.getElementById("edit-logo-file")?.click()
                      }
                    >
                      Choose Image
                    </Button>
                    {editForm.logo_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-xs text-error hover:bg-error/10 hover:text-error"
                        onClick={() =>
                          setEditForm((prev) => ({ ...prev, logo_url: "" }))
                        }
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                  <span className="text-[10px] text-textMuted">
                    PNG, JPG (Max 2MB)
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-textSecondary font-semibold">
                Logo Background
              </Label>
              <Select
                value={editForm.logo_bg}
                onValueChange={(v) => setEditForm({ ...editForm, logo_bg: v })}
              >
                <SelectTrigger className="w-full bg-bgMain border-borderSoft h-10 rounded-xl">
                  <SelectValue placeholder="Select a background for your logo" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-borderSoft rounded-xl shadow-lg">
                  <SelectItem value="transparent">
                    Transparent (Adapts to theme)
                  </SelectItem>
                  <SelectItem value="white">
                    White (Best for dark logos)
                  </SelectItem>
                  <SelectItem value="dark">
                    Dark (Best for light/white logos)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="edit-member-tag"
                className="text-textSecondary font-semibold"
              >
                Member Tag{" "}
                <span className="text-[10px] text-textMuted ml-1">
                  (Max 30 chars)
                </span>
              </Label>
              <Input
                id="edit-member-tag"
                value={editForm.member_tag}
                maxLength={30}
                onChange={(e) =>
                  setEditForm({ ...editForm, member_tag: e.target.value })
                }
                placeholder="e.g. Official Campus Committee"
                className="rounded-xl bg-bgMain border-borderSoft text-textPrimary h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="edit-description"
                className="text-textSecondary font-semibold"
              >
                Description
              </Label>
              <textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                placeholder="Briefly describe your club's purpose and mission..."
                rows={4}
                className="w-full p-3 rounded-xl bg-bgMain border border-borderSoft text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="edit-activities"
                className="text-textSecondary font-semibold"
              >
                Key Activities & Events
              </Label>
              <textarea
                id="edit-activities"
                value={editForm.key_activities}
                onChange={(e) =>
                  setEditForm({ ...editForm, key_activities: e.target.value })
                }
                placeholder="Highlight your club's major events, regular meetings, and annual projects..."
                rows={3}
                className="w-full p-3 rounded-xl bg-bgMain border border-borderSoft text-textPrimary text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-y"
              />
            </div>
            <div className="border-t border-borderSoft/40 my-2 pt-4">
              <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-3">
                Links & Social Media URLs
              </h4>
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <Label
                    htmlFor="edit-website"
                    className="text-xs text-textSecondary font-semibold"
                  >
                    Website URL
                  </Label>
                  <Input
                    id="edit-website"
                    value={editForm.website_url}
                    onChange={(e) =>
                      setEditForm({ ...editForm, website_url: e.target.value })
                    }
                    placeholder="e.g. clubs.dau.ac.in/myclub"
                    className="rounded-xl bg-bgMain border-borderSoft text-textPrimary h-9 text-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor="edit-linkedin"
                    className="text-xs text-textSecondary font-semibold"
                  >
                    LinkedIn URL
                  </Label>
                  <Input
                    id="edit-linkedin"
                    value={editForm.linkedin_url}
                    onChange={(e) =>
                      setEditForm({ ...editForm, linkedin_url: e.target.value })
                    }
                    placeholder="e.g. linkedin.com/company/myclub"
                    className="rounded-xl bg-bgMain border-borderSoft text-textPrimary h-9 text-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor="edit-instagram"
                    className="text-xs text-textSecondary font-semibold"
                  >
                    Instagram URL
                  </Label>
                  <Input
                    id="edit-instagram"
                    value={editForm.instagram_url}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        instagram_url: e.target.value,
                      })
                    }
                    placeholder="e.g. instagram.com/myclub"
                    className="rounded-xl bg-bgMain border-borderSoft text-textPrimary h-9 text-sm"
                  />
                </div>
                <div className="grid gap-1">
                  <Label
                    htmlFor="edit-youtube"
                    className="text-xs text-textSecondary font-semibold"
                  >
                    YouTube URL
                  </Label>
                  <Input
                    id="edit-youtube"
                    value={editForm.youtube_url}
                    onChange={(e) =>
                      setEditForm({ ...editForm, youtube_url: e.target.value })
                    }
                    placeholder="e.g. youtube.com/@myclub"
                    className="rounded-xl bg-bgMain border-borderSoft text-textPrimary h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditAboutOpen(false)}
              className="rounded-xl border-borderSoft text-textSecondary hover:bg-hoverSoft font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveAbout}
              disabled={isSavingAbout}
              className="rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold"
            >
              {isSavingAbout ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ClubDashboard;
