const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./db');
require('dotenv').config();

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, rows[0]);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_ID',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'PLACEHOLDER_SECRET',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, displayName, emails, photos } = profile;
        const email = emails[0].value;
        const photoUrl = photos[0].value;

        // Check if user already exists
        let { rows } = await pool.query('SELECT * FROM users WHERE google_id = $1', [id]);

        if (rows.length === 0) {
          // Check if email exists (user might have signed up differently, though we only have google auth now)
          const emailCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
          
          if (emailCheck.rows.length > 0) {
            // Update existing user with google_id
            const updatedUser = await pool.query(
              'UPDATE users SET google_id = $1, display_name = $2, profile_image_url = $3 WHERE email = $4 RETURNING *',
              [id, displayName, photoUrl, email]
            );
            return done(null, updatedUser.rows[0]);
          }

          // Create new user
          const newUser = await pool.query(
            'INSERT INTO users (google_id, email, display_name, profile_image_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, email, displayName, photoUrl]
          );
          return done(null, newUser.rows[0]);
        }

        return done(null, rows[0]);
      } catch (err) {
        console.error('Error during Google OAuth:', err);
        return done(err, null);
      }
    }
  )
);
