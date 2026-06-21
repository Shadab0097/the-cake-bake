const mongoose = require('mongoose');
const { ORDER_SOURCES, ORDER_STATUSES } = require('../utils/constants');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Variant',
    },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    weight: { type: String, default: '' },
    flavor: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true }, // unit price at order time (paise)
    cost: { type: Number, default: 0 }, // unit cost at order time (paise) — for profit reporting
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
    guestTrackingTokenHash: {
      type: String,
      default: '',
      select: false,
    },
    guestTrackingTokenIssuedAt: {
      type: Date,
      select: false,
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
    // Snapshot of the fulfilling store at checkout (zone.branchId at the time
    // the order was placed). Authoritative for location-wise reporting and the
    // invoice ship-from — survives later zone→branch reassignment or city
    // renames. Null for guest/inquiry orders whose city matched no branch, and
    // for legacy orders placed before this field existed (those fall back to
    // resolving by deliveryCity).
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
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
      enum: ['pending', 'paid', 'failed', 'expired', 'refunded'],
      default: 'pending',
    },
    refundStatus: {
      type: String,
      enum: ['', 'requested', 'approved', 'processing', 'refunded', 'failed'],
      default: '',
      index: true,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'online'],
      default: 'cod',
    },
    source: {
      type: String,
      enum: Object.values(ORDER_SOURCES),
      default: ORDER_SOURCES.CATALOG,
      index: true,
    },
    sourceInquiryType: {
      type: String,
      enum: ['', 'custom_cake', 'corporate'],
      default: '',
    },
    sourceInquiry: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    sourceQuote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InquiryQuote',
      default: null,
      index: true,
    },
    cancellation: {
      requestedBy: {
        type: String,
        enum: ['', 'customer', 'admin', 'system'],
        default: '',
      },
      reason: { type: String, default: '' },
      cancelledAt: { type: Date },
      policyCode: { type: String, default: '' },
    },
    checkoutIp: {
      type: String,
      default: '',
    },
    checkoutUserAgent: {
      type: String,
      default: '',
    },
    codRisk: {
      normalizedPhone: { type: String, default: '' },
      normalizedEmail: { type: String, default: '' },
      addressHash: { type: String, default: '' },
      score: { type: Number, default: 0 },
      decision: {
        type: String,
        enum: ['allow', 'review', 'online_required'],
        default: 'allow',
      },
      flags: [{ type: String }],
      evaluatedAt: { type: Date },
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
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ status: 1, deliveryDate: 1 });
orderSchema.index({ deliveryCity: 1, deliveryDate: 1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'guestInfo.email': 1, createdAt: -1 });
orderSchema.index({ 'guestInfo.phone': 1, createdAt: -1 });
orderSchema.index({ 'shippingAddress.phone': 1, createdAt: -1 });
orderSchema.index({ paymentMethod: 1, 'codRisk.normalizedPhone': 1, createdAt: -1 });
orderSchema.index({ paymentMethod: 1, checkoutIp: 1, createdAt: -1 });
orderSchema.index({ paymentMethod: 1, 'codRisk.addressHash': 1, status: 1, createdAt: -1 });
orderSchema.index({ source: 1, createdAt: -1 });
orderSchema.index(
  { guestTrackingTokenHash: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { guestTrackingTokenHash: { $type: 'string', $gt: '' } },
  }
);

module.exports = mongoose.model('Order', orderSchema);
