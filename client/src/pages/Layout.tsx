import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Archive,
    Calendar,
    CalendarDays,
    CalendarPlus,
    ClipboardList,
    FileText,
    Home,
    Key,
    ListTodo,
    LogOut,
    MapPin,
    Menu,
    ShieldCheck,
    Users
} from 'lucide-react';
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { GdgFooterCredit } from '../components/GdgFooterCredit';
import { Logo } from '../components/Logo';
import NotificationPanel from '../components/NotificationPanel';
import { ThemeToggle } from '../components/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '../components/ui/sheet';
import { getSocket } from '../lib/socket';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const adminLinks = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: ShieldCheck, end: true },
  { to: '/admin/requests', label: 'Slot Requests', short: 'Slots', icon: ClipboardList },
  { to: '/admin/event-requests', label: 'Event Registrations', short: 'Events', icon: CalendarDays },
  { to: '/admin/clubs', label: 'Clubs', short: 'Clubs', icon: Users },
  { to: '/admin/venues', label: 'Venues', short: 'Venues', icon: MapPin },
  { to: '/admin/event-reports', label: 'Event Reports', short: 'Reports', icon: FileText },
  { to: '/members', label: 'Members', short: 'Members', icon: Users },
  { to: '/archives', label: 'Archives', short: 'Archives', icon: Archive },
];

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const location = useLocation();
  const clubLabel = user.organization_type 
    ? (user.organization_type === 'other' ? 'Club' : user.organization_type.charAt(0).toUpperCase() + user.organization_type.slice(1)) 
    : (user.name.toLowerCase().includes('committee') ? 'Committee' : 'Club');

  const links = user.role === 'club'
    ? [
        { to: '/', label: `${clubLabel} Portal`, short: 'Home', icon: Home, end: true },
        { to: '/book', label: 'Book Venue', short: 'Book', icon: CalendarPlus },
        { to: '/my-bookings', label: 'My Bookings', short: 'Bookings', icon: ListTodo },
        { to: '/manage-events', label: 'Manage Events', short: 'Events', icon: Calendar },
        { to: '/event-reports', label: 'Event Reports', short: 'Reports', icon: FileText },
        { to: '/members', label: 'Members', short: 'Members', icon: Users },
        { to: '/archives', label: 'Archives', short: 'Archives', icon: Archive },
        { to: '/policy', label: 'Policy', short: 'Policy', icon: FileText },
      ]
    : adminLinks;

  // Bottom bar carries the four most-used destinations; the rest stay one tap
  // away behind "More", which opens the same drawer the sidebar uses.
  const primaryLinks = links.slice(0, 4);

  React.useEffect(() => {
    if (user.role !== 'club') return;

    const socket = getSocket();
    const handleStatusChanged = (payload: { eventName: string; status: 'approved' | 'rejected' | 'deleted' }) => {
      if (payload.status === 'approved') {
        toast.success(`Booking Approved: ${payload.eventName}`, {
          description: 'Your request has been officially confirmed.',
          duration: 5000,
        });
      } else if (payload.status === 'rejected') {
        toast.error(`Booking Rejected: ${payload.eventName}`, {
          description: 'Your request was not approved by the admin.',
          duration: 6000,
        });
      }
    };

    if (!socket) return;
    socket.on('booking:status_changed', handleStatusChanged);
    return () => {
      socket.off('booking:status_changed', handleStatusChanged);
    };
  }, [user]);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative group cursor-pointer',
      isActive
        ? 'text-brand bg-brand/8 font-semibold'
        : 'text-textMuted dark:text-white hover:text-textPrimary dark:hover:text-white hover:bg-hoverSoft'
    );

  const mobileNavClass = (isActive: boolean) =>
    cn(
      'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-colors duration-200 relative cursor-pointer select-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
      isActive
        ? 'text-brand'
        : 'text-textMuted active:bg-hoverSoft active:text-textPrimary'
    );

  return (
    <div className="min-h-dvh flex bg-bgMain relative">
      {/* ====== Desktop Sidebar ====== */}
      <aside className="hidden lg:flex flex-col w-(--sidebar-width) fixed h-full z-10 border-r border-borderSoft bg-card/80 backdrop-blur-xl">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="p-5 lg:p-6 border-b border-borderSoft"
          >
            <Logo size="md" />
          </motion.div>

          {/* Nav */}
          <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto overscroll-contain scrollbar-hide">
            <div className="px-3 py-2 text-[10px] font-bold text-textMuted/50 uppercase tracking-[0.15em] mt-1 mb-1">
              {user.role === 'club' ? 'Club Menu' : 'Admin Controls'}
            </div>
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navItemClass} end={link.end}>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-brand/8 rounded-xl"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <link.icon size={20} className="relative z-10" />
                    <span className="relative z-10">{link.label}</span>
                  </>
                )}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-borderSoft/50 pt-2">
              <button 
                onClick={() => setIsPasswordModalOpen(true)}
                className={cn(navItemClass({ isActive: false }), "w-full text-left")}
              >
                <Key size={20} className="relative z-10 text-textMuted" />
                <span className="relative z-10">Change Password</span>
              </button>
            </div>
          </nav>

          {/* User Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="p-2 border-t border-borderSoft"
          >
            <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-hoverSoft transition-colors group">
               <Avatar className={cn("h-10 w-10 border border-borderSoft shrink-0 shadow-sm transition-all group-hover:border-brand/50 ring-2 ring-brand/10", user.logoBg === 'white' ? 'bg-white' : user.logoBg === 'dark' ? 'bg-slate-900' : 'bg-transparent')}>
                <AvatarImage src={user.logoUrl || ''} alt={user.name} className="object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)]" />
                <AvatarFallback className="bg-brand text-white font-semibold text-sm flex items-center justify-center">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 pr-1">
                <p className="text-sm font-semibold text-textPrimary line-clamp-3 leading-snug group-hover:text-brand transition-colors">
                  {user.name}
                </p>
                <p className="text-[11px] text-textMuted dark:text-white/85 truncate mt-0.5">
                  {user.role === 'club' ? `Group ${user.group}` : 'Administrator'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </aside>

      {/* ====== Main Content ====== */}
      <div className="flex-1 min-w-0 overflow-x-hidden lg:ml-(--sidebar-width) flex flex-col min-h-dvh">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="sticky top-0 z-20 px-4 sm:px-6 py-3 flex items-center justify-between bg-bgMain/80 backdrop-blur-xl border-b border-borderSoft/50"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile: logo in the header, navigation lives in the bottom bar */}
            <div className="lg:hidden flex items-center gap-3 min-w-0">
              <Logo size="sm" />
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetContent side="left" className="w-[280px] sm:w-[320px] flex flex-col p-0 border-r border-borderSoft bg-card/90 backdrop-blur-xl">
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <div
                    className="p-5 border-b border-borderSoft"
                    style={{ paddingTop: 'max(env(safe-area-inset-top), 1.25rem)' }}
                  >
                    <Logo size="md" />
                  </div>
                  <nav aria-label="Sidebar navigation" className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto overscroll-contain scrollbar-hide">
                    <div className="px-3 py-2 text-[10px] font-bold text-textMuted/50 uppercase tracking-[0.15em] mt-1 mb-1">
                      {user.role === 'club' ? 'Club Menu' : 'Admin Controls'}
                    </div>
                    {links.map((link, index) => (
                      <NavLink 
                        key={link.to} 
                        to={link.to} 
                        className={({ isActive }) => cn(navItemClass({ isActive }), index < 4 ? "hidden lg:flex" : "")} 
                        end={link.end}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <motion.div
                                layoutId="mobile-sidebar-active"
                                className="absolute inset-0 bg-brand/8 rounded-xl"
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}
                            <link.icon size={20} className="relative z-10" />
                            <span className="relative z-10">{link.label}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                    <div className="mt-2 border-t border-borderSoft/50 pt-2">
                      <button 
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          setIsPasswordModalOpen(true);
                        }}
                        className={cn(navItemClass({ isActive: false }), "w-full text-left")}
                      >
                        <Key size={20} className="relative z-10 text-textMuted" />
                        <span className="relative z-10">Change Password</span>
                      </button>
                    </div>
                  </nav>
                  
                  {/* User info in mobile drawer */}
                  <div className="p-3 border-t border-borderSoft">
                    <div className="flex items-center gap-3 p-2 rounded-xl bg-hoverSoft/50">
                      <Avatar className={cn("h-9 w-9 border border-borderSoft shrink-0 shadow-sm", user.logoBg === 'white' ? 'bg-white' : user.logoBg === 'dark' ? 'bg-slate-900' : 'bg-transparent')}>
                        <AvatarImage src={user.logoUrl || ''} alt={user.name} className="object-contain" />
                        <AvatarFallback className="bg-brand text-white font-semibold text-xs flex items-center justify-center">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-textPrimary truncate">{user.name}</p>
                        <p className="text-[10px] text-textMuted dark:text-white/85 truncate">{user.role === 'club' ? `Group ${user.group}` : 'Administrator'}</p>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="flex items-center gap-2 text-textMuted hover:text-error hover:bg-error/10 rounded-lg h-9 px-2.5 sm:px-3 font-medium transition-all border border-borderSoft/60 shadow-sm bg-card/80 backdrop-blur cursor-pointer"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </motion.header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 3xl:p-12 mb-bottom-nav">
          <div className="max-w-7xl 3xl:max-w-[1800px] 4k:max-w-[2400px] uhd:max-w-[3200px] mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Footer (desktop) */}
        <footer className="hidden lg:block border-t border-borderSoft/50 py-4 px-6">
          <GdgFooterCredit compact className="max-w-none" />
        </footer>
      </div>

      {/* ====== Mobile Bottom Navigation ====== */}
      <nav
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-borderSoft bg-card/95 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="grid grid-cols-5 items-stretch px-1 h-(--bottom-nav-height)">
          {primaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => mobileNavClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-active"
                      className="absolute inset-x-1.5 top-0 h-0.5 rounded-full bg-brand"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <link.icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span className="text-[10px] font-semibold leading-none truncate max-w-full">
                    {link.short}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="More navigation options"
            aria-expanded={isMobileMenuOpen}
            className={mobileNavClass(isMobileMenuOpen)}
          >
            <Menu size={21} strokeWidth={isMobileMenuOpen ? 2.4 : 1.8} />
            <span className="text-[10px] font-semibold leading-none">More</span>
          </button>
        </div>
      </nav>

      <ChangePasswordModal
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
        userEmail={user.email}
      />
    </div>
  );
};

export default Layout;
