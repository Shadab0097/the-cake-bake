const jobQueue = require('./jobQueue.service');
const notificationQueue = require('./notificationQueue');
const notificationService = require('../modules/notifications/notification.service');

const processJob = async (job) => {
  await notificationService.processQueuedNotification(job.name, job.data);
};

const start = () => jobQueue.startWorker(notificationQueue.QUEUE_NAME, processJob);

module.exports = {
  processJob,
  start,
};
