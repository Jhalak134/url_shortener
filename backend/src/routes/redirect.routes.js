const express = require('express');
const { handleRedirect } = require('../controllers/redirect.controller');

const router = express.Router();

// The redirect route catches any alphanumeric string
router.get('/:shortCode([a-zA-Z0-9]+)', handleRedirect);

module.exports = router;
