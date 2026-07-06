const express = require('express');
const { createLink, getLinks } = require('../controllers/link.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Publicly available to create links (user_id will be null if not logged in)
router.post('/', createLink);

// Protected route to get user's links
router.get('/', requireAuth, getLinks);

module.exports = router;
