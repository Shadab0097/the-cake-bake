const express = require('express');
const router = express.Router();
const notificationController = require('./notification.controller');
const { auth } = require('../../middleware/auth');

router.get('/', auth, notificationController.getUserNotifications);

module.exports = router;
