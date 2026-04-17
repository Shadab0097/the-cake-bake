const mongoose = require('mongoose');
const { REMINDER_TYPES } = require('../utils/constants');

const reminderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(REMINDER_TYPES),
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Reminder name is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    isRecurring: {
      type: Boolean,
      default: true,
    },
    notifyDaysBefore: {
      type: Number,
      default: 3,
      min: 0,
      max: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

reminderSchema.index({ user: 1, isActive: 1, date: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
