const mongoose = require('mongoose');
const { ORDER_STATUSES } = require('../utils/constants');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    weight: { type: String, default: '' },
    flavor: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true }, // unit price at order time (paise)
    isEggless: { type: Boolean, default: false },
    cakeMessage: { type: String, default: '' },
    addOns: [
      {
        name: { type: String },
        price: { type: Number },
      },
    ],
  },
  { _id: true }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,   // null for guest orders
      default: null,
      index: true,
    },
    // Guest contact info (populated when user is null)
    guestInfo: {
      name:  { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      landmark: { type: String, default: '' },
    },
    deliveryDate: {
      type: Date,
      required: true,
      index: true,
    },
    deliverySlot: {
      label: { type: String },
      startTime: { type: String },
      endTime: { type: String },
    },
    deliveryCity: {
      type: String,
      index: true,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    couponCode: {
      type: String,
      default: '',
    },
    pointsRedeemed: {
      type: Number,
      default: 0,
    },
    pointsDiscount: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUSES),
      default: ORDER_STATUSES.PENDING,
      index: true,
    },
    statusHistory: [statusHistorySchema],
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'online'],
      default: 'cod',
    },
    specialInstructions: {
      type: String,
      maxlength: 500,
      default: '',
    },
    isGift: {
      type: Boolean,
      default: false,
    },
    giftMessage: {
      type: String,
      maxlength: 300,
      default: '',
    },
  },
  { timestamps: true }
);

// Compound indexes
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, deliveryDate: 1 });
orderSchema.index({ deliveryCity: 1, deliveryDate: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
