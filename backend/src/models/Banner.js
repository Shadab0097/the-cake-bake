const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
    },
    subtitle: {
      type: String,
      default: '',
    },
    image: {
      desktop: { type: String, default: '' },
      mobile: { type: String, default: '' },
    },
    link: {
      type: String,
      default: '',
    },
    position: {
      type: String,
      enum: ['hero', 'category', 'promo', 'sidebar'],
      default: 'hero',
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
  },
  { timestamps: true }
);

bannerSchema.index({ position: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Banner', bannerSchema);
