const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./db');
require('dotenv').config();

// ─────────────────────────────────────────────────────────────────────────────
// SERIALIZE / DESERIALIZE
//
// serializeUser   — called after successful login; stores the user's DB id
//                   (not the Google ID) as the session token. Keeps the
//                   session cookie payload minimal.
// deserializeUser — called on every authenticated request; re-hydrates the
//                   full user row from Postgres using the stored id.
// ─────────────────────────────────────────────────────────────────────────────
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, google_id, email, display_name, profile_image_url, created_at FROM users WHERE id = $1',
      [id]
    );
    if (rows.length === 0) return done(null, false); // user deleted since last login
    done(null, rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE OAUTH 2.0 STRATEGY
//
// Flow:
//   1. User hits GET /api/auth/google → Passport redirects to Google consent screen.
//   2. Google redirects to GET /api/auth/google/callback with an auth code.
//   3. Passport exchanges the code for tokens and calls this verify callback.
//   4. We UPSERT the user:
//        a. If google_id already exists → update name/photo (in case they changed)
//           and return the existing user.
//        b. If email exists without google_id → link the account (edge case).
//        c. Otherwise → create a brand-new user row.
// ─────────────────────────────────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID     || 'PLACEHOLDER_ID',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_SECRET',
      callbackURL:  process.env.GOOGLE_CALLBACK_URL  || 'http://localhost:3000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId  = profile.id;
        const email     = profile.emails[0].value;
        const name      = profile.displayName;
        const avatarUrl = profile.photos?.[0]?.value || null;

        // ── Case A: returning user ────────────────────────────────────────────
        const existing = await pool.query(
          'SELECT * FROM users WHERE google_id = $1',
          [googleId]
        );

        if (existing.rows.length > 0) {
          // Refresh display_name and avatar in case the user updated their Google profile
          const refreshed = await pool.query(
            `UPDATE users
                SET display_name      = $1,
                    profile_image_url = $2,
                    updated_at        = NOW()
              WHERE google_id = $3
          RETURNING id, google_id, email, display_name, profile_image_url, created_at`,
            [name, avatarUrl, googleId]
          );
          return done(null, refreshed.rows[0]);
        }

        // ── Case B: email already exists (account linking) ───────────────────
        const byEmail = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        if (byEmail.rows.length > 0) {
          const linked = await pool.query(
            `UPDATE users
                SET google_id         = $1,
                    display_name      = $2,
                    profile_image_url = $3,
                    updated_at        = NOW()
              WHERE email = $4
          RETURNING id, google_id, email, display_name, profile_image_url, created_at`,
            [googleId, name, avatarUrl, email]
          );
          return done(null, linked.rows[0]);
        }

        // ── Case C: brand-new user ────────────────────────────────────────────
        const created = await pool.query(
          `INSERT INTO users (google_id, email, display_name, profile_image_url)
               VALUES ($1, $2, $3, $4)
           RETURNING id, google_id, email, display_name, profile_image_url, created_at`,
          [googleId, email, name, avatarUrl]
        );
        return done(null, created.rows[0]);

      } catch (err) {
        console.error('[Passport] Google OAuth error:', err);
        return done(err, null);
      }
    }
  )
);
