const reportService = require('../modules/admin/report.service');
const adminService = require('../modules/admin/admin.service');
const logger = require('../middleware/logger');

let intervalId = null;
let running = false;

const ymd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Runs hourly. Sends the daily report once, on/after the configured hour, and
// records the date so a restart or a second tick won't re-send.
const tick = async () => {
  if (running) return;
  running = true;
  try {
    const settings = await adminService.getSettings();
    if (!settings?.reports?.dailyEnabled) return;

    const now = new Date();
    const targetHour = Number.isInteger(settings.reports.hour) ? settings.reports.hour : 9;
    if (now.getHours() < targetHour) return;

    const today = ymd(now);
    if (settings.reports.lastSentYmd === today) return;

    const forDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result = await reportService.sendDailyReport(forDate);
    // Per-location digests to each zone's own recipients (in addition to the
    // global super-admin digest above).
    const locationResults = await reportService.sendLocationReports(forDate);

    // Mark sent regardless of email transport success so we don't loop retrying
    // a misconfigured SMTP every hour; failures are logged by the email service.
    const Settings = require('../models/Settings');
    await Settings.updateOne({ key: 'global' }, { $set: { 'reports.lastSentYmd': today } });
    logger.info(`[DailyReport] Daily report processed for ${today} (success=${!!result.success}, locations=${locationResults.length})`);
  } catch (error) {
    logger.error('[DailyReport] tick failed:', error.message);
  } finally {
    running = false;
  }
};

const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const start = () => {
  setTimeout(tick, 20000).unref();
  intervalId = setInterval(tick, 60 * 60 * 1000);
  intervalId.unref();
  logger.info('[DailyReport] Scheduler started (hourly check; sends when enabled in Settings)');
  return stop;
};

module.exports = { start, stop, runOnce: tick };
