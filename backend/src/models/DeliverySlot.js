const mongoose = require('mongoose');

const deliverySlotSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, 'Slot label is required'],
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    maxOrders: {
      type: Number,
      default: 50,
    },
    extraCharge: {
      type: Number,
      default: 0,
    },
    cities: [
      {
        type: String,
        trim: true,
      },
    ],
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

deliverySlotSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('DeliverySlot', deliverySlotSchema);
