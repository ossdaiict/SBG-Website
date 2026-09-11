import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/error-boundary';
import { LoadingScreen } from './components/LoadingScreen';
import { PublicLayout } from './components/PublicLayout';
import { apiRequest } from './lib/api';
import { getSocket, reconnectSocket, SOCKET_EVENTS } from './lib/socket';
import { useDocumentTitle } from './lib/useDocumentTitle';
import { User } from './types';
const Layout = React.lazy(() => import('./pages/Layout'));
const Login = React.lazy(() => import('./pages/Login'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const AboutSBG = React.lazy(() => import('./pages/AboutSBG'));
const ClubsCommitteesPage = React.lazy(() => import('./pages/ClubsCommitteesPage'));
const ClubDashboard = React.lazy(() => import('./lib/ClubDashboard'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminVenues = React.lazy(() => import('./pages/AdminVenues'));
const BookSlot = React.lazy(() => import('./pages/BookSlot'));
const AdminClubs = React.lazy(() => import('./pages/AdminClubs'));
const AdminRequests = React.lazy(() => import('./pages/AdminRequests'));
const AdminEventRequests = React.lazy(() => import('./pages/AdminEventRequests'));
const PolicyPage = React.lazy(() => import('./pages/PolicyPage'));
const MyBookings = React.lazy(() => import('./pages/MyBookings'));
const ClubMembers = React.lazy(() => import('./pages/ClubMembers'));
const ManageEvents = React.lazy(() => import('./pages/ManageEvents'));
const EventReports = React.lazy(() => import('./pages/EventReports'));
const AdminEventReports = React.lazy(() => import('./pages/AdminEventReports'));
const Archives = React.lazy(() => import('./pages/Archives'));

const PageTitleWrapper = ({ title, children }: { title: string, children: React.ReactNode }) => {
  useDocumentTitle(title);
  return <>{children}</>;
};

const USER_STORAGE_KEY = 'sbg_user_profile';

const getCachedUser = (): User | null => {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as User;
    if (!parsed?.email || !parsed?.name || !parsed?.role) {
      localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

const cacheUser = (nextUser: User | null) => {
  if (typeof window === 'undefined') return;

  if (!nextUser) {
    localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [isInitializing, setIsInitializing] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !getCachedUser();
  });

  // Establish the socket on every load (even anonymous) so the build-version
  // handshake can detect and recover from a stale, cached frontend bundle.
  useEffect(() => {
    getSocket();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const userProfile = await apiRequest<User>('/api/auth/profile');

        if (!isMounted) return;
        setUser(userProfile);
        cacheUser(userProfile);
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to verify session token:', error);
        handleSessionFailed();
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSessionFailed = () => {
    setUser(null);
    cacheUser(null);
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    cacheUser(loggedInUser);

    reconnectSocket();

    // Join the appropriate socket room after login
    const socket = getSocket();

    if (!socket) return;

    if (loggedInUser.role === 'admin') {
      socket.emit(SOCKET_EVENTS.JOIN_ADMIN);
    } else if (loggedInUser.clubId) {
      socket.emit(SOCKET_EVENTS.JOIN_CLUB, loggedInUser.clubId);
    }
  };

  const handleLogout = async () => {
    setUser(null);
    cacheUser(null);
    reconnectSocket();

    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Global socket room joining
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    if (!socket) return;

    if (user.role === 'admin') {
      socket.emit(SOCKET_EVENTS.JOIN_ADMIN);
    } else if (user.clubId) {
      socket.emit(SOCKET_EVENTS.JOIN_CLUB, user.clubId);
    }
  }, [user]);

  if (isInitializing) {
    return <LoadingScreen />;
  }

  const ProtectedRouteRedirect = () => {
    const location = import('react-router-dom').then(m => m.useLocation);
    // Actually we can just use window.location
    const path = window.location.pathname;
    if (path.startsWith('/admin') || path.startsWith('/book') || path.startsWith('/my-bookings') || path.startsWith('/manage-events') || path.startsWith('/event-reports') || path.startsWith('/members')) {
      return <Navigate to={`/login?redirect=${encodeURIComponent(path + window.location.search)}`} replace />;
    }
    return <Navigate to="/" replace />;
  };

  if (!user) {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <React.Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/login" element={<PageTitleWrapper title="Login | SBG DAU"><Login onLogin={handleLogin} /></PageTitleWrapper>} />
              <Route element={<PublicLayout onGoToLogin={() => { window.location.href = '/login'; }} />}>
                <Route path="/" element={<PageTitleWrapper title="Home | SBG DAU"><LandingPage /></PageTitleWrapper>} />
                <Route path="/clubs-committees" element={<PageTitleWrapper title="Clubs & Committees | SBG DAU"><ClubsCommitteesPage /></PageTitleWrapper>} />
                <Route path="/about-sbg" element={<PageTitleWrapper title="About SBG | SBG DAU"><AboutSBG /></PageTitleWrapper>} />
              </Route>
              <Route path="*" element={<ProtectedRouteRedirect />} />
            </Routes>
          </React.Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    );
  }

  const AuthLoginRedirect = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const redirect = searchParams.get('redirect') || '/';
    return <Navigate to={redirect} replace />;
  };

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout user={user} onLogout={handleLogout}>
          <React.Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<PageTitleWrapper title="Dashboard | SBG DAU">{user.role === 'club' ? <ClubDashboard user={user} /> : <AdminDashboard />}</PageTitleWrapper>} />

              <Route path="/book" element={<PageTitleWrapper title="Book Venue | SBG DAU"><BookSlot currentUser={user} /></PageTitleWrapper>} />
              <Route path="/my-bookings" element={<PageTitleWrapper title="My Bookings | SBG DAU"><MyBookings currentUser={user} /></PageTitleWrapper>} />
              <Route path="/manage-events" element={<PageTitleWrapper title="Manage Events | SBG DAU"><ManageEvents currentUser={user} /></PageTitleWrapper>} />
              <Route path="/event-reports" element={<PageTitleWrapper title="Event Reports | SBG DAU"><EventReports /></PageTitleWrapper>} />
              <Route path="/members" element={<PageTitleWrapper title="Members | SBG DAU"><ClubMembers user={user} /></PageTitleWrapper>} />
              <Route path="/policy" element={<PageTitleWrapper title="Policy | SBG DAU"><PolicyPage /></PageTitleWrapper>} />

              <Route path="/admin/requests" element={<PageTitleWrapper title="Slot Requests | SBG DAU">{user.role === 'admin' ? <AdminRequests /> : <Navigate to="/" replace />}</PageTitleWrapper>} />
              <Route path="/admin/event-requests" element={<PageTitleWrapper title="Event Registrations | SBG DAU">{user.role === 'admin' ? <AdminEventRequests /> : <Navigate to="/" replace />}</PageTitleWrapper>} />
              <Route path="/admin/clubs" element={<PageTitleWrapper title="Clubs | SBG DAU">{user.role === 'admin' ? <AdminClubs /> : <Navigate to="/" replace />}</PageTitleWrapper>} />
              <Route path="/admin/venues" element={<PageTitleWrapper title="Venues | SBG DAU">{user.role === 'admin' ? <AdminVenues /> : <Navigate to="/" replace />}</PageTitleWrapper>} />
              <Route path="/admin/event-reports" element={<PageTitleWrapper title="All Reports | SBG DAU">{user.role === 'admin' ? <AdminEventReports /> : <Navigate to="/" replace />}</PageTitleWrapper>} />
              <Route path="/archives" element={<PageTitleWrapper title="Archives | SBG DAU"><Archives /></PageTitleWrapper>} />

              <Route path="/login" element={<AuthLoginRedirect />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </React.Suspense>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
