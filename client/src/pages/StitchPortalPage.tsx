import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  Gavel,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Menu,
  Moon,
  Search,
  Sparkles,
  Sun,
  Timer,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { getSocket, SOCKET_EVENTS } from '../lib/socket';
import { formatISTDate, formatISTTime, getISTNow } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';

interface PublicEvent {
  id: string;
  eventName: string;
  clubName: string;
  venueName: string;
  startTime: Date;
  endTime: Date;
  eventType?: string;
  status: string;
  description?: string;
}

interface ClubEntity {
  id: string;
  name: string;
  email: string;
  group_category?: string;
  description?: string;
  key_activities?: string;
  organization_type: string;
  linkedin_url?: string;
  instagram_url?: string;
  website_url?: string;
  logo_url?: string;
}

interface CommitteeMember {
  id: string;
  club_id: string;
  club_name: string;
  full_name: string;
  designation: string;
  phone?: string | null;
  email?: string | null;
}

interface LandingPageProps {
  onGoToLogin?: () => void;
}

interface SectionJunctionProps {
  accentColor?: 'gold' | 'emerald' | 'crimson';
  label?: string;
  prefersReducedMotion?: boolean | null;
}

const SectionJunction: React.FC<SectionJunctionProps> = ({
  accentColor = 'gold',
  label,
  prefersReducedMotion = false,
}) => {
  const junctionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: junctionRef,
    offset: ['start end', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

  // When junction crosses center of viewport (~0.5), cloud expands to FULL WIDTH (100%)
  const cloudWidth = useTransform(
    smoothProgress,
    [0.15, 0.45, 0.5, 0.55, 0.85],
    [
      prefersReducedMotion ? '100%' : '35%',
      prefersReducedMotion ? '100%' : '90%',
      '100%',
      prefersReducedMotion ? '100%' : '90%',
      prefersReducedMotion ? '100%' : '35%',
    ]
  );
  const cloudOpacity = useTransform(
    smoothProgress,
    [0.1, 0.4, 0.5, 0.6, 0.9],
    [0.08, 0.85, 1, 0.85, 0.08]
  );
  const cloudScaleY = useTransform(
    smoothProgress,
    [0.2, 0.5, 0.8],
    [prefersReducedMotion ? 1 : 0.7, prefersReducedMotion ? 1 : 1.35, prefersReducedMotion ? 1 : 0.7]
  );
  const laserLineWidth = useTransform(
    smoothProgress,
    [0.15, 0.5, 0.85],
    [prefersReducedMotion ? '100%' : '45%', '100%', prefersReducedMotion ? '100%' : '45%']
  );

  const themeConfig = {
    gold: {
      ambientCloud: 'from-transparent via-[#d4af37]/35 to-transparent dark:via-[#f59e0b]/30',
      coreCloud: 'from-transparent via-[#fff1a8]/55 dark:via-[#fde047]/45 to-transparent',
      line: 'from-transparent via-[#d4af37] to-transparent',
      lineCore: 'via-[#fff9c4]',
    },
    emerald: {
      ambientCloud: 'from-transparent via-[#52b788]/35 to-transparent dark:via-[#10b981]/30',
      coreCloud: 'from-transparent via-[#a7f3d0]/55 dark:via-[#6ee7b7]/45 to-transparent',
      line: 'from-transparent via-[#52b788] to-transparent',
      lineCore: 'via-[#d1fae5]',
    },
    crimson: {
      ambientCloud: 'from-[#731116]/25 via-[#d4af37]/35 to-[#731116]/25',
      coreCloud: 'from-transparent via-[#fde047]/50 dark:via-[#fbbf24]/40 to-transparent',
      line: 'from-transparent via-[#d4af37] to-transparent',
      lineCore: 'via-[#fff9c4]',
    },
  }[accentColor];

  return (
    <div
      ref={junctionRef}
      className="relative w-full flex flex-col justify-center items-center py-10 sm:py-16 pointer-events-none overflow-visible z-20"
    >
      {/* ── EXPANDING FULL-WIDTH BLURRY CLOUD NEBULA AS LINE REACHES JUNCTION ── */}
      <motion.div
        style={{
          width: cloudWidth,
          opacity: cloudOpacity,
          scaleY: cloudScaleY,
        }}
        className="relative w-full flex items-center justify-center transition-all duration-150"
      >
        {/* Layer 1: Wide Deep Atmospheric Fog Cloud (Heavily Blurred blur-3xl) */}
        <div
          className={`absolute inset-x-0 -top-20 sm:-top-28 h-40 sm:h-56 w-full bg-gradient-to-r ${themeConfig.ambientCloud} blur-3xl rounded-[100%] pointer-events-none`}
        />

        {/* Layer 2: Mid-Range Luminous Cloud Bank (blur-2xl) */}
        <div
          className={`absolute inset-x-0 -top-10 sm:-top-16 h-24 sm:h-36 w-full bg-gradient-to-r ${themeConfig.coreCloud} blur-2xl rounded-full pointer-events-none`}
        />

        {/* Layer 3: Soft Depth Contrast Shadow Underneath the Cloud */}
        <div className="absolute inset-x-0 h-16 -top-8 bg-gradient-to-r from-transparent via-black/15 dark:via-black/50 to-transparent blur-xl pointer-events-none" />

        {/* Layer 4: Full-Width Ethereal Connecting Laser Seam */}
        <motion.div
          style={{ width: laserLineWidth, opacity: cloudOpacity }}
          className={`h-[2px] w-full bg-gradient-to-r ${themeConfig.line} blur-[0.5px] relative z-10`}
        />
        <motion.div
          style={{ width: laserLineWidth, opacity: cloudOpacity }}
          className={`absolute h-[1.5px] w-full bg-gradient-to-r ${themeConfig.line} ${themeConfig.lineCore} relative z-10`}
        />
      </motion.div>

      {label && (
        <motion.span
          style={{ opacity: cloudOpacity }}
          className="mt-4 text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase text-[#755a21] dark:text-[#d4af37] select-none"
        >
          {label}
        </motion.span>
      )}
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onGoToLogin }) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  // ── THEME STATE (Bright Luxury Light vs Obsidian Dark Mode) ──────────
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return (
      document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // ── TACTILE KINEMATICS DEMO STATE ────────────────────────────────────
  const [kinematicState, setKinematicState] = useState<'floating' | 'pressed'>('floating');

  // ── SECTION REFS FOR SCROLL & PARALLAX TRACKING ──────────────────────
  const mainRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const calendarRef = useRef<HTMLElement>(null);
  const clubsRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement>(null);
  const calloutRef = useRef<HTMLElement>(null);

  // ── VIEWPORT HEIGHT FOR 50VH CONNECTING LINE TRACKING ─────────────────
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── GLOBAL SMOOTH SCROLL PROGRESSION ─────────────────────────────────
  const { scrollY, scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    restDelta: 0.001,
  });

  // Continuous vertical connecting line height
  const bgFilamentHeight = useTransform(smoothProgress, [0, 1], ['0%', '100%']);

  // Background deep ambient nebula parallax (+28-30% intensity)
  const bgNebulaIvyY = useTransform(
    smoothProgress,
    [0, 1],
    [0, prefersReducedMotion ? 0 : 750]
  );
  const bgNebulaGoldY = useTransform(
    smoothProgress,
    [0, 1],
    [0, prefersReducedMotion ? 0 : -540]
  );
  const bgWatermarkY = useTransform(
    smoothProgress,
    [0, 1],
    [0, prefersReducedMotion ? 0 : 340]
  );

  // ── HERO ELEMENT-SPECIFIC PARALLAX ───────────────────────────────────
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const heroCrestY = useTransform(
    heroProgress,
    [0, 1],
    [0, prefersReducedMotion ? 0 : -130]
  );
  const heroCrestOpacity = useTransform(
    heroProgress,
    [0, 0.75],
    [1, prefersReducedMotion ? 1 : 0.15]
  );
  const heroHeadlineY = useTransform(
    heroProgress,
    [0, 1],
    [0, prefersReducedMotion ? 0 : -98]
  );
  const heroHeadlineScale = useTransform(
    heroProgress,
    [0, 1],
    [1, prefersReducedMotion ? 1 : 0.93]
  );
  const heroHeadlineOpacity = useTransform(
    heroProgress,
    [0, 0.8],
    [1, prefersReducedMotion ? 1 : 0.2]
  );
  const heroDockY = useTransform(
    heroProgress,
    [0, 1],
    [0, prefersReducedMotion ? 0 : -52]
  );
  const heroTelemetryY = useTransform(
    heroProgress,
    [0, 1],
    [0, prefersReducedMotion ? 0 : 65]
  );
  const heroTelemetryScale = useTransform(
    heroProgress,
    [0.4, 1],
    [1, prefersReducedMotion ? 1 : 0.94]
  );
  const heroTelemetryOpacity = useTransform(
    heroProgress,
    [0.55, 1],
    [1, prefersReducedMotion ? 1 : 0.4]
  );

  // ── CALENDAR SECTION PARALLAX ────────────────────────────────────────
  const { scrollYProgress: calendarProgress } = useScroll({
    target: calendarRef,
    offset: ['start end', 'end start'],
  });

  const calendarHeaderY = useTransform(
    calendarProgress,
    [0, 0.32],
    [prefersReducedMotion ? 0 : 90, 0]
  );
  const calendarHeaderOpacity = useTransform(
    calendarProgress,
    [0, 0.25],
    [prefersReducedMotion ? 1 : 0.08, 1]
  );
  const calendarCardY = useTransform(
    calendarProgress,
    [0.05, 0.35],
    [prefersReducedMotion ? 0 : 110, 0]
  );
  const calendarCardScale = useTransform(
    calendarProgress,
    [0.05, 0.35],
    [prefersReducedMotion ? 1 : 0.93, 1]
  );
  const calendarCardOpacity = useTransform(
    calendarProgress,
    [0.04, 0.3],
    [prefersReducedMotion ? 1 : 0.2, 1]
  );
  const calendarExitY = useTransform(
    calendarProgress,
    [0.72, 1],
    [0, prefersReducedMotion ? 0 : -60]
  );
  const calendarExitScale = useTransform(
    calendarProgress,
    [0.72, 1],
    [1, prefersReducedMotion ? 1 : 0.95]
  );

  // ── CLUBS SECTION PARALLAX (Multi-Column Stagger) ─────────────────────
  const { scrollYProgress: clubsProgress } = useScroll({
    target: clubsRef,
    offset: ['start end', 'end start'],
  });

  const clubsHeaderY = useTransform(
    clubsProgress,
    [0, 0.28],
    [prefersReducedMotion ? 0 : 78, 0]
  );
  const clubsHeaderOpacity = useTransform(
    clubsProgress,
    [0, 0.22],
    [prefersReducedMotion ? 1 : 0.1, 1]
  );
  const clubsFilterY = useTransform(
    clubsProgress,
    [0.05, 0.3],
    [prefersReducedMotion ? 0 : 65, 0]
  );
  const clubsCol1Y = useTransform(
    clubsProgress,
    [0.1, 0.42],
    [prefersReducedMotion ? 0 : 90, 0]
  );
  const clubsCol2Y = useTransform(
    clubsProgress,
    [0.15, 0.47],
    [prefersReducedMotion ? 0 : 136, 0]
  );
  const clubsCol3Y = useTransform(
    clubsProgress,
    [0.2, 0.52],
    [prefersReducedMotion ? 0 : 182, 0]
  );
  const clubsGridOpacity = useTransform(
    clubsProgress,
    [0.1, 0.38],
    [prefersReducedMotion ? 1 : 0.15, 1]
  );

  // ── ABOUT SECTION PARALLAX ───────────────────────────────────────────
  const { scrollYProgress: aboutProgress } = useScroll({
    target: aboutRef,
    offset: ['start end', 'end start'],
  });

  const aboutHeaderY = useTransform(
    aboutProgress,
    [0, 0.25],
    [prefersReducedMotion ? 0 : 72, 0]
  );
  const aboutHeaderOpacity = useTransform(
    aboutProgress,
    [0, 0.2],
    [prefersReducedMotion ? 1 : 0.15, 1]
  );
  const statCard1Y = useTransform(
    aboutProgress,
    [0.08, 0.32],
    [prefersReducedMotion ? 0 : 58, 0]
  );
  const statCard2Y = useTransform(
    aboutProgress,
    [0.12, 0.36],
    [prefersReducedMotion ? 0 : 90, 0]
  );
  const statCard3Y = useTransform(
    aboutProgress,
    [0.16, 0.4],
    [prefersReducedMotion ? 0 : 124, 0]
  );
  const statCard4Y = useTransform(
    aboutProgress,
    [0.2, 0.44],
    [prefersReducedMotion ? 0 : 156, 0]
  );
  const visionY = useTransform(
    aboutProgress,
    [0.25, 0.52],
    [prefersReducedMotion ? 0 : 90, 0]
  );
  const censusY = useTransform(
    aboutProgress,
    [0.28, 0.56],
    [prefersReducedMotion ? 0 : 116, 0]
  );
  const hierarchyScale = useTransform(
    aboutProgress,
    [0.45, 0.75],
    [prefersReducedMotion ? 1 : 0.93, 1]
  );
  const hierarchyY = useTransform(
    aboutProgress,
    [0.45, 0.75],
    [prefersReducedMotion ? 0 : 78, 0]
  );
  const hierarchyLineScaleY = useTransform(
    aboutProgress,
    [0.5, 0.75],
    [prefersReducedMotion ? 1 : 0, 1]
  );

  // ── CALLOUT SECTION PARALLAX (+30% intensity) ─────────────────────────
  const { scrollYProgress: calloutProgress } = useScroll({
    target: calloutRef,
    offset: ['start end', 'end start'],
  });
  const calloutCardY = useTransform(
    calloutProgress,
    [0, 0.4],
    [prefersReducedMotion ? 0 : 65, 0]
  );
  const calloutCardScale = useTransform(
    calloutProgress,
    [0, 0.4],
    [prefersReducedMotion ? 1 : 0.94, 1]
  );

  // ── SUBTLE INTERACTIVE DESKTOP MOUSE 3D TILT ─────────────────────────
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springTiltX = useSpring(mouseY, { stiffness: 60, damping: 20 });
  const springTiltY = useSpring(mouseX, { stiffness: 60, damping: 20 });

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || typeof window === 'undefined' || window.innerWidth < 1024)
      return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(xPct * 8); // Subtle ±4 deg (+33%)
    mouseY.set(-yPct * 8);
  };

  const handleHeroMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // ── ACTIVE CHAPTER SCROLL SPY STATE ──────────────────────────────────
  const [activeChapter, setActiveChapter] = useState<'genesis' | 'calendar' | 'clubs' | 'about'>('genesis');

  useEffect(() => {
    const handleScrollSpy = () => {
      const scrollPos = window.scrollY + 300;
      const calOffset = calendarRef.current?.offsetTop || 800;
      const clubsOffset = clubsRef.current?.offsetTop || 1700;
      const aboutOffset = aboutRef.current?.offsetTop || 2700;

      if (scrollPos >= aboutOffset) {
        setActiveChapter('about');
      } else if (scrollPos >= clubsOffset) {
        setActiveChapter('clubs');
      } else if (scrollPos >= calOffset) {
        setActiveChapter('calendar');
      } else {
        setActiveChapter('genesis');
      }
    };

    window.addEventListener('scroll', handleScrollSpy, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollSpy);
  }, []);

  // ── BACKEND DATA STATES ──────────────────────────────────────────────
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [clubs, setClubs] = useState<ClubEntity[]>([]);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({
    clubs: 24,
    committees: 8,
    organisations: 2,
    members: 308,
  });
  const [loading, setLoading] = useState(true);

  // ── CINEMATIC INITIAL LOADER & BACKGROUND WATERMARK TRANSITION ───────
  const [loaderPhase, setLoaderPhase] = useState<
    'loading' | 'releasing' | 'transitioning' | 'complete'
  >('loading');
  // Progress is driven by a MotionValue (no React re-render per frame)
  const progressMV = useMotionValue(0);
  const progressWidth = useTransform(progressMV, (v) => `${v}%`);
  const progressText = useTransform(progressMV, (v) => `${Math.round(v)}%`);
  const [progressDone, setProgressDone] = useState(false);
  const [landingTarget, setLandingTarget] = useState<{
    dx: number;
    dy: number;
    scale: number;
  }>({ dx: 0, dy: -60, scale: 2.6 });
  const dataLoadedRef = useRef(false);
  const logoReadyRef = useRef(false);
  const loaderStartRef = useRef<number>(
    typeof performance !== 'undefined' ? performance.now() : 0
  );
  const reducedMotionRef = useRef<boolean>(!!prefersReducedMotion);
  reducedMotionRef.current = !!prefersReducedMotion;
  const loaderLogoRef = useRef<HTMLDivElement>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);

  // ── CALENDAR STATE ───────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = getISTNow();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => getISTNow());
  const [selectedEventModal, setSelectedEventModal] = useState<PublicEvent | null>(null);

  // ── CLUBS SECTION STATE ──────────────────────────────────────────────
  const [clubTab, setClubTab] = useState<'club' | 'committee' | 'organisation'>('club');
  const [clubSearch, setClubSearch] = useState('');
  const [selectedClubModal, setSelectedClubModal] = useState<ClubEntity | null>(null);

  // ── MOBILE MENU STATE ────────────────────────────────────────────────
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── PETITION DIALOG STATE ────────────────────────────────────────────
  const [isPetitionOpen, setIsPetitionOpen] = useState(false);
  const [petitionSubmitted, setPetitionSubmitted] = useState(false);

  // ── FETCH BACKEND DATA ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventsData, clubsData, membersData, statsData] = await Promise.all([
        apiRequest<any[]>('/api/events/public').catch(() => []),
        apiRequest<ClubEntity[]>('/api/clubs').catch(() => []),
        apiRequest<CommitteeMember[]>('/api/club-members/public').catch(() => []),
        apiRequest<Record<string, number>>('/api/clubs/stats').catch(() => ({})),
      ]);

      // Parse public events
      if (Array.isArray(eventsData) && eventsData.length > 0) {
        const parsed: PublicEvent[] = eventsData.map((e) => ({
          id: e.id,
          eventName: e.name || 'Campus Event',
          clubName: e.clubs?.name || 'DAU Entity',
          venueName: e.venue || 'Campus Auditorium',
          startTime: new Date(e.date),
          endTime: new Date(e.end_date || e.date),
          eventType: e.event_type || 'open_all',
          status: 'approved',
          description: e.description || '',
        }));
        setEvents(parsed);
      } else {
        // Fallback realistic dataset matching collegiate schedule
        setEvents([
          {
            id: 'e1',
            eventName: 'Concours Annual Sports Conclave',
            clubName: 'Sports Club',
            venueName: 'Main Aud & Sports Complex',
            startTime: new Date(2026, 10, 1, 10, 0),
            endTime: new Date(2026, 10, 1, 18, 0),
            eventType: 'co_curricular',
            status: 'approved',
          },
          {
            id: 'e2',
            eventName: 'ESP Interactive Technical Session',
            clubName: 'Electronics Hobby Club',
            venueName: 'Room 204, Academic Block',
            startTime: new Date(2026, 10, 2, 17, 30),
            endTime: new Date(2026, 10, 2, 20, 0),
            eventType: 'open_all',
            status: 'approved',
          },
          {
            id: 'e3',
            eventName: 'Rangoli Cultural Showcase',
            clubName: 'Cultural Committee',
            venueName: 'Student Activity Center',
            startTime: new Date(2026, 10, 3, 14, 0),
            endTime: new Date(2026, 10, 3, 17, 0),
            eventType: 'open_all',
            status: 'approved',
          },
          {
            id: 'e4',
            eventName: 'Intra Parliamentary Debate (AP) Day 1',
            clubName: 'Debate Society',
            venueName: 'Moot Court Hall',
            startTime: new Date(2026, 10, 4, 16, 0),
            endTime: new Date(2026, 10, 4, 21, 0),
            eventType: 'co_curricular',
            status: 'approved',
          },
          {
            id: 'e5',
            eventName: 'Intra Parliamentary Debate (AP) Day 2',
            clubName: 'Debate Society',
            venueName: 'Moot Court Hall',
            startTime: new Date(2026, 10, 5, 18, 0),
            endTime: new Date(2026, 10, 5, 22, 0),
            eventType: 'co_curricular',
            status: 'approved',
            description:
              'Semi-Finals & Chancellery Cup Championship motion sessions on campus ethics and student parity.',
          },
          {
            id: 'e6',
            eventName: 'Engine Clash AI Tactical Sim',
            clubName: 'Chess Club',
            venueName: 'CEP Lab 1',
            startTime: new Date(2026, 10, 3, 17, 0),
            endTime: new Date(2026, 10, 3, 19, 30),
            eventType: 'open_all',
            status: 'approved',
          },
          {
            id: 'e7',
            eventName: 'Film Screening & Critique',
            clubName: 'Film Club',
            venueName: 'LT 1',
            startTime: new Date(2026, 10, 4, 18, 30),
            endTime: new Date(2026, 10, 4, 21, 0),
            eventType: 'open_all',
            status: 'approved',
          },
        ]);
      }

      // Parse clubs
      if (Array.isArray(clubsData) && clubsData.length > 0) {
        setClubs(clubsData);
      } else {
        setClubs([
          {
            id: 'c1',
            name: 'AI Club',
            email: 'aiclub@dau.edu',
            organization_type: 'club',
            group_category: 'Technical',
            description:
              'Explores artificial intelligence, machine learning architectures, and collegiate autonomous systems research.',
          },
          {
            id: 'c2',
            name: 'Business Club',
            email: 'bizclub@dau.edu',
            organization_type: 'club',
            group_category: 'Professional',
            description:
              'Corporate strategy, venture pitch leagues, investment portfolios, and global macroeconomic forums.',
          },
          {
            id: 'c3',
            name: 'Chess Club',
            email: 'chess@dau.edu',
            organization_type: 'club',
            group_category: 'Recreation',
            description:
              'FIDE-rated tournaments, Grandmaster simultaneous exhibitions, and engine clash tactical analyses.',
          },
          {
            id: 'c4',
            name: 'Cubing Club',
            email: 'cubing@dau.edu',
            organization_type: 'club',
            group_category: 'Competitive',
            description:
              'Speedcubing algorithms, blindfolded resolution workshops, and WCA intercollegiate sprint championships.',
          },
          {
            id: 'c5',
            name: 'Cyber Info & Network Security',
            email: 'cybersec@dau.edu',
            organization_type: 'club',
            group_category: 'Technical',
            description:
              'Capture The Flag (CTF) offensive defence drills, cryptanalysis, zero-day research, and network protocol defense.',
          },
          {
            id: 'c6',
            name: 'DADC (Design & Digital Creation)',
            email: 'dadc@dau.edu',
            organization_type: 'club',
            group_category: 'Creative Arts',
            description:
              'Design, Art, and Digital Creation syndicate leading visual media direction across University exhibitions.',
          },
          {
            id: 'c7',
            name: 'DAU Theatres Group',
            email: 'theatre@dau.edu',
            organization_type: 'club',
            group_category: 'Performing Arts',
            description:
              'Dramatics production house organizing classic Shakespearean plays, street nukkad nataks, and monologue galas.',
          },
          {
            id: 'c8',
            name: 'Electronics Hobby Club',
            email: 'ehc@dau.edu',
            organization_type: 'club',
            group_category: 'Maker & IoT',
            description:
              'Embedded systems prototyping, PCB lithography workshops, and drone telemetry construction projects.',
          },
          {
            id: 'c9',
            name: 'Film Club',
            email: 'film@dau.edu',
            organization_type: 'club',
            group_category: 'Cinema',
            description:
              'Weekly art-house screenings, director retrospects, short film funding competitions, and scriptwriting circles.',
          },
          {
            id: 'cm1',
            name: 'Academic Affairs Committee',
            email: 'academic@dau.edu',
            organization_type: 'committee',
            group_category: 'Governance',
            description:
              'Liaison with university chancellery regarding curriculum feedback, grading standards, and academic tribunal inquiries.',
          },
          {
            id: 'cm2',
            name: 'Disciplinary & Ethics Council',
            email: 'ethics@dau.edu',
            organization_type: 'committee',
            group_category: 'Oversight',
            description:
              'Investigates campus grievances, maintains student honor codes, and adjudicates peer disputes.',
          },
          {
            id: 'og1',
            name: 'Synapse Fest Secretariat',
            email: 'synapse@dau.edu',
            organization_type: 'organisation',
            group_category: 'Fest Secretariat',
            description:
              'The executive committee overseeing DAU annual national cultural and tech symposium.',
          },
        ]);
      }

      if (Array.isArray(membersData)) setMembers(membersData);

      const statsObj =
        statsData && typeof statsData === 'object'
          ? (statsData as Record<string, number>)
          : {};
      setStats({
        clubs: statsObj['clubs'] || (clubsData?.length || 24),
        committees: statsObj['committees'] || 8,
        organisations: statsObj['organisations'] || 2,
        members: statsObj['members'] || 308,
      });
    } catch (err) {
      console.error('Failed to load portal data:', err);
    } finally {
      setLoading(false);
      dataLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── LOADER READINESS: logo decoded + data fetched (with safety timeouts) ──
  useEffect(() => {
    let cancelled = false;
    const markLogoReady = () => {
      if (!cancelled) logoReadyRef.current = true;
    };
    const img = new Image();
    img.src = '/sbg_logo.png';
    const decodePromise =
      typeof img.decode === 'function'
        ? img.decode()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
    decodePromise.then(markLogoReady, markLogoReady);
    const logoFallback = setTimeout(markLogoReady, 4000);
    const dataFallback = setTimeout(() => {
      dataLoadedRef.current = true;
    }, 7000);
    return () => {
      cancelled = true;
      clearTimeout(logoFallback);
      clearTimeout(dataFallback);
    };
  }, []);

  // Always start the intro at the top of the page on refresh so the logo
  // lands on the Hero watermark (unless a #hash link was requested).
  useLayoutEffect(() => {
    const prev = window.history.scrollRestoration;
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    if (!window.location.hash) window.scrollTo(0, 0);
    return () => {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = prev || 'auto';
      }
    };
  }, []);

  // Lock page scrolling while the intro animation runs
  useEffect(() => {
    if (loaderPhase === 'complete') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [loaderPhase]);

  // Smooth rAF-driven loading bar: guaranteed minimum on-screen time,
  // holds at 90% until the logo is decoded AND the data has loaded.
  useEffect(() => {
    if (progressDone) return;
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - loaderStartRef.current;
      const minMs = reducedMotionRef.current ? 400 : 1500;
      const ready = dataLoadedRef.current && logoReadyRef.current;
      const timeTarget = Math.min(100, (elapsed / minMs) * 100);
      const target = ready ? timeTarget : Math.min(timeTarget, 90);
      const prev = progressMV.get();
      let next = Math.max(prev, prev + (target - prev) * 0.1);
      if (ready && elapsed >= minMs && 100 - next < 0.6) next = 100;
      progressMV.set(next);
      if (next >= 100) {
        setProgressDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progressDone, progressMV]);

  // Phase 1 -> 2: Measure exact Hero watermark landing rect when loading hits 100%
  useEffect(() => {
    if (!progressDone || loaderPhase !== 'loading') return;
    const reduced = reducedMotionRef.current;

    const holdTimer = setTimeout(() => {
      const startEl = loaderLogoRef.current;
      const targetEl = watermarkRef.current;

      if (startEl && targetEl && !reduced) {
        const startRect = startEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const startCX = startRect.left + startRect.width / 2;
        const startCY = startRect.top + startRect.height / 2;
        const targetCX = targetRect.left + targetRect.width / 2;
        const targetCY = targetRect.top + targetRect.height / 2;

        // Only fly to Hero watermark when Hero is in/near the viewport;
        // fallback cleanly on deep mid-page browser scroll restoration.
        const isHeroNearViewport =
          targetRect.bottom > -120 && targetRect.top < window.innerHeight + 200;
        const dx = isHeroNearViewport ? targetCX - startCX : 0;
        const dy = isHeroNearViewport ? targetCY - startCY : -40;
        const targetScale =
          startRect.width > 0 ? targetRect.width / startRect.width : 2.6;

        setLandingTarget({ dx, dy, scale: targetScale });
      }

      setLoaderPhase('releasing');
    }, reduced ? 80 : 200);

    return () => clearTimeout(holdTimer);
  }, [progressDone, loaderPhase]);

  // Phase 2 -> 3: Gentle release anticipation -> full multi-frame flight into big watermark
  useEffect(() => {
    if (loaderPhase !== 'releasing') return;
    const releaseTimer = setTimeout(() => {
      setLoaderPhase('transitioning');
    }, reducedMotionRef.current ? 40 : 220);

    return () => clearTimeout(releaseTimer);
  }, [loaderPhase]);

  // Phase 3 -> 4: Safety fallback completion guard alongside motion onAnimationComplete
  useEffect(() => {
    if (loaderPhase !== 'transitioning') return;
    const safetyTimer = setTimeout(() => {
      setLoaderPhase('complete');
    }, reducedMotionRef.current ? 350 : 1750);

    return () => clearTimeout(safetyTimer);
  }, [loaderPhase]);

  // Realtime socket integration
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleRefresh = () => {
      loadData();
    };
    socket.on(SOCKET_EVENTS.EVENTS_UPDATED, handleRefresh);
    socket.on(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleRefresh);
    socket.on(SOCKET_EVENTS.BOOKING_NEW, handleRefresh);

    return () => {
      socket.off(SOCKET_EVENTS.EVENTS_UPDATED, handleRefresh);
      socket.off(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleRefresh);
      socket.off(SOCKET_EVENTS.BOOKING_NEW, handleRefresh);
    };
  }, [loadData]);

  // ── CALENDAR COMPUTATIONS ────────────────────────────────────────────
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth]);

  const monthLabel = useMemo(() => {
    const m = currentMonth.toLocaleString('default', { month: 'long' });
    const y = currentMonth.getFullYear();
    return { month: m, year: y };
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const now = getISTNow();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  // Events filtered for selected date
  const eventsForSelectedDate = useMemo(() => {
    return events.filter((e) => {
      const ed = new Date(e.startTime);
      return (
        ed.getFullYear() === selectedDate.getFullYear() &&
        ed.getMonth() === selectedDate.getMonth() &&
        ed.getDate() === selectedDate.getDate()
      );
    });
  }, [events, selectedDate]);

  // Featured Spotlight Event (Today or next upcoming)
  const featuredEvent = useMemo(() => {
    if (eventsForSelectedDate.length > 0) return eventsForSelectedDate[0];
    const now = getISTNow();
    const upcoming = events.find((e) => new Date(e.startTime) >= now);
    return upcoming || events[0] || null;
  }, [events, eventsForSelectedDate]);

  // ── FILTERED CLUBS ───────────────────────────────────────────────────
  const filteredClubs = useMemo(() => {
    return clubs.filter((c) => {
      const matchesTab = c.organization_type?.toLowerCase() === clubTab.toLowerCase();
      const q = clubSearch.toLowerCase().trim();
      if (!q) return matchesTab;
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.group_category && c.group_category.toLowerCase().includes(q));
      return matchesTab && matchesSearch;
    });
  }, [clubs, clubTab, clubSearch]);

  const handleSignInClick = () => {
    if (onGoToLogin) {
      onGoToLogin();
    } else {
      navigate('/login');
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9ff] dark:bg-[#060709] text-[#181c20] dark:text-[#f1f5f9] transition-colors duration-300 font-manrope selection:bg-[#fed892] selection:text-[#051b12] dark:selection:bg-[#d4af37]/30 dark:selection:text-[#f8fafc] overflow-x-hidden relative">

      {/* ── CINEMATIC INITIAL LOADER OVERLAY & PROGRESS BAR ─────────────── */}
      {loaderPhase !== 'complete' && (
        <motion.div
          key="initial-loader-overlay"
          initial={{ opacity: 1 }}
          animate={{
            opacity: loaderPhase === 'transitioning' ? 0 : 1,
          }}
          transition={{
            duration: prefersReducedMotion ? 0.25 : 0.95,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`fixed inset-0 z-[4] ${
            loaderPhase === 'loading' ? 'pointer-events-auto' : 'pointer-events-none'
          } flex flex-col items-center justify-center bg-[#f7f9ff] dark:bg-[#060709] overflow-hidden select-none`}
        >
          {/* Ambient Radial Theme Glow Aura */}
          <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#755a21]/10 via-[#d4af37]/15 to-[#1a3026]/10 dark:from-[#d4af37]/10 dark:via-[#f59e0b]/10 dark:to-[#52b788]/10 blur-[120px] pointer-events-none" />

          {/* Sleek Loading Bar Container (Positioned Underneath Centered Logo) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: loaderPhase === 'loading' ? 1 : 0,
              y: loaderPhase === 'loading' ? 0 : 14,
            }}
            transition={{
              delay: loaderPhase === 'loading' ? (prefersReducedMotion ? 0.05 : 0.3) : 0,
              duration: loaderPhase === 'loading' ? 0.45 : 0.28,
              ease: 'easeOut',
            }}
            className="absolute top-[calc(50%+80px)] sm:top-[calc(50%+100px)] md:top-[calc(50%+108px)] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 w-56 sm:w-64 pointer-events-none"
          >
            {/* Sleek Progress Bar Track */}
            <div className="w-full h-1 sm:h-1.5 rounded-full bg-[#051b12]/10 dark:bg-white/10 overflow-hidden relative shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-[#755a21] via-[#d4af37] to-[#10b981] dark:from-[#d4af37] dark:via-[#fde047] dark:to-[#52b788] rounded-full shadow-[0_0_8px_rgba(212,175,55,0.6)]"
                style={{ width: progressWidth }}
              />
            </div>

            {/* Minimalist Micro-Label & Percentage Counter */}
            <div className="w-full flex items-center justify-between text-[10px] font-bold tracking-[0.2em] uppercase text-[#727974] dark:text-[#94a3b8] px-0.5 select-none">
              <span>{progressDone ? 'Portal Ready' : 'Initializing...'}</span>
              <motion.span className="font-mono text-[#755a21] dark:text-[#d4af37]">
                {progressText}
              </motion.span>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── THE TRANSITIONING SBG LOGO (Small Loader -> Precision Flight into Big Watermark) ── */}
      {loaderPhase !== 'complete' && (
        <div className="fixed inset-0 z-[5] pointer-events-none flex items-center justify-center select-none overflow-hidden">
          <motion.div
            ref={loaderLogoRef}
            key="sbg-transitioning-logo"
            initial={{ opacity: 0, scale: 0.86, x: 0, y: 0 }}
            animate={
              loaderPhase === 'loading'
                ? { opacity: 1, scale: 1, x: 0, y: 0 }
                : loaderPhase === 'releasing'
                ? {
                    opacity: 0.94,
                    scale: prefersReducedMotion ? 1 : 0.94,
                    x: 0,
                    y: 0,
                  }
                : {
                    opacity: isDarkMode ? 0.038 : 0.06,
                    scale: prefersReducedMotion ? 1 : landingTarget.scale,
                    x: prefersReducedMotion ? 0 : landingTarget.dx,
                    y: prefersReducedMotion ? 0 : landingTarget.dy,
                  }
            }
            transition={
              loaderPhase === 'loading'
                ? {
                    opacity: { duration: prefersReducedMotion ? 0.2 : 0.55, ease: [0.16, 1, 0.3, 1] },
                    scale: { duration: prefersReducedMotion ? 0.2 : 0.55, ease: [0.16, 1, 0.3, 1] },
                  }
                : loaderPhase === 'releasing'
                ? {
                    duration: prefersReducedMotion ? 0.04 : 0.22,
                    ease: [0.4, 0, 0.2, 1],
                  }
                : {
                    x: { duration: prefersReducedMotion ? 0.25 : 1.55, ease: [0.16, 1, 0.3, 1] },
                    y: { duration: prefersReducedMotion ? 0.25 : 1.55, ease: [0.16, 1, 0.3, 1] },
                    scale: { duration: prefersReducedMotion ? 0.25 : 1.55, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: prefersReducedMotion ? 0.25 : 1.5, ease: [0.28, 0.05, 0.22, 1] },
                  }
            }
            onAnimationComplete={() => {
              if (loaderPhase === 'transitioning') {
                setLoaderPhase('complete');
              }
            }}
            className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 flex items-center justify-center will-change-transform"
          >
            <img
              src="/sbg_logo.png"
              alt="Student Body Government Logo"
              className="w-full h-full object-contain"
              width={400}
              height={430}
              loading="eager"
              decoding="sync"
            />
          </motion.div>
        </div>
      )}

      {/* ── MULTI-PLANAR CINEMATIC PARALLAX BACKGROUND ──────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
        {/* Ambient Ivy/Emerald Glow Nebula */}
        <motion.div
          style={{ y: bgNebulaIvyY }}
          className="absolute -top-36 left-1/4 w-[550px] h-[550px] bg-[#1a3026]/12 dark:bg-[#1a382b]/30 rounded-full blur-[140px] will-change-transform"
        />

        {/* Ambient Gold/Brass Glow Nebula */}
        <motion.div
          style={{ y: bgNebulaGoldY }}
          className="absolute top-[520px] -right-24 w-[500px] h-[500px] bg-[#b89758]/18 dark:bg-[#d4af37]/15 rounded-full blur-[150px] will-change-transform"
        />

        {/* Architectural Watermark Typography ("SBG DAU" in Bodoni Serif) */}
        <motion.div
          style={{ y: bgWatermarkY }}
          className="absolute top-[880px] -left-20 font-bodoni text-[20vw] font-bold text-[#051b12]/[0.02] dark:text-white/[0.015] tracking-tighter leading-none pointer-events-none uppercase whitespace-nowrap will-change-transform"
        >
          SBG DAU
        </motion.div>

        {/* ── CONTINUOUS VERTICAL CONNECTING LINE PARALLAX GUIDE BEAM ─────── */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[1px] sm:w-[1.5px] pointer-events-none z-10">
          {/* Subtle Full-Height Guide Track */}
          <div className="absolute inset-0 w-full bg-gradient-to-b from-transparent via-[#755a21]/15 dark:via-[#d4af37]/10 to-transparent border-l border-dashed border-[#755a21]/20 dark:border-[#d4af37]/15" />

          {/* Active Animated Traveling Line */}
          <motion.div
            style={{ height: prefersReducedMotion ? '100%' : bgFilamentHeight }}
            className="relative w-full bg-gradient-to-b from-[#755a21] via-[#c4973b] to-[#d4af37] dark:from-[#d4af37] dark:via-[#fde047] dark:to-[#52b788] opacity-90 shadow-[0_0_8px_rgba(212,175,55,0.6)] will-change-[height]"
          >
            {/* Ambient Line Glow Aura */}
            <div className="absolute inset-y-0 -left-[2px] w-[5px] blur-[2px] bg-gradient-to-b from-[#755a21]/60 via-[#d4af37]/80 to-[#f59e0b]/70 dark:from-[#d4af37]/80 dark:via-[#fde047] dark:to-[#52b788]" />
          </motion.div>
        </div>


      </div>

      {/* ── HOMEPAGE CONTENT WRAPPER (Smooth Fade-in Over Transitioning Watermark) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity:
            loaderPhase === 'loading' || loaderPhase === 'releasing' ? 0 : 1,
        }}
        transition={{
          duration: prefersReducedMotion ? 0.2 : 0.95,
          delay: prefersReducedMotion ? 0 : 0.35,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={`w-full relative z-10 ${
          loaderPhase === 'loading' || loaderPhase === 'releasing'
            ? 'pointer-events-none'
            : ''
        }`}
      >
      {/* ── CHAPTER SCROLL SPY / PROGRESS DOCK (Desktop Luxury Rail) ──── */}
      <aside
        aria-label="Chapter scroll navigation"
        className="hidden xl:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col items-end gap-3 pointer-events-auto"
      >
        <div className="p-2 rounded-full neu-concave border border-white/50 dark:border-white/5 backdrop-blur-md flex flex-col gap-2">
          {[
            { id: 'top', key: 'genesis', label: '01 Genesis' },
            { id: 'calendar', key: 'calendar', label: '02 Schedule' },
            { id: 'clubs', key: 'clubs', label: '03 Entities' },
            { id: 'about', key: 'about', label: '04 Governance' },
          ].map((ch) => {
            const isActive = activeChapter === ch.key;
            return (
              <button
                key={ch.id}
                onClick={() => scrollToSection(ch.id)}
                className={`group relative flex items-center justify-end p-2 rounded-full transition-all ${
                  isActive
                    ? 'neu-pressed text-[#755a21] dark:text-[#d4af37]'
                    : 'text-[#727974] hover:text-[#051b12] dark:hover:text-white'
                }`}
                title={ch.label}
              >
                {/* Floating Tooltip Pill */}
                <span className="absolute right-full mr-3 px-2.5 py-1 rounded-full neu-convex text-[10px] font-bold tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap bg-[#f7f9ff] dark:bg-[#0e1015]">
                  {ch.label}
                </span>
                <span
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    isActive
                      ? 'bg-[#755a21] dark:bg-[#d4af37] scale-125 shadow-[0_0_8px_#d4af37]'
                      : 'bg-[#c2c8c3] dark:bg-[#475569] group-hover:scale-110'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </aside>
      {/* ── LUXURY FLOATING NEUMORPHIC HEADER ──────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 py-3 px-4 sm:px-6 lg:px-8 pointer-events-none">
        <div className="max-w-[1440px] mx-auto">
          <div className="h-16 sm:h-20 px-4 sm:px-8 bg-[#ffffff]/85 dark:bg-[#0e1015]/85 backdrop-blur-xl border border-white/60 dark:border-white/[0.06] rounded-full shadow-[8px_8px_20px_#c4c9d4,-8px_-8px_20px_#ffffff] dark:shadow-[8px_8px_24px_rgba(0,0,0,0.85),-4px_-4px_16px_rgba(255,255,255,0.03)] flex items-center justify-between pointer-events-auto transition-all duration-300">
            {/* Left: Brand Monogram & Seal */}
            <a href="#top" className="flex items-center gap-3 group">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full neu-concave flex items-center justify-center p-1.5 overflow-hidden transition-transform group-hover:scale-105 shadow-inner">
                <img
                  src="/sbg_logo_optimized.png"
                  alt="SBG DAU Logo"
                  className="w-full h-full object-contain rounded-full"
                  width={44}
                  height={44}
                  loading="eager"
                  decoding="sync"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bodoni font-bold text-base sm:text-lg text-[#051b12] dark:text-[#f5f5f7] tracking-tight leading-tight">
                  SBG DAU
                </span>
                <span className="text-[10px] sm:text-xs text-[#755a21] dark:text-[#d4af37] font-semibold uppercase tracking-widest">
                  Est. 1998
                </span>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center p-1.5 neu-concave rounded-full gap-1">
              <a
                href="#top"
                className={`px-4 py-1.5 rounded-full font-semibold text-xs tracking-wide transition-all ${
                  activeChapter === 'genesis'
                    ? 'neu-convex text-[#755a21] dark:text-[#d4af37]'
                    : 'text-[#424844] dark:text-[#94a3b8] hover:text-[#051b12] dark:hover:text-[#f8fafc]'
                }`}
              >
                Home
              </a>
              <a
                href="#calendar"
                className={`px-4 py-1.5 rounded-full font-semibold text-xs tracking-wide transition-all ${
                  activeChapter === 'calendar'
                    ? 'neu-convex text-[#755a21] dark:text-[#d4af37]'
                    : 'text-[#424844] dark:text-[#94a3b8] hover:text-[#051b12] dark:hover:text-[#f8fafc]'
                }`}
              >
                Calendar
              </a>
              <a
                href="#clubs"
                className={`px-4 py-1.5 rounded-full font-semibold text-xs tracking-wide transition-all ${
                  activeChapter === 'clubs'
                    ? 'neu-convex text-[#755a21] dark:text-[#d4af37]'
                    : 'text-[#424844] dark:text-[#94a3b8] hover:text-[#051b12] dark:hover:text-[#f8fafc]'
                }`}
              >
                Clubs & Committees
              </a>
              <a
                href="#about"
                className={`px-4 py-1.5 rounded-full font-semibold text-xs tracking-wide transition-all ${
                  activeChapter === 'about'
                    ? 'neu-convex text-[#755a21] dark:text-[#d4af37]'
                    : 'text-[#424844] dark:text-[#94a3b8] hover:text-[#051b12] dark:hover:text-[#f8fafc]'
                }`}
              >
                About SBG
              </a>
            </nav>

            {/* Right: Theme Toggle & Sign In */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Light/Dark Toggle Button */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle Light or Dark Mode"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full neu-convex flex items-center justify-center text-[#727974] dark:text-[#94a3b8] hover:text-[#051b12] dark:hover:text-[#f8fafc] active:neu-pressed transition-all duration-200"
                title={`Switch to ${isDarkMode ? 'Bright Luxury' : 'Obsidian Dark'} Theme`}
              >
                {isDarkMode ? (
                  <Sun size={18} className="text-[#d4af37]" />
                ) : (
                  <Moon size={18} className="text-[#755a21]" />
                )}
              </button>

              {/* Sign In Trigger */}
              <button
                type="button"
                onClick={handleSignInClick}
                className="hidden sm:inline-flex items-center justify-center px-5 py-2 rounded-full bg-[#1a3026] hover:bg-[#254235] dark:bg-gradient-to-r dark:from-[#17261f] dark:to-[#122019] text-[#cfe9d9] dark:text-[#7ee787] border border-transparent dark:border-[#2ea043]/30 font-semibold text-xs tracking-wide neu-convex hover:brightness-110 active:scale-95 transition-all duration-200"
              >
                Sign In
              </button>

              {/* Mobile Menu Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="lg:hidden w-10 h-10 rounded-full neu-convex flex items-center justify-center text-[#181c20] dark:text-[#f1f5f9]"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="lg:hidden mt-2 p-4 rounded-3xl neu-floating bg-[#f7f9ff]/95 dark:bg-[#0c0e12]/95 backdrop-blur-2xl flex flex-col gap-2 pointer-events-auto border border-white/40 dark:border-white/10"
              >
                <a
                  href="#top"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2.5 rounded-2xl neu-convex text-sm font-semibold"
                >
                  Home
                </a>
                <a
                  href="#calendar"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2.5 rounded-2xl neu-convex text-sm font-semibold"
                >
                  University Calendar
                </a>
                <a
                  href="#clubs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2.5 rounded-2xl neu-convex text-sm font-semibold"
                >
                  Clubs & Committees
                </a>
                <a
                  href="#about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2.5 rounded-2xl neu-convex text-sm font-semibold"
                >
                  About SBG
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleSignInClick();
                  }}
                  className="w-full mt-2 py-3 rounded-2xl bg-[#1a3026] text-[#cfe9d9] font-bold text-sm shadow-md"
                >
                  Sign In to Portal
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <main id="top" className="relative z-10 w-full pt-28 sm:pt-36">

        {/* ── HERO SECTION: Editorial Luxury & Parallax Depth ─────────── */}
        <section
          ref={heroRef}
          onMouseMove={handleHeroMouseMove}
          onMouseLeave={handleHeroMouseLeave}
          className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 pt-4 pb-20 relative perspective-1000"
        >
          {/* ── PERMANENT BACKGROUND WATERMARK LOGO BEHIND HERO SECTION ───── */}
          <div
            ref={watermarkRef}
            aria-hidden="true"
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-6 sm:-mt-10 w-72 h-72 sm:w-96 sm:h-96 md:w-[460px] md:h-[460px] pointer-events-none z-0 select-none flex items-center justify-center ${
              loaderPhase === 'complete'
                ? 'opacity-[0.06] dark:opacity-[0.038]'
                : 'opacity-0'
            }`}
          >
            <img
              src="/sbg_logo.png"
              alt=""
              className="w-full h-full object-contain"
              width={400}
              height={430}
              loading="eager"
              decoding="sync"
            />
          </div>

          <motion.div
            style={{
              rotateX: springTiltX,
              rotateY: springTiltY,
              transformStyle: 'preserve-3d',
            }}
            className="flex flex-col items-center text-center max-w-5xl mx-auto relative z-10 transition-transform duration-100 ease-out"
          >
            {/* Tactile Crest & Floating Status Badges (Foreground Parallax Layer) */}
            <motion.div
              style={{ y: heroCrestY, opacity: heroCrestOpacity }}
              className="flex flex-wrap items-center justify-center gap-3 mb-6 will-change-transform"
            >
              {/* Sculptural Debossed Monogram Disc with Raised Seal */}
              <div className="inline-flex items-center gap-2 p-1.5 pr-4 rounded-full neu-concave border border-white/50 dark:border-white/[0.04] shadow-sm">
                <div className="w-8 h-8 rounded-full neu-convex flex items-center justify-center border border-[#755a21]/20 dark:border-[#d4af37]/30">
                  <span className="font-bodoni font-bold text-[#755a21] dark:text-[#e5c76b] text-xs tracking-tighter">
                    DAU
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-left">
                  <span className="w-2 h-2 rounded-full bg-[#755a21] dark:bg-[#d4af37] animate-pulse"></span>
                  <span className="text-[11px] font-bold text-[#051b12] dark:text-[#f8fafc] uppercase tracking-wider">
                    SBG Collegiate Senate
                  </span>
                  <span className="text-[10px] text-[#424844]/80 dark:text-[#94a3b8] italic ml-1">
                    Est. 1998
                  </span>
                </div>
              </div>

              {/* Live Assembly Countdown Dial Chip */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full neu-convex text-xs shadow-sm">
                <Timer size={15} className="text-[#4c6358] dark:text-[#52b788]" />
                <span className="font-medium text-[#424844] dark:text-[#cbd5e1]">
                  Senate Assembly in{' '}
                  <strong className="text-[#051b12] dark:text-[#f8fafc] font-bold">
                    2h 15m
                  </strong>
                </span>
              </div>

              {/* Academic Session Pill */}
              <div className="hidden sm:inline-flex items-center gap-2 px-4 py-1.5 rounded-full neu-convex text-xs shadow-sm">
                <CheckCircle2 size={15} className="text-[#755a21] dark:text-[#d4af37]" />
                <span className="font-medium text-[#424844] dark:text-[#cbd5e1]">
                  Term 2026–27 Archive
                </span>
              </div>
            </motion.div>

            {/* High-Fashion Editorial Bodoni Display Headline */}
            <motion.div
              style={{
                y: heroHeadlineY,
                scale: heroHeadlineScale,
                opacity: heroHeadlineOpacity,
              }}
              className="relative mb-6 max-w-4xl will-change-transform"
            >
              <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-[#755a21] dark:text-[#d4af37] block mb-3">
                Collegiate Intelligence & Governance Syndicate
              </span>
              <h1 className="font-bodoni text-4xl sm:text-6xl lg:text-7xl font-normal text-[#051b12] dark:text-[#f5f5f7] tracking-tight leading-[1.08]">
                Discover{' '}
                <span className="italic font-normal text-[#755a21] dark:text-[#e5c76b] relative inline-block">
                  What’s Happening
                </span>{' '}
                <br className="hidden sm:inline" />
                on Campus.
              </h1>
            </motion.div>

            <motion.p
              style={{ y: heroDockY }}
              className="text-base sm:text-lg text-[#424844] dark:text-[#94a3b8] max-w-2xl mb-10 leading-relaxed font-normal will-change-transform"
            >
              The official digital clearinghouse of the Student Body Government.
              Experience live floor motions, RSVP to guild competitions, or
              inspect official venue schedules in real time.
            </motion.p>

            {/* Sculpted Floating Neumorphic Control Deck / Action Dock */}
            <motion.div
              style={{ y: heroDockY }}
              className="p-2 sm:p-2.5 rounded-full neu-concave border border-white/50 dark:border-white/[0.04] flex items-center justify-center gap-2 mb-12 max-w-4xl mx-auto flex-wrap sm:flex-nowrap shadow-sm will-change-transform"
            >
              <a
                href="#calendar"
                className="tactile-kinematic inline-flex items-center gap-2 px-5 py-2.5 rounded-full neu-convex text-xs sm:text-sm font-bold text-[#051b12] dark:text-[#f8fafc] hover:text-[#755a21] dark:hover:text-[#e5c76b]"
              >
                <div className="w-6 h-6 rounded-full neu-concave flex items-center justify-center text-[#755a21] dark:text-[#d4af37]">
                  <CalendarIcon size={13} />
                </div>
                <span>View Calendar</span>
              </a>

              <a
                href="#clubs"
                className="tactile-kinematic inline-flex items-center gap-2 px-5 py-2.5 rounded-full neu-convex text-xs sm:text-sm font-bold text-[#051b12] dark:text-[#f8fafc] hover:text-[#4c6358] dark:hover:text-[#52b788]"
              >
                <div className="w-6 h-6 rounded-full neu-concave flex items-center justify-center text-[#4c6358] dark:text-[#52b788]">
                  <Users size={13} />
                </div>
                <span>Browse Clubs</span>
              </a>

              <a
                href="#about"
                className="tactile-kinematic inline-flex items-center gap-2 px-5 py-2.5 rounded-full neu-convex text-xs sm:text-sm font-bold text-[#051b12] dark:text-[#f8fafc] hover:text-[#755a21] dark:hover:text-[#e5c76b]"
              >
                <div className="w-6 h-6 rounded-full neu-concave flex items-center justify-center text-[#755a21] dark:text-[#d4af37]">
                  <Gavel size={13} />
                </div>
                <span>About SBG</span>
              </a>

              {/* Theme Relief Pill */}
              <button
                type="button"
                onClick={toggleTheme}
                className="tactile-kinematic inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full neu-convex text-xs sm:text-sm font-bold text-[#424844] dark:text-[#cbd5e1]"
                title="Toggle Tactile Theme"
              >
                <Sparkles size={14} className="text-[#755a21] dark:text-[#d4af37]" />
                <span>{isDarkMode ? 'Obsidian Theme' : 'Bright Relief'}</span>
              </button>

              {/* Interactive Tactile Kinematics Demonstration Toggle */}
              <button
                type="button"
                onClick={() =>
                  setKinematicState((prev) =>
                    prev === 'floating' ? 'pressed' : 'floating'
                  )
                }
                className={`tactile-kinematic inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all ${
                  kinematicState === 'pressed'
                    ? 'neu-pressed text-[#755a21] dark:text-[#d4af37]'
                    : 'neu-convex text-[#424844] dark:text-[#94a3b8]'
                }`}
                title="Mimic real-world tactile kinematics"
              >
                <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                <span className="hidden md:inline">Tactile Kinematics:</span>
                <span className="uppercase">{kinematicState}</span>
              </button>
            </motion.div>

            {/* Elevated Neumorphic Tactile Telemetry Trio */}
            <motion.div
              style={{
                y: heroTelemetryY,
                scale: heroTelemetryScale,
                opacity: heroTelemetryOpacity,
              }}
              className="w-full grid grid-cols-1 md:grid-cols-3 gap-5 rounded-3xl p-5 neu-concave border border-white/60 dark:border-white/[0.04] shadow-md will-change-transform"
            >
              {/* Metric 1: Official Archive */}
              <div className="tactile-kinematic flex items-center justify-between p-4 rounded-2xl neu-convex">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-11 h-11 rounded-full neu-concave flex items-center justify-center p-1">
                    <div className="w-8 h-8 rounded-full neu-convex flex items-center justify-center text-[#755a21] dark:text-[#d4af37]">
                      <CheckCircle2 size={17} />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#051b12] dark:text-[#f8fafc]">
                      Official Archive
                    </p>
                    <p className="text-xs text-[#727974] dark:text-[#94a3b8]">
                      DAU Portal verified
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#fed892]/40 dark:bg-[#d4af37]/20 text-[#755a21] dark:text-[#e5c76b] neu-convex">
                  Active
                </span>
              </div>

              {/* Metric 2: Live Timeline */}
              <div className="tactile-kinematic flex items-center justify-between p-4 rounded-2xl neu-convex">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-11 h-11 rounded-full neu-concave flex items-center justify-center p-1">
                    <div className="w-8 h-8 rounded-full neu-convex flex items-center justify-center text-[#4c6358] dark:text-[#52b788]">
                      <CalendarIcon size={17} />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#051b12] dark:text-[#f8fafc]">
                      {monthLabel.month} {monthLabel.year}
                    </p>
                    <p className="text-xs text-[#727974] dark:text-[#94a3b8]">
                      Live active timeline
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#cfe9d9]/60 dark:bg-[#52b788]/20 text-[#1a3026] dark:text-[#52b788] neu-convex">
                  Synced
                </span>
              </div>

              {/* Metric 3: Entities Count */}
              <div className="tactile-kinematic flex items-center justify-between p-4 rounded-2xl neu-convex">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-11 h-11 rounded-full neu-concave flex items-center justify-center p-1">
                    <div className="w-8 h-8 rounded-full neu-convex flex items-center justify-center text-[#755a21] dark:text-[#d4af37]">
                      <Users size={17} />
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#051b12] dark:text-[#f8fafc]">
                      {stats.clubs + stats.committees + stats.organisations} Entities
                    </p>
                    <p className="text-xs text-[#727974] dark:text-[#94a3b8]">
                      Clubs & committees
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#ebeef3] dark:bg-[#1c222c] text-[#051b12] dark:text-[#f8fafc] neu-concave">
                  Chartered
                </span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* ── SECTION TRANSITION JUNCTION 1: HERO TO CALENDAR ─────────── */}
        <SectionJunction
          accentColor="gold"
          label="Schedule Conclave"
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* ── SECTION 2: INTERACTIVE EVENT CALENDAR (#calendar) ───────── */}
        <section
          id="calendar"
          ref={calendarRef}
          className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 py-16 scroll-mt-24 relative"
        >
          {/* Section Header with Parallax Float */}
          <motion.div
            style={{ y: calendarHeaderY, opacity: calendarHeaderOpacity }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 will-change-transform"
          >
            <div>
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#755a21] dark:bg-[#d4af37] shadow-[0_0_6px_#d4af37]"></span>
                <span className="text-xs font-bold uppercase tracking-widest text-[#755a21] dark:text-[#d4af37]">
                  Interactive Schedule
                </span>
              </div>
              <h2 className="font-bodoni text-3xl sm:text-5xl font-normal text-[#051b12] dark:text-[#f5f5f7] tracking-tight">
                University Calendar
              </h2>
            </div>
            <p className="text-sm text-[#727974] dark:text-[#94a3b8] max-w-md">
              Synced directly with SBG Secretariat filings. Select any day to
              inspect agendas and location allocations.
            </p>
          </motion.div>

          {/* Neumorphic Calendar Container Widget with Depth Reveal */}
          <motion.div
            style={{
              y: calendarCardY,
              scale: calendarCardScale,
              opacity: calendarCardOpacity,
            }}
            className="w-full rounded-3xl neu-convex p-4 sm:p-8 transition-all will-change-transform shadow-lg"
          >
            {/* Calendar Controls & Month Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
              <div className="flex items-center gap-4 flex-wrap">
                <h3 className="font-bodoni text-2xl sm:text-3xl text-[#051b12] dark:text-[#f5f5f7] flex items-center gap-2">
                  <span>{monthLabel.month}</span>
                  <span className="text-[#755a21] dark:text-[#d4af37] font-normal">
                    {monthLabel.year}
                  </span>
                </h3>
                <span className="px-3 py-1 rounded-full neu-concave text-xs font-bold text-[#051b12] dark:text-[#cbd5e1]">
                  {events.length} fixtures scheduled
                </span>
              </div>

              {/* Legend & Navigation Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Legend Chips */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full neu-concave text-xs">
                  <span className="font-bold text-[#727974] dark:text-[#94a3b8]">
                    Legend:
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full neu-convex text-[#3b82f6]">
                    <span className="w-2 h-2 rounded-full bg-[#3b82f6]"></span>
                    <span>Co-Curricular</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full neu-convex text-[#10b981]">
                    <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                    <span>Open for All</span>
                  </span>
                </div>

                {/* Today & Nav Chevrons */}
                <button
                  type="button"
                  onClick={goToToday}
                  className="tactile-kinematic px-4 py-1.5 rounded-full neu-convex text-xs font-bold text-[#051b12] dark:text-[#f1f5f9]"
                >
                  Today
                </button>
                <div className="flex items-center gap-1 p-1 rounded-full neu-concave">
                  <button
                    type="button"
                    onClick={prevMonth}
                    aria-label="Previous month"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#424844] dark:text-[#94a3b8] hover:text-[#051b12] dark:hover:text-white"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    aria-label="Next month"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#424844] dark:text-[#94a3b8] hover:text-[#051b12] dark:hover:text-white"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Days Header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-[#727974] dark:text-[#94a3b8] uppercase tracking-wider py-2">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* 7-Column Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
              {daysInMonth.map((day, idx) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[90px] sm:min-h-[130px] rounded-2xl opacity-20 neu-concave"
                    />
                  );
                }

                const isToday =
                  day.getDate() === getISTNow().getDate() &&
                  day.getMonth() === getISTNow().getMonth() &&
                  day.getFullYear() === getISTNow().getFullYear();

                const isSelected =
                  day.getDate() === selectedDate.getDate() &&
                  day.getMonth() === selectedDate.getMonth() &&
                  day.getFullYear() === selectedDate.getFullYear();

                // Day's events
                const dayEvents = events.filter((e) => {
                  const ed = new Date(e.startTime);
                  return (
                    ed.getDate() === day.getDate() &&
                    ed.getMonth() === day.getMonth() &&
                    ed.getFullYear() === day.getFullYear()
                  );
                });

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`tactile-kinematic min-h-[90px] sm:min-h-[130px] p-2 sm:p-2.5 rounded-2xl flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'neu-pressed ring-2 ring-[#755a21] dark:ring-[#d4af37]'
                        : isToday
                        ? 'neu-convex ring-2 ring-[#10b981]/50 bg-[#cfe9d9]/20 dark:bg-[#141d18]'
                        : 'neu-concave hover:neu-convex'
                    }`}
                  >
                    {/* Top Row: Date Number & Badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-bodoni text-sm sm:text-base font-bold ${
                          isToday
                            ? 'w-6 h-6 rounded-full bg-[#10b981] text-[#051b12] flex items-center justify-center'
                            : 'text-[#051b12] dark:text-[#f1f5f9]'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="flex items-center gap-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              dayEvents.some((e) => e.eventType === 'co_curricular')
                                ? 'bg-[#3b82f6]'
                                : 'bg-[#10b981]'
                            }`}
                          />
                          <span className="hidden sm:inline text-[10px] font-bold text-[#755a21] dark:text-[#d4af37]">
                            {dayEvents.length}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Event Preview Pills */}
                    <div className="flex flex-col gap-1 mt-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventModal(ev);
                          }}
                          className="px-1.5 py-1 rounded-lg neu-convex text-[10px] sm:text-xs truncate font-medium text-[#051b12] dark:text-[#f8fafc] border border-white/40 dark:border-white/5"
                          title={ev.eventName}
                        >
                          {ev.eventName}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] text-[#727974] dark:text-[#94a3b8] italic">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Featured Event Spotlight Card */}
            {featuredEvent && (
              <motion.div
                style={{ y: calendarExitY, scale: calendarExitScale }}
                className="mt-8 p-4 sm:p-6 rounded-2xl neu-concave flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-white/40 dark:border-white/5 will-change-transform"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl neu-convex flex items-center justify-center text-[#755a21] dark:text-[#d4af37] shrink-0">
                    <Gavel size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-full bg-[#fed892]/50 dark:bg-[#d4af37]/20 text-[#755a21] dark:text-[#f5d77f] text-[10px] font-bold uppercase tracking-wider">
                        FEATURED FIXTURE
                      </span>
                      <span className="px-2 py-0.5 rounded-full neu-convex text-[10px] font-bold text-[#3b82f6]">
                        {featuredEvent.clubName}
                      </span>
                      <span className="text-xs text-[#727974] dark:text-[#94a3b8]">
                        {formatISTDate(featuredEvent.startTime, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        • {formatISTTime(featuredEvent.startTime)}
                      </span>
                    </div>
                    <h4 className="font-bodoni font-bold text-lg sm:text-xl text-[#051b12] dark:text-[#f8fafc]">
                      {featuredEvent.eventName}
                    </h4>
                    <p className="text-xs text-[#727974] dark:text-[#94a3b8] flex items-center gap-1 mt-0.5">
                      <MapPin size={12} /> {featuredEvent.venueName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedEventModal(featuredEvent)}
                    className="tactile-kinematic px-4 py-2 rounded-full neu-convex text-xs font-bold text-[#051b12] dark:text-[#f1f5f9]"
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    onClick={handleSignInClick}
                    className="tactile-kinematic px-5 py-2 rounded-full bg-[#1a3026] text-[#cfe9d9] dark:bg-gradient-to-r dark:from-[#20362b] dark:to-[#12231b] dark:border dark:border-[#52b788]/40 dark:text-[#a7f3d0] font-bold text-xs shadow-md"
                  >
                    RSVP Seat
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* ── SECTION TRANSITION JUNCTION 2: CALENDAR TO CLUBS ─────────── */}
        <SectionJunction
          accentColor="emerald"
          label="Student Entities"
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* ── SECTION 3: CLUBS & COMMITTEES (#clubs) ──────────────────── */}
        <section
          id="clubs"
          ref={clubsRef}
          className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 py-16 scroll-mt-24 relative"
        >
          {/* Section Header with Parallax Float */}
          <motion.div
            style={{ y: clubsHeaderY, opacity: clubsHeaderOpacity }}
            className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 will-change-transform"
          >
            <div>
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#4c6358] dark:bg-[#52b788] shadow-[0_0_6px_#52b788]"></span>
                <span className="text-xs font-bold uppercase tracking-widest text-[#4c6358] dark:text-[#52b788]">
                  Student Organizations
                </span>
              </div>
              <h2 className="font-bodoni text-3xl sm:text-5xl font-normal text-[#051b12] dark:text-[#f5f5f7] tracking-tight">
                Clubs & Committees
              </h2>
            </div>
            <p className="text-sm text-[#727974] dark:text-[#94a3b8] max-w-md">
              Explore campus student organizations and active leadership in one
              place. Connect with executive heads and view chartered mandates.
            </p>
          </motion.div>

          {/* Segmented Control Tabs & Search Trench */}
          <motion.div
            style={{ y: clubsFilterY }}
            className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-8 will-change-transform"
          >
            {/* Tactile Segmented Tabs */}
            <div className="inline-flex p-1.5 rounded-full neu-concave self-start gap-1">
              <button
                type="button"
                onClick={() => setClubTab('club')}
                className={`tactile-kinematic px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  clubTab === 'club'
                    ? 'neu-convex text-[#051b12] dark:text-[#f5f5f7]'
                    : 'text-[#727974] dark:text-[#94a3b8] hover:text-[#051b12]'
                }`}
              >
                Clubs
              </button>
              <button
                type="button"
                onClick={() => setClubTab('committee')}
                className={`tactile-kinematic px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  clubTab === 'committee'
                    ? 'neu-convex text-[#051b12] dark:text-[#f5f5f7]'
                    : 'text-[#727974] dark:text-[#94a3b8] hover:text-[#051b12]'
                }`}
              >
                Committees
              </button>
              <button
                type="button"
                onClick={() => setClubTab('organisation')}
                className={`tactile-kinematic px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  clubTab === 'organisation'
                    ? 'neu-convex text-[#051b12] dark:text-[#f5f5f7]'
                    : 'text-[#727974] dark:text-[#94a3b8] hover:text-[#051b12]'
                }`}
              >
                Organisations
              </button>
            </div>

            {/* Tactile Inset Search Bar */}
            <div className="relative w-full lg:w-80">
              <div className="w-full h-11 px-4 rounded-full neu-concave flex items-center gap-2">
                <Search size={16} className="text-[#727974] dark:text-[#94a3b8]" />
                <input
                  type="text"
                  value={clubSearch}
                  onChange={(e) => setClubSearch(e.target.value)}
                  placeholder="Search entities..."
                  className="w-full bg-transparent text-xs text-[#051b12] dark:text-[#f8fafc] placeholder:text-[#727974] focus:outline-none"
                />
                {clubSearch && (
                  <button
                    type="button"
                    onClick={() => setClubSearch('')}
                    className="text-[#727974] hover:text-[#051b12]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* Staggered Multi-Column Parallax Grid of Neumorphic Club Cards */}
          <motion.div
            style={{ opacity: clubsGridOpacity }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredClubs.map((club, idx) => {
              // Stagger parallax translate per column
              const colMod = idx % 3;
              const colTranslate =
                colMod === 0 ? clubsCol1Y : colMod === 1 ? clubsCol2Y : clubsCol3Y;

              return (
                <motion.div
                  key={club.id}
                  style={{ y: colTranslate }}
                  className="tactile-kinematic rounded-3xl neu-convex p-5 sm:p-6 flex flex-col justify-between hover:-translate-y-1 transition-all duration-300 will-change-transform shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl neu-concave flex items-center justify-center text-[#755a21] dark:text-[#d4af37]">
                        <Users size={22} />
                      </div>
                      <span className="text-[11px] font-bold px-3 py-1 rounded-full neu-convex text-[#755a21] dark:text-[#e5c76b]">
                        {club.group_category || 'General'}
                      </span>
                    </div>

                    <h3 className="font-bodoni font-bold text-xl text-[#051b12] dark:text-[#f5f5f7] mb-2">
                      {club.name}
                    </h3>
                    <p className="text-xs text-[#424844] dark:text-[#94a3b8] line-clamp-3 leading-relaxed mb-4">
                      {club.description ||
                        'Chartered student body committed to student welfare, technical excellence, and collegiate activities.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                    <a
                      href={`mailto:${club.email}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#727974] dark:text-[#94a3b8] hover:text-[#051b12] dark:hover:text-white transition-colors"
                    >
                      <Mail size={14} />
                      <span>Contact</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setSelectedClubModal(club)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#755a21] dark:text-[#d4af37] hover:translate-x-0.5 transition-all"
                    >
                      <span>About Entity</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ── SECTION TRANSITION JUNCTION 3: CLUBS TO ABOUT ─────────────── */}
        <SectionJunction
          accentColor="crimson"
          label="Institutional Charter"
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* ── SECTION 4: ABOUT SBG & GOVERNANCE HIERARCHY (#about) ───── */}
        <section
          id="about"
          ref={aboutRef}
          className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 py-16 scroll-mt-24 relative"
        >
          {/* Section Header with Parallax Float */}
          <motion.div
            style={{ y: aboutHeaderY, opacity: aboutHeaderOpacity }}
            className="flex flex-col items-center text-center max-w-2xl mx-auto mb-12 will-change-transform"
          >
            <span className="px-4 py-1 rounded-full neu-concave text-xs font-bold uppercase tracking-widest text-[#755a21] dark:text-[#d4af37] mb-3">
              STUDENT BODY GOVERNMENT
            </span>
            <h2 className="font-bodoni text-4xl sm:text-6xl font-normal text-[#051b12] dark:text-[#f5f5f7] tracking-tight mb-3">
              About SBG
            </h2>
            <p className="text-sm sm:text-base text-[#424844] dark:text-[#94a3b8]">
              The autonomous democratic council mandated with safeguarding
              undergraduate welfare, collegiate ethics, and student governance.
            </p>
          </motion.div>

          {/* 4 Top Neumorphic Metric Stat Cards with Staggered Parallax Wave */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
            <motion.div
              style={{ y: statCard1Y }}
              className="tactile-kinematic rounded-3xl neu-convex p-5 sm:p-6 flex flex-col items-center text-center will-change-transform shadow-md"
            >
              <div className="w-10 h-10 rounded-full neu-concave flex items-center justify-center text-[#051b12] dark:text-[#f8fafc] mb-2">
                <Users size={18} />
              </div>
              <span className="font-bodoni text-3xl sm:text-5xl font-bold text-[#051b12] dark:text-[#f8fafc]">
                {stats.clubs}
              </span>
              <span className="text-xs uppercase tracking-wider text-[#727974] dark:text-[#94a3b8] font-bold mt-1">
                Clubs
              </span>
              <div className="w-8 h-1 bg-[#755a21] rounded-full mt-3 neu-convex"></div>
            </motion.div>

            <motion.div
              style={{ y: statCard2Y }}
              className="tactile-kinematic rounded-3xl neu-convex p-5 sm:p-6 flex flex-col items-center text-center will-change-transform shadow-md"
            >
              <div className="w-10 h-10 rounded-full neu-concave flex items-center justify-center text-[#4c6358] dark:text-[#52b788] mb-2">
                <CheckCircle2 size={18} />
              </div>
              <span className="font-bodoni text-3xl sm:text-5xl font-bold text-[#051b12] dark:text-[#f8fafc]">
                {stats.committees}
              </span>
              <span className="text-xs uppercase tracking-wider text-[#727974] dark:text-[#94a3b8] font-bold mt-1">
                Committees
              </span>
              <div className="w-8 h-1 bg-[#4c6358] rounded-full mt-3 neu-convex"></div>
            </motion.div>

            <motion.div
              style={{ y: statCard3Y }}
              className="tactile-kinematic rounded-3xl neu-convex p-5 sm:p-6 flex flex-col items-center text-center will-change-transform shadow-md"
            >
              <div className="w-10 h-10 rounded-full neu-concave flex items-center justify-center text-[#755a21] dark:text-[#d4af37] mb-2">
                <Gavel size={18} />
              </div>
              <span className="font-bodoni text-3xl sm:text-5xl font-bold text-[#051b12] dark:text-[#f8fafc]">
                {stats.organisations}
              </span>
              <span className="text-xs uppercase tracking-wider text-[#727974] dark:text-[#94a3b8] font-bold mt-1">
                Organisations
              </span>
              <div className="w-8 h-1 bg-[#d4af37] rounded-full mt-3 neu-convex"></div>
            </motion.div>

            <motion.div
              style={{ y: statCard4Y }}
              className="tactile-kinematic rounded-3xl neu-convex p-5 sm:p-6 flex flex-col items-center text-center will-change-transform shadow-md"
            >
              <div className="w-10 h-10 rounded-full neu-concave flex items-center justify-center text-[#1a3026] dark:text-[#7ee787] mb-2">
                <UserIcon size={18} />
              </div>
              <span className="font-bodoni text-3xl sm:text-5xl font-bold text-[#051b12] dark:text-[#f8fafc]">
                {stats.members}
              </span>
              <span className="text-xs uppercase tracking-wider text-[#727974] dark:text-[#94a3b8] font-bold mt-1">
                Total Members
              </span>
              <div className="w-8 h-1 bg-[#1a3026] dark:bg-[#7ee787] rounded-full mt-3 neu-convex"></div>
            </motion.div>
          </div>

          {/* Vision Statement vs At A Glance Split Grid with Parallax Entrance */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
            {/* Vision Card (7 cols) */}
            <motion.div
              style={{ y: visionY }}
              className="lg:col-span-7 rounded-3xl neu-convex p-6 sm:p-8 flex flex-col justify-between will-change-transform shadow-lg"
            >
              <div>
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#755a21] dark:text-[#d4af37]">
                    Foundational Purpose
                  </span>
                </div>
                <h3 className="font-bodoni font-bold text-2xl sm:text-3xl text-[#051b12] dark:text-[#f8fafc] mb-4">
                  Student Body Government Vision
                </h3>
                <p className="text-sm text-[#424844] dark:text-[#94a3b8] leading-relaxed mb-6">
                  SBG is the representative body of DAU students, acting as the
                  bridge between students and the university administration. It
                  empowers student initiatives, governs clubs and councils, and
                  oversees welfare, discipline, and elections.
                </p>

                {/* Vision Pillars */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-2xl neu-concave">
                    <div className="w-7 h-7 rounded-full neu-convex flex items-center justify-center text-[#755a21] dark:text-[#d4af37] shrink-0 mt-0.5">
                      <Gavel size={15} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-[#051b12] dark:text-[#f8fafc]">
                        Democratic Representation & Self-Governance
                      </h4>
                      <p className="text-xs text-[#727974] dark:text-[#94a3b8]">
                        Autonomous decision making driven by elected student
                        representatives from every batch and department.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl neu-concave">
                    <div className="w-7 h-7 rounded-full neu-convex flex items-center justify-center text-[#4c6358] dark:text-[#52b788] shrink-0 mt-0.5">
                      <CheckCircle2 size={15} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-[#051b12] dark:text-[#f8fafc]">
                        Monitoring & Activity Regulation
                      </h4>
                      <p className="text-xs text-[#727974] dark:text-[#94a3b8]">
                        Allocating budgets, auditing expenditures, vetting
                        chartered venues, and sustaining high academic integrity.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl neu-concave">
                    <div className="w-7 h-7 rounded-full neu-convex flex items-center justify-center text-[#755a21] dark:text-[#d4af37] shrink-0 mt-0.5">
                      <Users size={15} />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-[#051b12] dark:text-[#f8fafc]">
                        Equity, Justice & Holistic Development
                      </h4>
                      <p className="text-xs text-[#727974] dark:text-[#94a3b8]">
                        Safeguarding every collegiate member's voice, nurturing
                        leadership qualities, and defending campus parity.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                <span className="text-[#727974] dark:text-[#94a3b8] uppercase tracking-wider font-semibold">
                  Charter established 1998
                </span>
                <Link
                  to="/policy"
                  className="font-bold text-[#051b12] dark:text-[#f8fafc] hover:underline flex items-center gap-1"
                >
                  <span>Read Constitution & Bylaws</span>
                  <ExternalLink size={12} />
                </Link>
              </div>
            </motion.div>

            {/* At A Glance Census Records (5 cols) */}
            <motion.div
              style={{ y: censusY }}
              className="lg:col-span-5 rounded-3xl neu-convex p-6 sm:p-8 flex flex-col justify-between will-change-transform shadow-lg"
            >
              <div>
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#755a21] dark:text-[#d4af37]">
                    Census Registry
                  </span>
                </div>
                <h3 className="font-bodoni font-bold text-2xl sm:text-3xl text-[#051b12] dark:text-[#f8fafc] mb-6">
                  At a Glance
                </h3>

                <div className="space-y-2">
                  <div className="p-3 rounded-2xl neu-concave flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#755a21] dark:bg-[#d4af37]"></span>
                      <span>Club members</span>
                    </div>
                    <span className="font-bodoni font-bold text-base text-[#051b12] dark:text-[#f8fafc]">
                      150
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl neu-concave flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#4c6358] dark:bg-[#52b788]"></span>
                      <span>Committee members</span>
                    </div>
                    <span className="font-bodoni font-bold text-base text-[#051b12] dark:text-[#f8fafc]">
                      146
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl neu-concave flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#fed892] dark:bg-[#856014]"></span>
                      <span>Organisation members</span>
                    </div>
                    <span className="font-bodoni font-bold text-base text-[#051b12] dark:text-[#f8fafc]">
                      31
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl neu-concave flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1a3026] dark:bg-[#7ee787]"></span>
                      <span>Total student members</span>
                    </div>
                    <span className="font-bodoni font-bold text-lg text-[#051b12] dark:text-[#f8fafc]">
                      308
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#fed892]/30 dark:bg-[#d4af37]/15 neu-convex flex items-center justify-between text-xs font-bold text-[#755a21] dark:text-[#e5c76b]">
                    <span>Total Activities (Annual)</span>
                    <span className="font-bodoni text-lg font-bold">105</span>
                  </div>
                </div>
              </div>

              {/* Ratio Distribution Bar */}
              <div className="pt-6 mt-6 border-t border-black/5 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#727974] dark:text-[#94a3b8] block mb-1">
                  Ratio Distribution
                </span>
                <div className="h-2.5 w-full rounded-full neu-concave overflow-hidden flex">
                  <div
                    className="h-full bg-[#755a21] dark:bg-[#d4af37]"
                    style={{ width: '49%' }}
                    title="Clubs (49%)"
                  ></div>
                  <div
                    className="h-full bg-[#4c6358] dark:bg-[#52b788]"
                    style={{ width: '47%' }}
                    title="Committees (47%)"
                  ></div>
                  <div
                    className="h-full bg-[#fed892] dark:bg-[#856014]"
                    style={{ width: '4%' }}
                    title="Organisations (4%)"
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-[#727974] dark:text-[#94a3b8] mt-1 font-medium">
                  <span>Clubs (49%)</span>
                  <span>Committees (47%)</span>
                  <span>Organisations (4%)</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Organizational Hierarchy Tree with Kinematic Connector Animation */}
          <motion.div
            style={{ y: hierarchyY, scale: hierarchyScale }}
            className="w-full rounded-3xl neu-convex p-6 sm:p-10 text-center will-change-transform shadow-xl"
          >
            <span className="px-4 py-1 rounded-full neu-concave text-xs font-bold uppercase tracking-widest text-[#755a21] dark:text-[#d4af37]">
              Institutional Chain of Command
            </span>
            <h3 className="font-bodoni text-2xl sm:text-4xl text-[#051b12] dark:text-[#f8fafc] font-normal mt-2 mb-2">
              Organizational Hierarchy
            </h3>
            <p className="text-xs sm:text-sm text-[#727974] dark:text-[#94a3b8] max-w-xl mx-auto mb-8">
              Official collegiate governance framework reporting to the
              university administration.
            </p>

            <div className="flex flex-col items-center">
              {/* Top: Dean of Students */}
              <div className="max-w-md w-full p-5 rounded-2xl neu-floating border-t-2 border-[#755a21] dark:border-[#d4af37]">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#755a21] dark:text-[#d4af37]">
                  DAU Reporting Authority
                </span>
                <h4 className="font-bodoni font-bold text-lg sm:text-xl text-[#051b12] dark:text-[#f8fafc]">
                  Dean of Students
                </h4>
                <p className="text-xs text-[#727974] dark:text-[#94a3b8]">
                  Office of Student Affairs & Academic Welfare
                </p>
                <div className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-[#755a21] dark:text-[#d4af37]">
                  <CheckCircle2 size={13} />
                  <span>Supreme Institutional Oversight</span>
                </div>
              </div>

              {/* Dynamic Animated Vertical Connector Line */}
              <div className="w-[2px] h-8 bg-[#c2c8c3]/40 dark:bg-[#2e3642]/60 my-1 overflow-hidden relative shadow-sm">
                <motion.div
                  style={{ scaleY: hierarchyLineScaleY, originY: 0 }}
                  className="w-full h-full bg-gradient-to-b from-[#755a21] via-[#c4973b] to-[#d4af37] dark:from-[#d4af37] dark:via-[#fff1a8] dark:to-[#52b788] shadow-[0_0_8px_rgba(212,175,55,0.7)]"
                />
              </div>

              {/* Tier 2: SBG Executive Council */}
              <div className="max-w-lg w-full p-4 rounded-2xl neu-convex">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#4c6358] dark:text-[#52b788]">
                  Executive Council
                </span>
                <h4 className="font-bold text-base text-[#051b12] dark:text-[#f8fafc]">
                  President & Vice President of SBG
                </h4>
                <p className="text-xs text-[#727974] dark:text-[#94a3b8]">
                  General Secretary • Treasurer • Academic Convener
                </p>
              </div>

              {/* Dynamic Animated Vertical Connector Line */}
              <div className="w-[2px] h-8 bg-[#c2c8c3]/40 dark:bg-[#2e3642]/60 my-1 overflow-hidden relative shadow-sm">
                <motion.div
                  style={{ scaleY: hierarchyLineScaleY, originY: 0 }}
                  className="w-full h-full bg-gradient-to-b from-[#755a21] via-[#c4973b] to-[#d4af37] dark:from-[#d4af37] dark:via-[#fff1a8] dark:to-[#52b788] shadow-[0_0_8px_rgba(212,175,55,0.7)]"
                />
              </div>

              {/* Tier 3: 3 Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full pt-1">
                <div className="p-4 rounded-2xl neu-concave">
                  <div className="w-9 h-9 rounded-full neu-convex mx-auto flex items-center justify-center text-[#051b12] dark:text-[#f8fafc] mb-2">
                    <Users size={16} />
                  </div>
                  <h5 className="font-bold text-sm text-[#051b12] dark:text-[#f8fafc]">
                    24 Club Executives
                  </h5>
                  <p className="text-[11px] text-[#727974] dark:text-[#94a3b8] mt-1">
                    Technical, Cultural, Literary & Sports conveners overseeing
                    weekly activities.
                  </p>
                </div>

                <div className="p-4 rounded-2xl neu-concave">
                  <div className="w-9 h-9 rounded-full neu-convex mx-auto flex items-center justify-center text-[#755a21] dark:text-[#d4af37] mb-2">
                    <Gavel size={16} />
                  </div>
                  <h5 className="font-bold text-sm text-[#051b12] dark:text-[#f8fafc]">
                    8 Standing Committees
                  </h5>
                  <p className="text-[11px] text-[#727974] dark:text-[#94a3b8] mt-1">
                    Discipline, Dining, Mess, Library, Hostel, Academic
                    Integrity, Grievance Tribunal.
                  </p>
                </div>

                <div className="p-4 rounded-2xl neu-concave">
                  <div className="w-9 h-9 rounded-full neu-convex mx-auto flex items-center justify-center text-[#4c6358] dark:text-[#52b788] mb-2">
                    <CheckCircle2 size={16} />
                  </div>
                  <h5 className="font-bold text-sm text-[#051b12] dark:text-[#f8fafc]">
                    2 Special Organisations
                  </h5>
                  <p className="text-[11px] text-[#727974] dark:text-[#94a3b8] mt-1">
                    Annual Cultural Fest Secretariat & Technical Conclave
                    Steering Council.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── SECTION TRANSITION JUNCTION 4: ABOUT TO CALLOUT ─────────── */}
        <SectionJunction
          accentColor="gold"
          label="Collegiate Senate"
          prefersReducedMotion={prefersReducedMotion}
        />

        {/* ── SECTION 5: TACTILE FOOTNOTE & ACTION CALLOUT ────────────── */}
        <section
          ref={calloutRef}
          className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 pb-16 relative"
        >
          <motion.div
            style={{ y: calloutCardY, scale: calloutCardScale }}
            className="w-full rounded-3xl neu-concave p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left border border-white/50 dark:border-white/5 will-change-transform shadow-md"
          >
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#755a21] dark:text-[#d4af37] block mb-1">
                Join the Student Senate
              </span>
              <h3 className="font-bodoni text-2xl sm:text-3xl text-[#051b12] dark:text-[#f8fafc]">
                Have an initiative or request a club charter?
              </h3>
              <p className="text-xs sm:text-sm text-[#727974] dark:text-[#94a3b8] max-w-xl mt-1">
                Petitions, funding bills, and campus grievances can be submitted
                directly through the SBG Secretariat portal.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setPetitionSubmitted(false);
                  setIsPetitionOpen(true);
                }}
                className="tactile-kinematic px-6 py-2.5 rounded-full neu-convex text-xs font-bold text-[#051b12] dark:text-[#f8fafc]"
              >
                Submit Petition
              </button>
              <button
                type="button"
                onClick={handleSignInClick}
                className="tactile-kinematic px-6 py-2.5 rounded-full bg-[#1a3026] text-[#cfe9d9] dark:bg-gradient-to-r dark:from-[#20362b] dark:to-[#12231b] dark:border dark:border-[#52b788]/40 dark:text-[#a7f3d0] font-bold text-xs shadow-md"
              >
                Executive Portal
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="w-full bg-[#ebeef3] dark:bg-[#08090c] pt-16 pb-12 border-t border-black/5 dark:border-white/5 relative z-10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-12">
            {/* Col 1: Brand & Charter */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full neu-concave flex items-center justify-center p-1.5 overflow-hidden shadow-inner">
                  <img
                    src="/sbg_logo_optimized.png"
                    alt="SBG DAU Logo"
                    className="w-full h-full object-contain rounded-full"
                    width={36}
                    height={36}
                    loading="lazy"
                  />
                </div>
                <span className="font-bodoni font-bold text-lg text-[#051b12] dark:text-[#f8fafc]">
                  SBG DAU
                </span>
              </div>
              <p className="text-xs text-[#727974] dark:text-[#94a3b8] leading-relaxed">
                The Student Body Government of DAU upholds academic integrity,
                collegial fraternity, and student-led institutional leadership.
              </p>
              <div className="flex items-center gap-2 pt-2 text-xs font-bold text-[#755a21] dark:text-[#d4af37]">
                <CheckCircle2 size={16} />
                <span>Official Collegiate Charter</span>
              </div>
            </div>

            {/* Col 2: Assemblies & Units */}
            <div className="flex flex-col gap-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#051b12] dark:text-[#f8fafc] mb-1">
                Assemblies & Units
              </h4>
              <ul className="flex flex-col gap-1.5 text-xs text-[#727974] dark:text-[#94a3b8]">
                <li>
                  <a href="#about" className="hover:text-[#051b12] dark:hover:text-white">
                    Executive Council
                  </a>
                </li>
                <li>
                  <a href="#about" className="hover:text-[#051b12] dark:hover:text-white">
                    Senate Representatives
                  </a>
                </li>
                <li>
                  <a href="#about" className="hover:text-[#051b12] dark:hover:text-white">
                    Academic Honor Tribunal
                  </a>
                </li>
                <li>
                  <a href="#about" className="hover:text-[#051b12] dark:hover:text-white">
                    Treasury & Appropriations
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Campus Life */}
            <div className="flex flex-col gap-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#051b12] dark:text-[#f8fafc] mb-1">
                Campus Life
              </h4>
              <ul className="flex flex-col gap-1.5 text-xs text-[#727974] dark:text-[#94a3b8]">
                <li>
                  <a href="#clubs" className="hover:text-[#051b12] dark:hover:text-white">
                    Registered Student Clubs
                  </a>
                </li>
                <li>
                  <a href="#calendar" className="hover:text-[#051b12] dark:hover:text-white">
                    Annual Symposia & Galas
                  </a>
                </li>
                <li>
                  <Link to="/policy" className="hover:text-[#051b12] dark:hover:text-white">
                    Constitutional Bylaws
                  </Link>
                </li>
                <li>
                  <a href="#about" className="hover:text-[#051b12] dark:hover:text-white">
                    Campus Town Hall Requests
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4: Secretariat Office */}
            <div className="flex flex-col gap-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#051b12] dark:text-[#f8fafc] mb-1">
                Secretariat Office
              </h4>
              <p className="text-xs text-[#727974] dark:text-[#94a3b8] leading-relaxed">
                Chancellery Quadrangle, Suite 402
                <br />
                Academic Way, DAU Campus
              </p>
              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full neu-concave text-xs">
                  <Mail size={13} className="text-[#051b12] dark:text-[#d4af37]" />
                  <span className="font-semibold text-[#051b12] dark:text-[#f8fafc]">
                    sbg@dau.edu
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Copyright & Meta */}
          <div className="pt-6 border-t border-black/5 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#727974] dark:text-[#94a3b8]">
            <p>© 2026 Student Body Government of DAU. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link to="/policy" className="hover:text-[#051b12] dark:hover:text-white">
                Governance Protocols
              </Link>
              <Link to="/policy" className="hover:text-[#051b12] dark:hover:text-white">
                Privacy Charter
              </Link>
            </div>
          </div>
        </div>
      </footer>
      </motion.div>

      {/* ── EVENT DETAILS DIALOG ──────────────────────────────────────── */}
      <Dialog open={!!selectedEventModal} onOpenChange={() => setSelectedEventModal(null)}>
        <DialogContent className="max-w-lg neu-floating p-6 rounded-3xl bg-[#f7f9ff] dark:bg-[#0c0e12] border border-white/60 dark:border-white/10">
          {selectedEventModal && (
            <div>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full neu-convex text-[#755a21] dark:text-[#d4af37]">
                    {selectedEventModal.clubName}
                  </span>
                  <span className="text-xs text-[#727974] dark:text-[#94a3b8]">
                    {selectedEventModal.eventType?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <DialogTitle className="font-bodoni text-2xl text-[#051b12] dark:text-[#f8fafc]">
                  {selectedEventModal.eventName}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#727974] dark:text-[#94a3b8]">
                  Fixture Record ID: {selectedEventModal.id}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-3">
                <div className="p-3 rounded-2xl neu-concave flex items-center gap-3">
                  <Clock size={16} className="text-[#755a21] dark:text-[#d4af37]" />
                  <div className="text-xs">
                    <p className="font-bold text-[#051b12] dark:text-[#f8fafc]">
                      Schedule Timings
                    </p>
                    <p className="text-[#727974] dark:text-[#94a3b8]">
                      {formatISTDate(selectedEventModal.startTime, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      • {formatISTTime(selectedEventModal.startTime)} –{' '}
                      {formatISTTime(selectedEventModal.endTime)}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl neu-concave flex items-center gap-3">
                  <MapPin size={16} className="text-[#4c6358] dark:text-[#52b788]" />
                  <div className="text-xs">
                    <p className="font-bold text-[#051b12] dark:text-[#f8fafc]">
                      Allocated Venue
                    </p>
                    <p className="text-[#727974] dark:text-[#94a3b8]">
                      {selectedEventModal.venueName}
                    </p>
                  </div>
                </div>

                {selectedEventModal.description && (
                  <div className="p-3 rounded-2xl neu-concave text-xs text-[#424844] dark:text-[#cbd5e1] leading-relaxed">
                    {selectedEventModal.description}
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEventModal(null)}
                  className="px-4 py-2 rounded-full neu-convex text-xs font-bold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEventModal(null);
                    handleSignInClick();
                  }}
                  className="px-5 py-2 rounded-full bg-[#1a3026] text-[#cfe9d9] font-bold text-xs"
                >
                  Sign In to Book Venues
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── CLUB DETAILS & COMMITTEE MEMBERS DIALOG ────────────────────── */}
      <Dialog open={!!selectedClubModal} onOpenChange={() => setSelectedClubModal(null)}>
        <DialogContent className="max-w-xl neu-floating p-6 rounded-3xl bg-[#f7f9ff] dark:bg-[#0c0e12] border border-white/60 dark:border-white/10">
          {selectedClubModal && (
            <div>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full neu-convex text-[#755a21] dark:text-[#d4af37]">
                    {selectedClubModal.group_category ||
                      selectedClubModal.organization_type}
                  </span>
                </div>
                <DialogTitle className="font-bodoni text-2xl text-[#051b12] dark:text-[#f8fafc]">
                  {selectedClubModal.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#727974] dark:text-[#94a3b8]">
                  Official Chartered Entity
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <p className="text-xs sm:text-sm text-[#424844] dark:text-[#cbd5e1] leading-relaxed p-4 rounded-2xl neu-concave">
                  {selectedClubModal.description ||
                    'Dedicated to extracurricular student growth and academic fraternity.'}
                </p>

                {/* Contact Email & Socials */}
                <div className="flex items-center gap-3 flex-wrap">
                  <a
                    href={`mailto:${selectedClubModal.email}`}
                    className="tactile-kinematic inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full neu-convex text-xs font-semibold text-[#051b12] dark:text-[#f8fafc]"
                  >
                    <Mail size={13} />
                    <span>{selectedClubModal.email}</span>
                  </a>
                  {selectedClubModal.website_url && (
                    <a
                      href={selectedClubModal.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tactile-kinematic inline-flex items-center gap-1 px-3 py-1.5 rounded-full neu-convex text-xs text-[#755a21] dark:text-[#d4af37]"
                    >
                      <Globe size={13} />
                      <span>Website</span>
                    </a>
                  )}
                  {selectedClubModal.instagram_url && (
                    <a
                      href={selectedClubModal.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tactile-kinematic inline-flex items-center gap-1 px-3 py-1.5 rounded-full neu-convex text-xs text-[#755a21] dark:text-[#d4af37]"
                    >
                      <Instagram size={13} />
                      <span>Instagram</span>
                    </a>
                  )}
                  {selectedClubModal.linkedin_url && (
                    <a
                      href={selectedClubModal.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tactile-kinematic inline-flex items-center gap-1 px-3 py-1.5 rounded-full neu-convex text-xs text-[#755a21] dark:text-[#d4af37]"
                    >
                      <Linkedin size={13} />
                      <span>LinkedIn</span>
                    </a>
                  )}
                </div>

                {/* Committee Members List */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#051b12] dark:text-[#f8fafc] mb-2">
                    Executive Representatives
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {members.filter(
                      (m) =>
                        m.club_id === selectedClubModal.id ||
                        m.club_name === selectedClubModal.name
                    ).length > 0 ? (
                      members
                        .filter(
                          (m) =>
                            m.club_id === selectedClubModal.id ||
                            m.club_name === selectedClubModal.name
                        )
                        .map((mem) => (
                          <div
                            key={mem.id}
                            className="p-2.5 rounded-xl neu-concave flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-[#051b12] dark:text-[#f8fafc]">
                              {mem.full_name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full neu-convex text-[10px] font-semibold text-[#755a21] dark:text-[#d4af37]">
                              {mem.designation}
                            </span>
                          </div>
                        ))
                    ) : (
                      <div className="p-3 rounded-xl neu-concave text-xs text-[#727974] dark:text-[#94a3b8] text-center">
                        Executive roster filed with SBG Secretariat Office.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedClubModal(null)}
                  className="px-5 py-2 rounded-full neu-convex text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── SUBMIT PETITION DIALOG ─────────────────────────────────────── */}
      <Dialog open={isPetitionOpen} onOpenChange={setIsPetitionOpen}>
        <DialogContent className="max-w-md neu-floating p-6 rounded-3xl bg-[#f7f9ff] dark:bg-[#0c0e12] border border-white/60 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="font-bodoni text-2xl text-[#051b12] dark:text-[#f8fafc]">
              Collegiate Senate Petition
            </DialogTitle>
            <DialogDescription className="text-xs text-[#727974] dark:text-[#94a3b8]">
              Direct submission to the Secretariat Office & Dean of Students
            </DialogDescription>
          </DialogHeader>

          {petitionSubmitted ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full neu-convex mx-auto flex items-center justify-center text-[#10b981]">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-bold text-base text-[#051b12] dark:text-[#f8fafc]">
                Petition Docket Filed
              </h4>
              <p className="text-xs text-[#727974] dark:text-[#94a3b8]">
                Your representation has been logged under archival review. A docket
                tracking identifier will be dispatched to your collegiate email.
              </p>
              <button
                type="button"
                onClick={() => setIsPetitionOpen(false)}
                className="mt-4 px-6 py-2 rounded-full bg-[#1a3026] text-[#cfe9d9] font-bold text-xs"
              >
                Done
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPetitionSubmitted(true);
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#727974] dark:text-[#94a3b8] block mb-1">
                  Student Name / ID
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. 202401001@dau.edu"
                  className="w-full h-10 px-3 rounded-xl neu-concave text-xs text-[#051b12] dark:text-[#f8fafc] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#727974] dark:text-[#94a3b8] block mb-1">
                  Petition Matter
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. New Club Charter Request / Grievance"
                  className="w-full h-10 px-3 rounded-xl neu-concave text-xs text-[#051b12] dark:text-[#f8fafc] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#727974] dark:text-[#94a3b8] block mb-1">
                  Statement of Fact
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the mandate or proposal for senate floor reading..."
                  className="w-full p-3 rounded-xl neu-concave text-xs text-[#051b12] dark:text-[#f8fafc] focus:outline-none resize-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPetitionOpen(false)}
                  className="px-4 py-2 rounded-full neu-convex text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full bg-[#1a3026] text-[#cfe9d9] font-bold text-xs"
                >
                  File Petition
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPage;
