const reminderService = require('./reminder.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const getReminders = asyncHandler(async (req, res) => {
  const reminders = await reminderService.getReminders(req.user._id);
  ApiResponse.ok(reminders).send(res);
});

const createReminder = asyncHandler(async (req, res) => {
  const reminder = await reminderService.createReminder(req.user._id, req.body);
  ApiResponse.created(reminder, 'Reminder created').send(res);
});

const updateReminder = asyncHandler(async (req, res) => {
  const reminder = await reminderService.updateReminder(req.user._id, req.params.id, req.body);
  ApiResponse.ok(reminder, 'Reminder updated').send(res);
});

const deleteReminder = asyncHandler(async (req, res) => {
  await reminderService.deleteReminder(req.user._id, req.params.id);
  ApiResponse.ok(null, 'Reminder deleted').send(res);
});

module.exports = { getReminders, createReminder, updateReminder, deleteReminder };
