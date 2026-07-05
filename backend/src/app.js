const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');

// Import configurations
require('./config/passport'); 
require('dotenv').config();

// Import Routes
const authRoutes = require('./routes/auth.routes');
const linkRoutes = require('./routes/link.routes');
const redirectRoutes = require('./routes/redirect.routes');
const analyticsRoutes = require('./routes/analytics.routes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Session setup for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecret_session_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/analytics', analyticsRoutes);

// Redirect Route (Has to be at the root, or at a specific short domain path)
app.use('/', redirectRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = app;
