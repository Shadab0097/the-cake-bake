const crypto = require('crypto');

const jobQueue = require('./jobQueue.service');
const logger = require('../middleware/logger');

const QUEUE_NAME = 'notifications';

const JOBS = {
  SEND_EMAIL: 'notification.send_email',
  SEND_WHATSAPP: 'notification.send_whatsapp',
};

const hashPayload = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');

const buildJobId = ({ channel, type, recipient, templateName, dedupeKey, payload }) => {
  const base = dedupeKey || hashPayload(payload);
  return `${channel}:${type}:${recipient}:${templateName}:${base}`.replace(/\s+/g, '_');
};

const enqueue = async (jobName, payload, { delay = 0, dedupeKey = '' } = {}) => {
  const channel = jobName === JOBS.SEND_EMAIL ? 'email' : 'whatsapp';
  const jobId = buildJobId({
    channel,
    type: payload.type,
    recipient: payload.recipient,
    templateName: payload.templateName,
    dedupeKey,
    payload,
  });

  try {
    return await jobQueue.add(QUEUE_NAME, jobName, {
      ...payload,
      idempotencyKey: payload.idempotencyKey || jobId,
    }, {
      jobId,
      delay,
    });
  } catch (err) {
    logger.warn(`[NotificationQueue] Failed to enqueue ${jobName}: ${err.message}`);
    return null;
  }
};

const enqueueEmail = (payload, options) => enqueue(JOBS.SEND_EMAIL, payload, options);

const enqueueWhatsApp = (payload, options) => enqueue(JOBS.SEND_WHATSAPP, payload, options);

module.exports = {
  JOBS,
  QUEUE_NAME,
  buildJobId,
  enqueueEmail,
  enqueueWhatsApp,
};
