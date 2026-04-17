const Product = require('../../models/Product');
const Variant = require('../../models/Variant');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const { generateSlug, escapeRegex } = require('../../utils/helpers');
const cache = require('../../utils/cache');

class ProductService {
  /**
   * List products with filters, sorting, and pagination
   */
  async listProducts(query) {
    const { page, limit, skip } = parsePagination(query);

    const filter = { isActive: true };

    if (query.category) filter.category = query.category;
    if (query.occasion) filter.occasions = query.occasion;
    if (query.flavor) filter.flavors = query.flavor;
    if (query.isEggless === 'true') filter.isEggless = true;
    if (query.hasEgglessOption === 'true') filter.hasEgglessOption = true;
    if (query.isFeatured === 'true') filter.isFeatured = true;
    if (query.city) filter.cities = query.city;
    if (query.tag) filter.tags = query.tag;

    // Price range (basePrice is in paise)
    if (query.minPrice || query.maxPrice) {
      filter.basePrice = {};
      if (query.minPrice) filter.basePrice.$gte = parseInt(query.minPrice, 10);
      if (query.maxPrice) filter.basePrice.$lte = parseInt(query.maxPrice, 10);
    }

    // Sorting
    let sort = {};
    switch (query.sort) {
      case 'price_asc': sort = { basePrice: 1 }; break;
      case 'price_desc': sort = { basePrice: -1 }; break;
      case 'popularity': sort = { totalOrders: -1 }; break;
      case 'rating': sort = { averageRating: -1 }; break;
      case 'newest': sort = { createdAt: -1 }; break;
      default: sort = { sortOrder: 1, createdAt: -1 };
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .populate({ path: 'variants', match: { isActive: true }, options: { sort: { price: 1 } } })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return paginatedResponse(products, total, page, limit);
  }

  /**
   * Search products using text index
   */
  async searchProducts(query) {
    const { page, limit, skip } = parsePagination(query);
    const searchTerm = query.q;

    if (!searchTerm) throw ApiError.badRequest('Search term is required');

    const filter = {
      isActive: true,
      $text: { $search: searchTerm },
    };

    const [products, total] = await Promise.all([
      Product.find(filter, { score: { $meta: 'textScore' } })
        .populate('category', 'name slug')
        .populate({ path: 'variants', match: { isActive: true }, options: { sort: { price: 1 } } })
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return paginatedResponse(products, total, page, limit);
  }

  /**
   * Get product by slug with variants and reviews
   */
  async getProductBySlug(slug) {
    const cacheKey = `products:slug:${slug}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const product = await Product.findOne({ slug, isActive: true })
      .populate('category', 'name slug')
      .populate({
        path: 'variants',
        match: { isActive: true },
        options: { sort: { price: 1 } },
      })
      .lean();

    if (!product) throw ApiError.notFound('Product not found');
    cache.set(cacheKey, product, 120); // Cache 2 minutes
    return product;
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(limit = 12) {
    return cache.getOrSet(`products:featured:${limit}`, () => {
      return Product.find({ isActive: true, isFeatured: true })
        .populate('category', 'name slug')
        .populate({ path: 'variants', match: { isActive: true }, options: { sort: { price: 1 } } })
        .sort({ sortOrder: 1, createdAt: -1 })
        .limit(limit)
        .lean();
    }, 120); // Cache 2 minutes
  }

  /**
   * Get bestsellers
   */
  async getBestsellers(limit = 12) {
    return cache.getOrSet(`products:bestsellers:${limit}`, () => {
      return Product.find({ isActive: true })
        .populate('category', 'name slug')
        .populate({ path: 'variants', match: { isActive: true }, options: { sort: { price: 1 } } })
        .sort({ totalOrders: -1 })
        .limit(limit)
        .lean();
    }, 120); // Cache 2 minutes
  }

  /**
   * Get trending / new arrivals
   */
  async getTrending(limit = 12) {
    return cache.getOrSet(`products:trending:${limit}`, () => {
      return Product.find({ isActive: true, tags: 'trending' })
        .populate('category', 'name slug')
        .populate({ path: 'variants', match: { isActive: true }, options: { sort: { price: 1 } } })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    }, 120); // Cache 2 minutes
  }

  /**
   * Get products by occasion
   */
  async getByOccasion(occasion, query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = { isActive: true, occasions: occasion };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .populate({ path: 'variants', match: { isActive: true }, options: { sort: { price: 1 } } })
        .sort({ totalOrders: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return paginatedResponse(products, total, page, limit);
  }

  /**
   * Admin: Create product
   */
  async createProduct(data) {
    data.slug = generateSlug(data.name);

    // Ensure unique slug
    const existing = await Product.findOne({ slug: data.slug });
    if (existing) {
      data.slug = `${data.slug}-${Date.now()}`;
    }

    const product = await Product.create(data);

    // Create variants if provided
    if (data.variants && data.variants.length > 0) {
      const variants = data.variants.map((v) => {
        const variant = { ...v, product: product._id };
        // Remove empty sku to avoid duplicate key errors on sparse unique index
        if (!variant.sku) delete variant.sku;
        return variant;
      });
      await Variant.insertMany(variants);
    }

    // Invalidate product caches
    cache.invalidatePattern('products:');

    return product;
  }

  /**
   * Admin: Update product
   */
  async updateProduct(productId, data) {
    if (data.name) {
      data.slug = generateSlug(data.name);
    }

    const product = await Product.findByIdAndUpdate(productId, data, {
      new: true,
      runValidators: true,
    });

    if (!product) throw ApiError.notFound('Product not found');
    cache.invalidatePattern('products:');
    return product;
  }

  /**
   * Admin: Soft delete product
   */
  async deleteProduct(productId) {
    const product = await Product.findByIdAndUpdate(productId, { isActive: false }, { new: true });
    if (!product) throw ApiError.notFound('Product not found');
    cache.invalidatePattern('products:');
    return product;
  }

  /**
   * Admin: Add variant to product
   */
  async addVariant(productId, data) {
    const product = await Product.findById(productId);
    if (!product) throw ApiError.notFound('Product not found');

    return Variant.create({ ...data, product: productId });
  }

  /**
   * Admin: Update variant
   */
  async updateVariant(productId, variantId, data) {
    const variant = await Variant.findOneAndUpdate(
      { _id: variantId, product: productId },
      data,
      { new: true, runValidators: true }
    );
    if (!variant) throw ApiError.notFound('Variant not found');
    return variant;
  }

  /**
   * Admin: List all products (including inactive)
   */
  async adminListProducts(query) {
    const { page, limit, skip } = parsePagination(query);
    const filter = {};

    if (query.category) filter.category = query.category;
    if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
    if (query.search) {
      const safeSearch = escapeRegex(query.search);
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { tags: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return paginatedResponse(products, total, page, limit);
  }
}

module.exports = new ProductService();
