const express = require('express');
const passport = require('passport');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/google
// Kick off the Google OAuth 2.0 consent screen.
// Requests "profile" (name, avatar) and "email" scopes.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/google/callback
// Google redirects here after the user grants (or denies) consent.
// On success  → upsert user (handled by passport.js strategy) → redirect to dashboard.
// On failure  → redirect to /login with an error flag the frontend can read.
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=auth_failed`,
  }),
  (req, res) => {
    // Successful authentication — send the browser to the dashboard.
    // The session cookie is already set by express-session at this point.
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard`);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Returns the currently authenticated user, or { isAuthenticated: false }.
// Called by the frontend on every page load (App.jsx useEffect) to rehydrate
// auth state from the session cookie.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    // Only expose safe fields — never send tokens or sensitive internals
    const { id, email, display_name, profile_image_url, created_at } = req.user;
    return res.json({
      isAuthenticated: true,
      user: { id, email, display_name, profile_image_url, created_at },
    });
  }
  return res.json({ isAuthenticated: false, user: null });
});

// Alias kept for backward compatibility
router.get('/current_user', (req, res) => res.redirect('/api/auth/me'));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// Destroys the server-side session and clears the session cookie.
// Returns JSON so the React SPA can handle the redirect itself.
//
// Why POST and not GET?
//   GET logout is a CSRF risk — any page can silently log out a user by
//   embedding an <img src="/api/auth/logout">. POST requires an intentional
//   form submit or fetch call, which can be CSRF-protected.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    // Destroy the entire session (not just the passport user) to ensure
    // the Redis/MemoryStore entry is fully removed.
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('[Auth] Session destroy error:', destroyErr);
      }
      res.clearCookie('connect.sid'); // default express-session cookie name
      return res.json({ success: true, message: 'Logged out successfully.' });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/logout  (legacy — redirects browsers that navigate here directly)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(frontendUrl);
    });
  });
});

module.exports = router;
