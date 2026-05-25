const allowedRoles = new Set(['all', 'web', 'worker', 'scheduler']);
const role = String(process.argv[2] || '').trim().toLowerCase();

if (!allowedRoles.has(role)) {
  console.error(`Usage: node scripts/start-role.js <${[...allowedRoles].join('|')}>`);
  process.exit(1);
}

process.env.PROCESS_ROLE = role;
require('../server');
