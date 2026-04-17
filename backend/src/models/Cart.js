const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Variant',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
      default: 1,
    },
    addOns: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AddOn',
      },
    ],
    cakeMessage: {
      type: String,
      maxlength: 100,
      default: '',
    },
    isEggless: {
      type: Boolean,
      default: false,
    },
    // Snapshots for price stability
    snapshotName: { type: String },
    snapshotPrice: { type: Number },
    snapshotImage: { type: String },
  },
  { _id: true, timestamps: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: [cartItemSchema],
    appliedCoupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    deliveryNotes: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
