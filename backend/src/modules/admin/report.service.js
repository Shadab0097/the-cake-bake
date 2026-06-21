const adminService = require('./admin.service');
const emailService = require('../notifications/email.service');
const User = require('../../models/User');
const DeliveryZone = require('../../models/DeliveryZone');
const Branch = require('../../models/Branch');
const logger = require('../../middleware/logger');
const { startOfDay, endOfDay } = require('../../utils/helpers');

const rupees = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN')}`;
const ymd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// Recipients: explicit list from settings, else every super admin's email.
const resolveRecipients = async (settings) => {
  const configured = (settings?.reports?.recipients || []).filter(Boolean);
  if (configured.length) return configured;
  const supers = await User.find({ role: 'superadmin' }).select('email').lean();
  return supers.map((user) => user.email).filter(Boolean);
};

const row = (label, value, strong = false) => `
  <tr>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#444;${strong ? 'font-weight:700' : ''}">${label}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;${strong ? 'font-weight:800' : ''}">${value}</td>
  </tr>`;

const buildHtml = ({ dateLabel, sales, profit, company }) => {
  const s = sales.summary || {};
  const p = profit.summary || {};
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222">
    <h2 style="color:#D81B60;margin:0 0 4px">${company?.name || 'The Cake Bake'}</h2>
    <p style="margin:0 0 16px;color:#666">Daily report · <strong>${dateLabel}</strong></p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px;overflow:hidden">
      ${row('Revenue', rupees(s.revenue))}
      ${row('Orders', (s.orders || 0).toLocaleString('en-IN'))}
      ${row('Avg order value', rupees(s.aov))}
      ${row('Units sold', (s.units || 0).toLocaleString('en-IN'))}
      ${row('Gross sales', rupees(p.grossSales))}
      ${row('COGS', rupees(p.cogs))}
      ${row('Net profit', rupees(p.netProfit), true)}
      ${row('Margin', `${p.margin ?? 0}%`)}
    </table>
    <p style="margin:16px 0 0;color:#999;font-size:12px">
      Revenue counts paid orders (COD counts once delivered). Profit excludes GST &amp; delivery (pass-through).
      ${p.costCoverage != null && p.costCoverage < 100 ? `<br/>Note: only ${p.costCoverage}% of units have a cost set, so profit is overstated.` : ''}
    </p>
  </div>`;
};

// Build the data for a given calendar day (defaults to yesterday).
const buildDailyReport = async (forDate = new Date(Date.now() - 24 * 60 * 60 * 1000)) => {
  const from = ymd(startOfDay(forDate));
  const to = ymd(endOfDay(forDate));
  const [sales, profit, settings] = await Promise.all([
    adminService.getSalesAnalytics({ from, to }),
    adminService.getProfitAnalytics({ from, to }),
    adminService.getSettings(),
  ]);
  return { sales, profit, settings, dateLabel: from };
};

const sendDailyReport = async (forDate) => {
  const { sales, profit, settings, dateLabel } = await buildDailyReport(forDate);
  const recipients = await resolveRecipients(settings);
  if (!recipients.length) {
    logger.warn('[DailyReport] No recipients configured and no super admins found');
    return { success: false, reason: 'no_recipients' };
  }
  const subject = `${settings.company?.name || 'The Cake Bake'} — Daily report ${dateLabel}`;
  const html = buildHtml({ dateLabel, sales, profit, company: settings.company });
  const result = await emailService.sendMail(recipients, subject, html);
  return { ...result, recipients, dateLabel };
};

// Per-branch digests. Every active branch with its own report switched on and
// recipients set gets a digest scoped to the cities it owns (all its zones).
// Has its own on/off toggle, independent of the global Daily Email Report
// switch — the latter only governs the super-admin all-locations digest. These
// are additive, not a replacement.
const sendLocationReports = async (forDate = new Date(Date.now() - 24 * 60 * 60 * 1000)) => {
  const from = ymd(startOfDay(forDate));
  const to = ymd(endOfDay(forDate));
  const branches = await Branch.find({
    isActive: true,
    reportEnabled: true,
    reportRecipients: { $exists: true, $not: { $size: 0 } },
  }).lean();

  if (!branches.length) return [];

  const settings = await adminService.getSettings();
  const brand = settings.company?.name || 'The Cake Bake';
  const results = [];

  for (const branch of branches) {
    const recipients = (branch.reportRecipients || []).filter(Boolean);
    if (!recipients.length) continue;
    try {
      // The cities this branch is responsible for (its zones).
      const zones = await DeliveryZone.find({ branchId: branch._id }).select('city').lean();
      const cities = [...new Set(zones.map((z) => z.city).filter(Boolean))];
      if (!cities.length) {
        logger.warn(`[DailyReport] Branch "${branch.name}" has no zones; skipping its report`);
        continue;
      }
      // branchId is authoritative (snapshotted on orders); cities also passed so
      // legacy orders without a branch snapshot are still counted by city.
      const [sales, profit] = await Promise.all([
        adminService.getSalesAnalytics({ from, to, branchId: branch._id, cities }),
        adminService.getProfitAnalytics({ from, to, branchId: branch._id, cities }),
      ]);
      const subject = `${brand} · ${branch.name} — Daily report ${from}`;
      const html = buildHtml({ dateLabel: `${from} · ${branch.name}`, sales, profit, company: settings.company });
      const result = await emailService.sendMail(recipients, subject, html);
      results.push({ branch: branch.name, recipients, success: !!result.success });
    } catch (error) {
      logger.error(`[DailyReport] Branch report failed for ${branch.name}: ${error.message}`);
      results.push({ branch: branch.name, recipients, success: false });
    }
  }
  return results;
};

module.exports = { buildDailyReport, sendDailyReport, sendLocationReports, resolveRecipients };
