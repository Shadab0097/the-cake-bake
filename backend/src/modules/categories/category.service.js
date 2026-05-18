const Category = require('../../models/Category');
const ApiError = require('../../utils/ApiError');
const { generateSlug } = require('../../utils/helpers');
const uploadService = require('../media/upload.service');
const cache = require('../../utils/cache');

class CategoryService {
  async listCategories() {
    return cache.getOrSet('categories:list', () => {
      return Category.find({ isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
    }, 300);
  }

  async getCategoryBySlug(slug) {
    return cache.getOrSet(`categories:slug:${slug}`, async () => {
      const category = await Category.findOne({ slug, isActive: true }).lean();
      if (!category) throw ApiError.notFound('Category not found');
      return category;
    }, 300);
  }

  async createCategory(data) {
    data.slug = generateSlug(data.name);
    const existing = await Category.findOne({ slug: data.slug });
    if (existing) throw ApiError.conflict('Category with this name already exists');
    const category = await Category.create(data);
    await cache.invalidatePattern('categories:');
    await cache.invalidatePattern('products:');
    return category;
  }

  async updateCategory(id, data) {
    if (data.name) data.slug = generateSlug(data.name);
    const existingCategory = data.imagePublicId !== undefined
      ? await Category.findById(id).select('imagePublicId').lean()
      : null;
    const category = await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!category) throw ApiError.notFound('Category not found');
    if (
      existingCategory?.imagePublicId &&
      existingCategory.imagePublicId !== category.imagePublicId
    ) {
      uploadService.deleteImage(existingCategory.imagePublicId);
    }
    await cache.invalidatePattern('categories:');
    await cache.invalidatePattern('products:');
    return category;
  }

  async deleteCategory(id) {
    const category = await Category.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!category) throw ApiError.notFound('Category not found');
    await cache.invalidatePattern('categories:');
    await cache.invalidatePattern('products:');
    return category;
  }

  async getProductsByCategory(slug, query) {
    const Product = require('../../models/Product');
    const { parsePagination, paginatedResponse } = require('../../utils/pagination');
    const { page, limit, skip } = parsePagination(query);

    let sort = { sortOrder: 1, totalOrders: -1 };
    if (query.sort === 'price_asc') sort = { basePrice: 1 };
    if (query.sort === 'price_desc') sort = { basePrice: -1 };
    if (query.sort === 'rating') sort = { averageRating: -1 };
    if (query.sort === 'newest') sort = { createdAt: -1 };

    const cacheKey = cache.buildKey('categories:products', {
      slug,
      page,
      limit,
      sort: query.sort,
      isEggless: query.isEggless,
    });

    return cache.getOrSet(cacheKey, async () => {
      const category = await Category.findOne({ slug, isActive: true }).lean();
      if (!category) throw ApiError.notFound('Category not found');

      const filter = { category: category._id, isActive: true };
      if (query.isEggless === 'true') filter.isEggless = true;

      const [products, total] = await Promise.all([
        Product.find(filter).populate('category', 'name slug').sort(sort).skip(skip).limit(limit).lean(),
        Product.countDocuments(filter),
      ]);

      return { category, ...paginatedResponse(products, total, page, limit) };
    }, 60);
  }
}

module.exports = new CategoryService();
