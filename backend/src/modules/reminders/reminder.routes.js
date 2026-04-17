const express = require('express');
const router = express.Router();
const reminderController = require('./reminder.controller');
const validate = require('../../middleware/validate');
const reminderValidation = require('./reminder.validation');
const { auth } = require('../../middleware/auth');

router.use(auth);

router.get('/', reminderController.getReminders);
router.post('/', validate(reminderValidation.createReminder), reminderController.createReminder);
router.put('/:id', reminderController.updateReminder);
router.delete('/:id', reminderController.deleteReminder);

module.exports = router;
