import { motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Sparkles,
  Users,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { cn } from "../lib/utils";

type AnalyticsData = {
  popularVenues: { name: string; count: number }[];
  busiestClubs: { name: string; count: number }[];
  busiestClubsEvents: { name: string; count: number }[];
  bookingsByMonth: { month: string; count: number }[];
};

const AdminAnalytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const result = await apiRequest<AnalyticsData>("/api/admin/analytics");
        setData(result);
      } catch (err: any) {
        setError(err.message || "Failed to fetch analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-center p-4">
        <div className="mb-4 rounded-full bg-error/10 p-4 text-error">
          <BarChart3 size={32} />
        </div>
        <h2 className="mb-2 text-xl font-bold text-textPrimary">
          Failed to load analytics
        </h2>
        <p className="text-textSecondary text-sm max-w-md">{error}</p>
      </div>
    );
  }

  const maxMonthCount = Math.max(
    ...data.bookingsByMonth.map((m) => m.count),
    1
  );
  const maxVenueCount = Math.max(...data.popularVenues.map((v) => v.count), 1);
  const maxClubCount = Math.max(...data.busiestClubs.map((c) => c.count), 1);
  const maxClubEventsCount = Math.max(
    ...data.busiestClubsEvents.map((c) => c.count),
    1
  );

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-full overflow-hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-textPrimary">
              Analytics Dashboard
            </h1>
          </div>
          <p className="mt-1 mb-2 text-xs sm:text-sm text-textSecondary mt-0.5">
            Platform usage and engagement metrics (Last 6 Months)
          </p>
        </div>
      </div>

      {/* Main Grid: Chart & Rankings */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 w-full min-w-0 max-w-full">
        {/* Bookings by Month (Bar Chart) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl sm:rounded-2xl border border-borderSoft bg-card p-3.5 sm:p-6 shadow-sm md:col-span-2 lg:col-span-3 flex flex-col w-full min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-6">
            <h3 className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-lg font-bold text-textPrimary truncate">
              <BarChart3 className="text-brand shrink-0" size={18} />
              <span className="truncate">Bookings Trend</span>
            </h3>
          </div>

          {data.bookingsByMonth.length === 0 ? (
            <p className="text-textSecondary text-center py-10 text-xs sm:text-sm">
              No booking data available for this period.
            </p>
          ) : (
            <div className="w-full min-w-0 max-w-full">
              <div className="flex h-44 sm:h-60 items-end justify-between gap-1 sm:gap-3 md:gap-6 pt-6 px-0.5 sm:px-1 border-b border-borderSoft/60 pb-2 w-full min-w-0">
                {data.bookingsByMonth.map((item, i) => {
                  const barHeightPercent = item.count > 0 ? Math.max((item.count / maxMonthCount) * 80, 4) : 2;
                  const monthParts = item.month.split(" ");
                  const shortMonth = monthParts[0]?.slice(0, 3) || item.month;  

                  return (
                    <div
                      key={i}
                      className="group flex flex-1 flex-col items-center justify-end h-full min-w-0"
                    >
                      {/* Bar column */}
                      <div className="relative flex w-full max-w-[2.25rem] sm:max-w-[3.5rem] flex-col items-center justify-end h-full min-w-0">
                        {/* Value pill positioned directly above the bar */}
                        {item.count > 0 && (
                          <div
                            className="absolute text-textPrimary text-[11px] sm:text-xs font-bold z-10 pointer-events-none transition-all"
                            style={{
                              bottom: `calc(${barHeightPercent}% + 4px)`,
                            }}
                          >
                            {item.count}
                          </div>
                        )}

                        {/* Bar visual */}
                        <div className="w-full h-full flex items-end min-w-0">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{
                              height: `${barHeightPercent}%`,
                            }}
                            transition={{ duration: 0.6, delay: 0.08 * i }}
                            className={cn(
                              "w-full rounded-t-sm sm:rounded-t-md transition-all",
                              item.count > 0
                                ? "bg-gradient-to-t from-brand/70 to-brand group-hover:from-brand shadow-sm"
                                : "bg-borderSoft/30"
                            )}
                          />
                        </div>
                      </div>

                      {/* Month label */}
                      <div className="mt-1.5 text-center w-full min-w-0 overflow-hidden">
                        <p className="text-[10px] sm:text-xs font-semibold text-textPrimary truncate">
                          {shortMonth}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>

        {/* Popular Venues */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl sm:rounded-2xl border border-borderSoft bg-card p-3.5 sm:p-6 shadow-sm flex flex-col w-full min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <h3 className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-lg font-bold text-textPrimary truncate">
              <Building2 className="text-amber-500 shrink-0" size={18} />
              <span className="truncate">Most Booked Venues</span>
            </h3>
          </div>

          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
            {data.popularVenues.length === 0 ? (
              <p className="text-textSecondary text-center py-6 text-xs sm:text-sm">
                No venue bookings yet.
              </p>
            ) : (
              data.popularVenues.map((venue, i) => (
                <div key={i} className="space-y-1.5 group min-w-0">
                  <div className="flex items-center justify-between text-xs sm:text-sm min-w-0 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full bg-hoverSoft text-[9px] sm:text-[10px] font-bold text-textMuted">
                        {i + 1}
                      </span>
                      <span
                        className="font-medium text-textPrimary truncate text-xs sm:text-sm"
                        title={venue.name}
                      >
                        {venue.name}
                      </span>
                    </div>
                    <span className="font-bold text-textSecondary shrink-0 text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-hoverSoft/50 font-mono">
                      {venue.count}
                    </span>
                  </div>
                  <div className="h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-borderSoft/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(venue.count / maxVenueCount) * 100}%`,
                      }}
                      transition={{ duration: 0.8, delay: 0.15 + i * 0.05 }}
                      className="h-full rounded-full bg-amber-500"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Busiest Clubs (Slot Bookings) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl sm:rounded-2xl border border-borderSoft bg-card p-3.5 sm:p-6 shadow-sm flex flex-col w-full min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <h3 className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-lg font-bold text-textPrimary truncate">
              <Users className="text-emerald-500 shrink-0" size={18} />
              <span className="truncate">Most Venue Bookings</span>
            </h3> 
          </div>

          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
            {data.busiestClubs.length === 0 ? (
              <p className="text-textSecondary text-center py-6 text-xs sm:text-sm">
                No club bookings recorded yet.
              </p>
            ) : (
              data.busiestClubs.map((club, i) => (
                <div key={i} className="space-y-1.5 group min-w-0">
                  <div className="flex items-center justify-between text-xs sm:text-sm min-w-0 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full bg-hoverSoft text-[9px] sm:text-[10px] font-bold text-textMuted">
                        {i + 1}
                      </span>
                      <span
                        className="font-medium text-textPrimary truncate text-xs sm:text-sm"
                        title={club.name}
                      >
                        {club.name}
                      </span>
                    </div>
                    <span className="font-bold text-textSecondary shrink-0 text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-hoverSoft/50 font-mono">
                      {club.count}
                    </span>
                  </div>
                  <div className="h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-borderSoft/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(club.count / maxClubCount) * 100}%`,
                      }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                      className="h-full rounded-full bg-emerald-500"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Busiest Clubs (Student Events) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl sm:rounded-2xl border border-borderSoft bg-card p-3.5 sm:p-6 shadow-sm flex flex-col w-full min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <h3 className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-lg font-bold text-textPrimary truncate">
              <CalendarDays className="text-blue-500 shrink-0" size={18} />
              <span className="truncate">Most Student Events</span>
            </h3>
          </div>

          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
            {data.busiestClubsEvents.length === 0 ? (
              <p className="text-textSecondary text-center py-6 text-xs sm:text-sm">
                No active student events recorded yet.
              </p>
            ) : (
              data.busiestClubsEvents.map((club, i) => (
                <div key={i} className="space-y-1.5 group min-w-0">
                  <div className="flex items-center justify-between text-xs sm:text-sm min-w-0 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="flex h-4 w-4 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-full bg-hoverSoft text-[9px] sm:text-[10px] font-bold text-textMuted">
                        {i + 1}
                      </span>
                      <span
                        className="font-medium text-textPrimary truncate text-xs sm:text-sm"
                        title={club.name}
                      >
                        {club.name}
                      </span>
                    </div>
                    <span className="font-bold text-textSecondary shrink-0 text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-hoverSoft/50 font-mono">
                      {club.count}
                    </span>
                  </div>
                  <div className="h-1.5 sm:h-2 w-full overflow-hidden rounded-full bg-borderSoft/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${(club.count / maxClubEventsCount) * 100}%`,
                      }}
                      transition={{ duration: 0.8, delay: 0.25 + i * 0.05 }}
                      className="h-full rounded-full bg-blue-500"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
