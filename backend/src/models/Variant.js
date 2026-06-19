const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    weight: {
      type: String,
      required: [true, 'Weight is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    compareAtPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Make/buy cost of this variant in paise. Used for profit/margin reporting.
    // Snapshotted onto each order item at checkout so historical P&L stays
    // accurate when this value changes later.
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    stock: {
      type: Number,
      default: 999,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

variantSchema.index({ product: 1, isActive: 1 });
variantSchema.index({ isActive: 1, stock: 1, product: 1 });

module.exports = mongoose.model('Variant', variantSchema);
