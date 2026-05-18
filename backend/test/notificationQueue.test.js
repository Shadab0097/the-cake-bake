const test = require('node:test');
const assert = require('node:assert/strict');

const { env } = require('../src/config/env');
const jobQueue = require('../src/jobs/jobQueue.service');
const notificationQueue = require('../src/jobs/notificationQueue');
const notificationService = require('../src/modules/notifications/notification.service');
const { NOTIFICATION_TYPES } = require('../src/utils/constants');

const waitFor = async (predicate, timeoutMs = 500) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for inline queue processor');
};

test.afterEach(async () => {
  await jobQueue.close();
});

test('notification job ids are deterministic and honor business dedupe keys', () => {
  const basePayload = {
    type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
    recipient: 'customer@example.com',
    templateName: 'order_confirmed',
    templateData: { orderNumber: 'TCB-1' },
  };

  const first = notificationQueue.buildJobId({
    channel: 'email',
    type: basePayload.type,
    recipient: basePayload.recipient,
    templateName: basePayload.templateName,
    payload: basePayload,
  });
  const second = notificationQueue.buildJobId({
    channel: 'email',
    type: basePayload.type,
    recipient: basePayload.recipient,
    templateName: basePayload.templateName,
    payload: { ...basePayload },
  });
  const changedPayload = notificationQueue.buildJobId({
    channel: 'email',
    type: basePayload.type,
    recipient: basePayload.recipient,
    templateName: basePayload.templateName,
    payload: { ...basePayload, templateData: { orderNumber: 'TCB-2' } },
  });
  const deduped = notificationQueue.buildJobId({
    channel: 'email',
    type: basePayload.type,
    recipient: basePayload.recipient,
    templateName: basePayload.templateName,
    dedupeKey: 'order:123:confirmation',
    payload: { ...basePayload, templateData: { orderNumber: 'TCB-999' } },
  });

  assert.equal(first, second);
  assert.notEqual(first, changedPayload);
  assert.equal(deduped, 'email:order_confirmed:customer@example.com:order_confirmed:order:123:confirmation');
});

test('inline notification queue injects idempotency key and processes asynchronously', async () => {
  const previousMode = env.jobs.queueMode;
  const previousWorkerEnabled = env.jobs.workerEnabled;
  env.jobs.queueMode = 'inline';
  env.jobs.workerEnabled = true;

  try {
    let processedJob = null;
    jobQueue.registerInlineProcessor(notificationQueue.QUEUE_NAME, async (job) => {
      processedJob = job;
    });

    const payload = {
      type: NOTIFICATION_TYPES.PASSWORD_RESET,
      recipient: 'customer@example.com',
      templateName: 'password_reset',
      templateData: { resetUrl: 'https://example.test/reset/token' },
    };
    const expectedJobId = notificationQueue.buildJobId({
      channel: 'email',
      type: payload.type,
      recipient: payload.recipient,
      templateName: payload.templateName,
      dedupeKey: 'password-reset:customer:token',
      payload,
    });

    const job = await notificationQueue.enqueueEmail(payload, {
      dedupeKey: 'password-reset:customer:token',
    });
    const observedJob = await waitFor(() => processedJob);

    assert.equal(job.id, expectedJobId);
    assert.equal(observedJob.name, notificationQueue.JOBS.SEND_EMAIL);
    assert.equal(observedJob.data.idempotencyKey, expectedJobId);
  } finally {
    env.jobs.queueMode = previousMode;
    env.jobs.workerEnabled = previousWorkerEnabled;
  }
});

test('queued notification processor maps email and WhatsApp payloads to senders', async () => {
  const originalSendEmail = notificationService._sendEmail;
  const originalSendWhatsApp = notificationService._sendWhatsApp;
  const calls = [];

  notificationService._sendEmail = async (args) => {
    calls.push({ channel: 'email', args });
    return { success: true };
  };
  notificationService._sendWhatsApp = async (args) => {
    calls.push({ channel: 'whatsapp', args });
    return { success: true };
  };

  try {
    await notificationService.processQueuedNotification(notificationQueue.JOBS.SEND_EMAIL, {
      userId: 'user-1',
      type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
      recipient: 'customer@example.com',
      templateName: 'order_confirmed',
      templateData: { orderNumber: 'TCB-1' },
      idempotencyKey: 'email-key',
    });
    await notificationService.processQueuedNotification(notificationQueue.JOBS.SEND_WHATSAPP, {
      userId: 'user-1',
      type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
      recipient: '+919999999999',
      templateName: 'order_confirmed',
      templateParams: ['TCB-1'],
      idempotencyKey: 'whatsapp-key',
    });

    assert.deepEqual(calls, [
      {
        channel: 'email',
        args: {
          userId: 'user-1',
          type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
          email: 'customer@example.com',
          templateKey: 'order_confirmed',
          templateData: { orderNumber: 'TCB-1' },
          idempotencyKey: 'email-key',
        },
      },
      {
        channel: 'whatsapp',
        args: {
          userId: 'user-1',
          type: NOTIFICATION_TYPES.ORDER_CONFIRMED,
          phone: '+919999999999',
          templateKey: 'order_confirmed',
          templateParams: ['TCB-1'],
          idempotencyKey: 'whatsapp-key',
        },
      },
    ]);
  } finally {
    notificationService._sendEmail = originalSendEmail;
    notificationService._sendWhatsApp = originalSendWhatsApp;
  }
});

test('queued notification processor rejects unknown job names', async () => {
  await assert.rejects(
    () => notificationService.processQueuedNotification('notification.unknown', {}),
    /Unknown notification job/
  );
});
