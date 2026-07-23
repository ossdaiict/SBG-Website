import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { ErrorBoundary } from './components/error-boundary';
import Layout from './pages/Layout';
import ClubDashboard from './lib/ClubDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminVenues from './pages/AdminVenues';
import BookSlot from './pages/BookSlot';
import AdminClubs from './pages/AdminClubs';
import AdminRequests from './pages/AdminRequests';

import PolicyPage from './pages/PolicyPage';
import MyBookings from './pages/MyBookings';
import ClubMembers from './pages/ClubMembers';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import AboutSBG from './pages/AboutSBG';
import ClubsCommitteesPage from './pages/ClubsCommitteesPage';
import ClubCommittee from './pages/ClubCommittee';
import ManageEvents from './pages/ManageEvents';
import EventReports from './pages/EventReports';
import AdminEventReports from './pages/AdminEventReports';
import Archives from './pages/Archives';
import { User } from './types';
import { apiRequest } from './lib/api';
import { getSocket, SOCKET_EVENTS } from './lib/socket';

const USER_STORAGE_KEY = 'sbg_user_profile';
const TOKEN_KEY = 'jwt_token'; 

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
  const [isInitializing, setIsInitializing] = useState(true);

  // Establish the socket on every load (even anonymous) so the build-version
  // handshake can detect and recover from a stale, cached frontend bundle.
  useEffect(() => {
    getSocket();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // 1. Check for standard JWT instead of Supabase session
      const token = localStorage.getItem(TOKEN_KEY);
      
      if (!token) {
        if (isMounted) {
          handleSessionFailed();
          setIsInitializing(false);
        }
        return;
      }

      try {
        // 2. Ask the backend to verify the token and return the profile
        const userProfile = await apiRequest<User>('/api/auth/profile', { auth: true });
        
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
    localStorage.removeItem(TOKEN_KEY);
  };

  const handleLogin = (loggedInUser: User, token?: string) => {
    // If your login component returns a token, save it for future requests
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    
    setUser(loggedInUser);
    cacheUser(loggedInUser);

    // Join the appropriate socket room after login
    const socket = getSocket();

    if (!socket) return;

    if (loggedInUser.role === 'admin') {
      socket.emit(SOCKET_EVENTS.JOIN_ADMIN);
    } else if (loggedInUser.email) {
      apiRequest<{ id: string }[]>('/api/clubs').then(clubs => {
        const match = clubs.find((c: any) => c.email === loggedInUser.email);
        if (match?.id) socket.emit(SOCKET_EVENTS.JOIN_CLUB, match.id);
      }).catch(() => { });
    }
  };

  const handleLogout = () => {
    setUser(null);
    cacheUser(null);
    localStorage.removeItem(TOKEN_KEY);
    
    // Optionally, alert the backend that the token should be invalidated if you build a logout route
    // apiRequest('/api/auth/logout', { method: 'POST', auth: true }).catch(() => {});
  };

  // Global socket room joining
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    if (!socket) return;

    if (user.role === 'admin') {
      socket.emit(SOCKET_EVENTS.JOIN_ADMIN);
    } else if (user.email) {
      apiRequest<{ id: string }[]>('/api/clubs').then(clubs => {
        const match = clubs.find((c: any) => c.email === user.email);
        if (match?.id) socket.emit(SOCKET_EVENTS.JOIN_CLUB, match.id);
      }).catch(() => { });
    }
  }, [user]);

  if (isInitializing) {
    return <div className="flex items-center justify-center min-h-dvh">Loading...</div>;
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Note: Ensure your Login component passes both the User object AND the JWT token to onLogin */}
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/clubs-committees" element={<ClubsCommitteesPage onGoToLogin={() => { window.location.href = '/login'; }} />} />
            <Route path="/about-sbg" element={<AboutSBG onGoToLogin={() => { window.location.href = '/login'; }} />} />
            <Route path="*" element={<LandingPage onGoToLogin={() => { window.location.href = '/login'; }} />} />
          </Routes>
          <Analytics />
        </BrowserRouter>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Layout user={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={user.role === 'club' ? <ClubDashboard user={user} /> : <AdminDashboard />} />

            <Route path="/book" element={<BookSlot currentUser={user} />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/manage-events" element={<ManageEvents currentUser={user} />} />
            <Route path="/event-reports" element={<EventReports />} />
            <Route path="/members" element={<ClubMembers user={user} />} />
            <Route path="/committee" element={user.role === 'club' ? <ClubCommittee user={user} /> : <Navigate to="/" replace />} />
            <Route path="/policy" element={<PolicyPage />} />

            <Route path="/admin/requests" element={<AdminRequests />} />

            <Route path="/admin/clubs" element={user.role === 'admin' ? <AdminClubs /> : <Navigate to="/" replace />} />
            <Route path="/admin/venues" element={user.role === 'admin' ? <AdminVenues /> : <Navigate to="/" replace />} />
            <Route path="/admin/event-reports" element={user.role === 'admin' ? <AdminEventReports /> : <Navigate to="/" replace />} />
            <Route path="/archives" element={<Archives />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <Analytics />
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;
