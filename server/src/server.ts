import dotenv from 'dotenv';
dotenv.config();

import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import jwt from 'jsonwebtoken'; // Added standard JWT verification
import morgan from 'morgan';
import path from 'path';
import { Socket, Server as SocketIOServer } from 'socket.io';

import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import bookingsRoutes from './routes/bookings';
import clubMembersRoutes from './routes/clubMembers';
import notificationRoutes from './routes/notifications';

// 1. Swap Supabase for your new Neon DB Pool
import { db } from './db';

const app = express();
const httpServer = createServer(app);

// Build version emitted to clients
const getBuildVersion = (): string => {
  return process.env.BUILD_ID || String(Date.now());
};
const BUILD_VERSION = getBuildVersion();

app.set('trust proxy', 1);

// Security Headers - Must allow cross-origin for separated frontend/backend deployments
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", "http:", "ws:"],
    },
  }
}));
app.use(compression());
app.use(morgan('tiny'));

const envOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim());
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://sbg-website-ashen.vercel.app',
  ...envOrigins
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));

type SocketUser = {
  id: string;
  email: string;
  role: 'club' | 'admin';
  clubId?: string;
};

const extractTokenFromSocket = (socket: Socket): string | null => {
  const cookieStr = socket.handshake.headers.cookie;
  if (cookieStr) {
    const match = cookieStr.match(/jwt_token=([^;]+)/);
    if (match) return match[1];
  }

  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  const authorizationHeader = socket.handshake.headers.authorization;
  if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
    return authorizationHeader.slice('Bearer '.length).trim();
  }

  return null;
};

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use(async (socket, next) => {
  const token = extractTokenFromSocket(socket);

  // Allow anonymous connections for public listeners, but restrict privileged room joins.
  if (!token) {
    socket.data.user = null;
    return next();
  }

  try {
    // 2. Standard JWT Verification (Replaces supabase.auth.getUser)
    // Make sure you add JWT_SECRET to your backend .env file!
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("Missing JWT_SECRET");
    
    const decoded = jwt.verify(token, secret) as { sub: string };
    const userId = decoded.sub; // 'sub' is the standard JWT field for User ID

    if (!userId) {
      socket.data.user = null;
      return next();
    }

    // 3. Raw SQL Query for Profile (Replaces supabase.from('profiles'))
    const profileResult = await db.query(
      'SELECT role, email FROM profiles WHERE id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      socket.data.user = null;
      return next();
    }

    const profile = profileResult.rows[0];

    if (profile.role !== 'club' && profile.role !== 'admin') {
      socket.data.user = null;
      return next();
    }

    const socketUser: SocketUser = {
      id: userId,
      email: profile.email,
      role: profile.role,
    };

    // 4. Raw SQL Query for Club (Replaces supabase.from('clubs'))
    if (socketUser.role === 'club') {
      const clubResult = await db.query(
        'SELECT id FROM clubs WHERE email = $1',
        [socketUser.email]
      );

      if (clubResult.rows.length > 0) {
        socketUser.clubId = clubResult.rows[0].id;
      }
    }

    socket.data.user = socketUser;
    return next();
  } catch (error) {
    console.warn('[Socket.io] Failed to initialize socket auth context:', error);
    socket.data.user = null;
    return next();
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Let the client know which build is live so it can reload after a redeploy.
  socket.emit('server:version', BUILD_VERSION);

  // Allow clubs to join their own room so they receive targeted notifications
  socket.on('join:club', (clubId: string) => {
    const user = socket.data.user as SocketUser | null;
    if (!user || user.role !== 'club' || !user.clubId || user.clubId !== clubId) {
      socket.emit('socket:error', { message: 'Forbidden club room join' });
      return;
    }

    socket.join(`club:${clubId}`);
    console.log(`[Socket.io] Socket ${socket.id} joined room: club:${clubId}`);
  });

  // Allow admins to join the admin room
  socket.on('join:admin', () => {
    const user = socket.data.user as SocketUser | null;
    if (!user || user.role !== 'admin') {
      socket.emit('socket:error', { message: 'Forbidden admin room join' });
      return;
    }

    socket.join('admin');
    console.log(`[Socket.io] Socket ${socket.id} joined room: admin`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});


function isBodyParserError(err: unknown): err is { type: string; message?: string } {
  return typeof err === 'object' && err !== null && 'type' in err;
}

const bodyParserErrorHandler: express.ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in (err as { body?: unknown })) {
    console.error('JSON Parse Error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON payload. Please check the request body.' });
  }

  if (isBodyParserError(err) &&
    (err.type === 'entity.parse.failed' ||
      err.type === 'entity.too.large' ||
      err.type === 'request.size.invalid' ||
      err.type === 'encoding.unsupported')) {

    console.error('Body Parser Error:', err.message);

    let status = 400;
    if (err.type === 'entity.too.large' || err.type === 'request.size.invalid') {
      status = 413;
    } else if (err.type === 'encoding.unsupported') {
      status = 415;
    }

    const responseBody: { error: string; details?: string; type?: string } = {
      error: 'Failed to process request body',
    };

    if (process.env.NODE_ENV !== 'production') {
      responseBody.details = err.message;
      responseBody.type = err.type;
    }

    return res.status(status).json(responseBody);
  }

  next(err);
};

app.use(bodyParserErrorHandler);

app.use((req, _res, next) => {
  // 5. Provide the new DB pool to Express locals instead of Supabase
  req.app.locals.db = db; 
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', build: BUILD_VERSION });
});

import archivesRoutes from './routes/archives';
import eventReportsRoutes from './routes/eventReports';
import eventsRoutes from './routes/events';
import settingsRoutes from './routes/settings';
import { startCronJobs } from './services/emailReminders';

app.use('/api', bookingsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/club-members', clubMembersRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/event-reports', eventReportsRoutes);
app.use('/api/archives', archivesRoutes);
app.use('/api/settings', settingsRoutes);

// Start background cron jobs
startCronJobs();

// Serve static frontend files with SEO-friendly headers.
// Docker sets CLIENT_DIST_DIR=/app/client; local prod uses ../../client/dist.
const clientBuildPath = process.env.CLIENT_DIST_DIR
  || path.join(__dirname, '../../client/dist');

// Cache immutable hashed assets aggressively (JS/CSS bundles)
app.use('/assets', express.static(path.join(clientBuildPath, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Cache other static files (icons, images, manifests) for 1 day
app.use(express.static(clientBuildPath, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    // Service worker must never be cached
    if (filePath.endsWith('sw.js') || filePath.includes('workbox-') || filePath.endsWith('registerSW.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// SEO & Security headers for all HTML responses
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  }
  next();
});

// Catch-all route to serve the React SPA for non-API requests
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

const port = Number(process.env.PORT) || 4000;
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

const shutdown = (signal: string) => {
  console.log(`[${signal}] Shutting down...`);
  httpServer.close(() => {
    void db.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
