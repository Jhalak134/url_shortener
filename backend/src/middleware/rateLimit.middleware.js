const rateLimit = require('express-rate-limit');

// ─────────────────────────────────────────────────────────────────────────────
// REDIRECT RATE LIMITER
//
// Applied to GET /:shortCode — the high-traffic redirect hot-path.
// Limits abusive clients while keeping the window short enough to not
// frustrate legitimate users (e.g. link previews hitting the same code).
// ─────────────────────────────────────────────────────────────────────────────
const redirectLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,   // 1-minute sliding window
  max: 60,                    // 60 redirects per IP per minute
  standardHeaders: true,      // Return RateLimit-* headers (RFC 6585)
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  // Skip trusted internal health-check calls
  skip: (req) => req.path === '/health',
});

// ─────────────────────────────────────────────────────────────────────────────
// API RATE LIMITER
//
// Applied to all /api/* routes (link creation, analytics, auth).
// More generous than the redirect limiter since these routes involve
// user interaction, not automated traffic.
// ─────────────────────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15-minute window
  max: 100,                   // 100 API calls per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many API requests. Please try again later.' },
});

// ─────────────────────────────────────────────────────────────────────────────
// LINK CREATION LIMITER
//
// Stricter sub-limiter for POST /api/links to prevent spam link generation.
// Applied on top of the general apiLimiter.
// ─────────────────────────────────────────────────────────────────────────────
const createLinkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1-hour window
  max: 20,                    // 20 new links per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Link creation limit reached. Try again in an hour.' },
});

module.exports = { redirectLimiter, apiLimiter, createLinkLimiter };
