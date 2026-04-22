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
