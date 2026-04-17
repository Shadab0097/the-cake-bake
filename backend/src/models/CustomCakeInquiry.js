const mongoose = require('mongoose');
const { INQUIRY_STATUSES } = require('../utils/constants');

const customCakeInquirySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    occasion: {
      type: String,
      default: '',
    },
    flavor: {
      type: String,
      default: '',
    },
    weight: {
      type: String,
      default: '',
    },
    servingCount: {
      type: Number,
      default: 0,
    },
    designDescription: {
      type: String,
      required: [true, 'Design description is required'],
    },
    referenceImages: [
      {
        type: String,
      },
    ],
    deliveryDate: {
      type: Date,
    },
    city: {
      type: String,
      default: '',
    },
    budget: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(INQUIRY_STATUSES),
      default: INQUIRY_STATUSES.NEW,
      index: true,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    quotedPrice: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

customCakeInquirySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CustomCakeInquiry', customCakeInquirySchema);
