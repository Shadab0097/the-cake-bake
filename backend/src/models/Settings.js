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
    // Storefront commerce controls (master switches enforced server-side).
    commerce: {
      // Global Cash-on-Delivery kill switch. When false, COD is rejected at
      // both checkout paths. NOTE: guest checkout is COD-only, so disabling
      // this prevents guest orders entirely (registered users can still pay
      // online).
      codEnabled: { type: Boolean, default: true },
    },
    // Store base / origin location. Used as the invoice "ship-from" and as the
    // foundation for future distance-based delivery pricing.
    storeLocation: {
      addressLine1: { type: String, default: '' },
      addressLine2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      defaultCity: { type: String, default: '' },
    },
    // Fallback branch for orders that resolve to no zone-branch (legacy data, or
    // serviceable cities not yet mapped to a branch). Null = those orders stay
    // owner-only (HQ bucket); set = they are auto-assigned to this branch.
    defaultBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
