const Joi = require('joi');
const { REMINDER_TYPES } = require('../../utils/constants');

const createReminder = {
  body: Joi.object({
    type: Joi.string().valid(...Object.values(REMINDER_TYPES)).required(),
    name: Joi.string().trim().required(),
    date: Joi.date().iso().required(),
    isRecurring: Joi.boolean().default(true),
    notifyDaysBefore: Joi.number().integer().min(0).max(30).default(3),
  }),
};

module.exports = { createReminder };
