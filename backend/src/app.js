const express  = require('express');
const cors     = require('cors');
const session  = require('express-session');
const passport = require('passport');
// connect-redis v6 wraps the session constructor — must be called as connectRedis(session)
// NOTE: connect-redis v7+ dropped ioredis support; v6 is the last ioredis-compatible version.
const connectRedis = require('connect-redis');
const RedisStore   = connectRedis(session);

// Import configurations (side-effect: registers passport strategies)
require('dotenv').config();
require('./config/passport');

// Shared Redis client (ioredis instance, already configured)
const redisClient = require('./config/redis');

// Import Routes
const authRoutes      = require('./routes/auth.routes');
const linkRoutes      = require('./routes/link.routes');
const redirectRoutes  = require('./routes/redirect.routes');
const analyticsRoutes = require('./routes/analytics.routes');

// Import Rate Limiters
const { apiLimiter, redirectLimiter } = require('./middleware/rateLimit.middleware');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// credentials: true is required so browsers include the session cookie
// on cross-origin requests (frontend at :5173 → backend at :3000).
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// ── Session (Redis-backed) ────────────────────────────────────────────────────
//
// Why Redis for sessions?
//   The default MemoryStore loses all sessions on server restart and leaks
//   memory under load (sessions are never purged). Redis is persistent,
//   supports TTL-based expiry, and scales across multiple Node processes.
//
// connect-redis bridges express-session ↔ ioredis.
// The session secret signs the cookie — keep it long and random in production.
app.use(session({
  store: new RedisStore({
    client: redisClient,
    prefix: 'sess:',    // Redis key prefix → "sess:<sessionId>"
    ttl:    86400,      // Session TTL in seconds (24 h); mirrors cookie maxAge
    disableTouch: false // refresh TTL on every request
  }),
  secret:            process.env.SESSION_SECRET || 'supersecret_session_key',
  resave:            false,  // Don't write session to store if nothing changed
  saveUninitialized: false,  // Don't create a session for unauthenticated visitors
  cookie: {
    secure:   process.env.NODE_ENV === 'production', // HTTPS-only in prod
    httpOnly: true,          // JS cannot read the cookie (XSS protection)
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge:   24 * 60 * 60 * 1000, // 24 hours in milliseconds
  },
}));

// ── Passport ──────────────────────────────────────────────────────────────────
// initialize() — attaches passport to req (adds req.login, req.logout, etc.)
// session()    — wires passport to express-session (calls deserializeUser per request)
app.use(passport.initialize());
app.use(passport.session());

// ── API Routes (rate-limited globally) ───────────────────────────────────────
app.use('/api',           apiLimiter);
app.use('/api/auth',      authRoutes);
app.use('/api/links',     linkRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
// MUST be defined BEFORE the redirect wildcard below — Express matches routes
// top-to-bottom, and /:shortCode([a-zA-Z0-9]+) would otherwise capture /health.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ── Redirect hot-path ─────────────────────────────────────────────────────────
// Separate, tighter rate limiter (60 req/min vs 100 req/15min for API).
// Mounted AFTER /api/* and /health so the short-code regex doesn't swallow them.
app.use('/', redirectLimiter, redirectRoutes);

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Express] Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
