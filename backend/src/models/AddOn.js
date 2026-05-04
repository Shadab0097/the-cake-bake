const mongoose = require('mongoose');
const { ADDON_CATEGORIES } = require('../utils/constants');

const addOnSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Add-on name is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    imagePublicId: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    category: {
      type: String,
      enum: ADDON_CATEGORIES,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

addOnSchema.index({ category: 1, isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('AddOn', addOnSchema);
