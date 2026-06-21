const mongoose = require('mongoose');

// A Branch is a physical store / fulfilment location. It owns one or more
// DeliveryZones (1 branch : N zones via DeliveryZone.branchId). Per-location
// settings live here and override the global Settings singleton; blank fields
// fall back to global. Legal identity (company name / GSTIN / GST rate) stays
// global — a branch only overrides ship-from address + invoice prefix.
const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Branch name is required'],
      trim: true,
    },
    // Short human code, handy as an invoice-prefix suffix (e.g. 'ASR').
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    // Ship-from / origin address — printed as the seller address on invoices
    // for orders delivered to any zone under this branch.
    origin: {
      addressLine1: { type: String, default: '', trim: true },
      addressLine2: { type: String, default: '', trim: true },
      city: { type: String, default: '', trim: true },
      state: { type: String, default: '', trim: true },
      pincode: { type: String, default: '', trim: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    // Optional invoice-number prefix for this branch (else global company.invoicePrefix).
    invoicePrefix: { type: String, default: '', trim: true },
    // Branch-level Cash-on-Delivery default. Saving this writes through to all
    // of the branch's zones (DeliveryZone.codEnabled stays the enforcement
    // source of truth at checkout). Effective COD = global AND zone.
    codEnabled: { type: Boolean, default: true },
    // Per-location daily report: recipients + its own on/off switch (independent
    // of the global Daily Email Report toggle, which controls the super-admin
    // all-locations digest).
    reportRecipients: [{ type: String, trim: true }],
    reportEnabled: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);
