const mongoose = require('mongoose');

// Single global settings document (key: 'global'). Holds company/invoice
// details and scheduled-report configuration the admin can edit from the UI.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    company: {
      name: { type: String, default: 'The Cake Bake' },
      legalName: { type: String, default: '' },
      gstin: { type: String, default: '' },
      addressLine1: { type: String, default: '' },
      addressLine2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      invoicePrefix: { type: String, default: 'INV' },
      hsnCode: { type: String, default: '' },
      gstRate: { type: Number, default: 0 }, // percent; informational until tax is charged
    },
    reports: {
      dailyEnabled: { type: Boolean, default: false },
      recipients: [{ type: String, trim: true }],
      hour: { type: Number, default: 9, min: 0, max: 23 },
      lastSentYmd: { type: String, default: '' }, // guards against double-send per day
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
