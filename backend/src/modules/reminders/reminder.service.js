const Reminder = require('../../models/Reminder');
const ApiError = require('../../utils/ApiError');

class ReminderService {
  async getReminders(userId) {
    return Reminder.find({ user: userId, isActive: true }).sort({ date: 1 }).lean();
  }

  async createReminder(userId, data) {
    return Reminder.create({ ...data, user: userId });
  }

  async updateReminder(userId, reminderId, data) {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: reminderId, user: userId },
      data,
      { new: true, runValidators: true }
    );
    if (!reminder) throw ApiError.notFound('Reminder not found');
    return reminder;
  }

  async deleteReminder(userId, reminderId) {
    const reminder = await Reminder.findOneAndDelete({ _id: reminderId, user: userId });
    if (!reminder) throw ApiError.notFound('Reminder not found');
    return reminder;
  }
}

module.exports = new ReminderService();
