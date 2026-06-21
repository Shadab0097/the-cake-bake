const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      index: true,
    },
    pincodes: [
      {
        type: String,
        trim: true,
      },
    ],
    areas: [
      {
        type: String,
        trim: true,
      },
    ],
    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    freeDeliveryAbove: {
      type: Number,
      default: 0,
    },
    sameDayAvailable: {
      type: Boolean,
      default: true,
    },
    sameDayCutoffTime: {
      type: String,
      default: '14:00',
    },
    // Per-zone Cash-on-Delivery switch. Effective COD availability is
    // (global commerce.codEnabled) AND (zone.codEnabled). Defaults to true so
    // existing zones keep offering COD after this field is added.
    codEnabled: {
      type: Boolean,
      default: true,
    },
    // Owning branch / store. Per-location settings (ship-from address, invoice
    // prefix, report recipients, COD default) live on the Branch; this links a
    // delivery area to the store that fulfils it. Null = unassigned (falls back
    // to global Settings on invoices).
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    // 'live' = delivering now; 'coming_soon' = configured but not yet serviceable.
    // Coming-soon zones are excluded from the public checkout zone list but are
    // still matched by check-pincode so the storefront can show a teaser.
    status: {
      type: String,
      enum: ['live', 'coming_soon'],
      default: 'live',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

deliveryZoneSchema.index({ city: 1, isActive: 1 });
deliveryZoneSchema.index({ pincodes: 1 });

module.exports = mongoose.model('DeliveryZone', deliveryZoneSchema);
