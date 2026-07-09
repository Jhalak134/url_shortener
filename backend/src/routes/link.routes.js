const express = require('express');
const { createLink, getLinks } = require('../controllers/link.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { createLinkLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

// Publicly available to create links — rate-limited to prevent spam
router.post('/', createLinkLimiter, createLink);

// Protected route to get user's links
router.get('/', requireAuth, getLinks);

module.exports = router;
