const express = require('express');
const { getLinkAnalytics } = require('../controllers/analytics.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Protected route to get analytics for a specific link
router.get('/:shortCode', requireAuth, getLinkAnalytics);

module.exports = router;
