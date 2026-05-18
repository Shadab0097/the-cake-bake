const mongoose = require('mongoose');

const reservationItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Variant',
      required: true,
    },
    weight: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const inventoryReservationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    guestEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
    },
    guestPhone: {
      type: String,
      default: '',
      trim: true,
    },
    items: [reservationItemSchema],
    status: {
      type: String,
      enum: ['reserved', 'confirmed', 'released', 'expired'],
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    confirmedAt: {
      type: Date,
    },
    releasedAt: {
      type: Date,
    },
    reason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

inventoryReservationSchema.index({ status: 1, expiresAt: 1 });
inventoryReservationSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('InventoryReservation', inventoryReservationSchema);
