const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    shortDescription: {
      type: String,
      default: '',
      maxlength: 300,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    occasions: [
      {
        type: String,
        trim: true,
      },
    ],
    flavors: [
      {
        type: String,
        trim: true,
      },
    ],
    basePrice: {
      type: Number,
      required: [true, 'Base price is required'],
      min: 0,
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String, default: '' },
        alt: { type: String, default: '' },
        sortOrder: { type: Number, default: 0 },
      },
    ],
    isEggless: {
      type: Boolean,
      default: false,
    },
    hasEgglessOption: {
      type: Boolean,
      default: true,
    },
    egglessExtraPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVeg: {
      type: Boolean,
      default: true,
    },
    minWeight: {
      type: String,
      default: '0.5 kg',
    },
    allowCustomMessage: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
      min: 0,
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
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      keywords: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: variants
productSchema.virtual('variants', {
  ref: 'Variant',
  localField: '_id',
  foreignField: 'product',
});

// Virtual: reviews
productSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'product',
});

// Compound indexes for filtering + sorting
productSchema.index({ category: 1, isActive: 1, basePrice: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ isActive: 1, totalOrders: -1 });
productSchema.index({ isActive: 1, averageRating: -1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ tags: 1, isActive: 1 });
productSchema.index({ occasions: 1, isActive: 1 });
productSchema.index({ flavors: 1 });
productSchema.index({ cities: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Product', productSchema);
