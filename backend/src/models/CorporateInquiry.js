const mongoose = require('mongoose');
const { INQUIRY_STATUSES } = require('../utils/constants');

const corporateInquirySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    contactName: {
      type: String,
      required: [true, 'Contact name is required'],
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
    eventType: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    budget: {
      type: String,
      default: '',
    },
    deliveryDate: {
      type: Date,
    },
    city: {
      type: String,
      default: '',
    },
    requirements: {
      type: String,
      required: [true, 'Requirements description is required'],
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

corporateInquirySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CorporateInquiry', corporateInquirySchema);
