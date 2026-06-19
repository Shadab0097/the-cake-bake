const Product = require('../../models/Product');
const Variant = require('../../models/Variant');
const ApiError = require('../../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../../utils/pagination');
const { generateSlug, escapeRegex } = require('../../utils/helpers');
const cache = require('../../utils/cache');
const uploadService = require('../media/upload.service');

const SEARCH_MAX_LENGTH = 80;

// Public catalog reads are cache-fronted and tolerate brief replication lag, so
// route them to replicas to keep read load off the primary (which handles
// checkout transactions). Falls back to primary automatically if no secondary
// exists. NEVER use for admin reads or anything checkout-authoritative.
const READ_SECONDARY = 'secondaryPreferred';

const sanitizeSearchTerm = (value) => String(value || '')
  .normalize('NFKC')
  .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, SEARCH_MAX_LENGTH);

const sanitizeFilterValue = (value, maxLength = SEARCH_MAX_LENGTH) => {
  if (value === undefined || value === null) return '';
  return String(value)
    .normalize('NFKC')
    .replace(/[\0\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const parsePriceBound = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const buildProductSort = (sortKey, hasTextSearch = false) => {
  switch (sortKey) {
    case 'price_asc': return { basePrice: 1 };
    case 'price_desc': return { basePrice: -1 };
    case 'popularity': return { totalOrders: -1 };
    case 'rating': return { averageRating: -1 };
    case 'newest': return { createdAt: -1 };
    default:
      return hasTextSearch ? { score: { $meta: 'textScore' } } : { sortOrder: 1, createdAt: -1 };
  }
};

const buildProductFilter = (query = {}, options = {}) => {
  const { includeTextSearch = false, productIds = null } = options;
  const filter = { isActive: true };
  const searchTerm = sanitizeSearchTerm(query.q || query.search || '');
  const category = sanitizeFilterValue(query.category);
  const occasion = sanitizeFilterValue(query.occasion);
  const flavor = sanitizeFilterValue(query.flavor);
  const city = sanitizeFilterValue(query.city);
  const tag = sanitizeFilterValue(query.tag || query.tags);

  if (includeTextSearch && searchTerm) filter.$text = { $search: searchTerm };
  if (category) filter.category = category;
  if (occasion) filter.occasions = occasion;
  if (flavor) filter.flavors = flavor;
  if (query.isEggless === 'true') filter.isEggless = true;
  if (query.hasEgglessOption === 'true') filter.hasEgglessOption = true;
  if (query.isFeatured === 'true') filter.isFeatured = true;
  if (city) filter.cities = city;
  if (tag) filter.tags = tag;

  const minPrice = parsePriceBound(query.minPrice);
  const maxPrice = parsePriceBound(query.maxPrice);
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.basePrice = {};
    if (minPrice !== undefined) filter.basePrice.$gte = minPrice;
    if (maxPrice !== undefined) filter.basePrice.$lte = maxPrice;
  }

  if (productIds) {
    filter._id = { $in: productIds };
  }

  return { filter, searchTerm };
};

class ProductService {
  /**
   * List products with filters, sorting, and pagination
   */
  async listProducts(query) {
    const { page, limit, skip } = parsePagination(query);
    const availableOnly = query.available === 'true';
    const sort = buildProductSort(query.sort);

    // Cache product listings for 60 seconds — key includes all query params
    const cacheKey = cache.buildKey('products:list', {
      page, limit,
      category: query.category, occasion: query.occasion, flavor: query.flavor,
      isEggless: query.isEggless, hasEgglessOption: query.hasEgglessOption,
      isFeatured: query.isFeatured, city: query.city, tag: query.tag,
      tags: query.tags,
      minPrice: query.minPrice, maxPrice: query.maxPrice, sort: query.sort,
      available: query.available,
    });

    return cache.getOrSet(cacheKey, async () => {
      const productIds = availableOnly
        ? await Variant.distinct('product', { isActive: true, stock: { $gt: 0 } })
        : null;
      const { filter } = buildProductFilter(query, { productIds });
      const variantMatch = availableOnly
        ? { isActive: true, stock: { $gt: 0 } }
        : { isActive: true };
      const [products, total] = await Promise.all([
        Product.find(filter)
          .read(READ_SECONDARY)
          .populate('category', 'name slug')
          .populate({ path: 'variants', match: variantMatch, options: { sort: { price: 1 } } })
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter),
      ]);
      return paginatedResponse(products, total, page, limit);
    }, 60); // Cache 60 seconds
  }

  /**
   * Search products using text index
   */
  async searchProducts(query) {
    const { page, limit, skip } = parsePagination(query);
    const availableOnly = query.available === 'true';
    const { filter: validationFilter, searchTerm } = buildProductFilter(query, {
      includeTextSearch: true,
    });

    const hasFilter = Object.keys(validationFilter).some((key) => !['isActive', '_id'].includes(key));
    if (!searchTerm && !hasFilter && !availableOnly) {
      throw ApiError.badRequest('Search term or filter is required', [], 'SEARCH_QUERY_REQUIRED');
    }
    if (query.q && searchTerm.length < 2) {
      throw ApiError.badRequest(
        'Search term must contain at least 2 searchable characters',
        [{ field: 'q', code: 'SEARCH_TERM_TOO_SHORT', message: 'Search term must contain at least 2 searchable characters' }],
        'SEARCH_TERM_TOO_SHORT'
      );
    }

    const hasTextSearch = Boolean(validationFilter.$text);
    const sort = buildProductSort(query.sort, hasTextSearch);
    const projection = hasTextSearch ? { score: { $meta: 'textScore' } } : {};
    const cacheKey = cache.buildKey('products:search', {
      page, limit,
      q: searchTerm,
      category: query.category, occasion: query.occasion, flavor: query.flavor,
      isEggless: query.isEggless, hasEgglessOption: query.hasEgglessOption,
      isFeatured: query.isFeatured, city: query.city,
      tag: query.tag, tags: query.tags, available: query.available,
      minPrice: query.minPrice, maxPrice: query.maxPrice, sort: query.sort,
    });

    return cache.getOrSet(cacheKey, async () => {
      const productIds = availableOnly
        ? await Variant.distinct('product', { isActive: true, stock: { $gt: 0 } })
        : null;
      const { filter } = buildProductFilter(query, {
        includeTextSearch: true,
        productIds,
      });
      const variantMatch = availableOnly
        ? { isActive: true, stock: { $gt: 0 } }
        : { isActive: true };
      const [products, total] = await Promise.all([
        Product.find(filter, projection)
          .read(READ_SECONDARY)
          .populate('category', 'name slug')
          .populate({ path: 'variants', match: variantMatch, options: { sort: { price: 1 } } })
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(filter),
      ]);

      return paginatedResponse(products, total, page, limit);
    }, 60);
  }

  /**
   * Get product by slug with variants and reviews
   */
  async getProductBySlug(slug) {
    const cacheKey = `products:slug:${slug}`;
    return cache.getOrSet(cacheKey, async () => {
      const product = await Product.findOne({ slug, isActive: true })
        .read(READ_SECONDARY)
        .populate('category', 'name slug')
        .populate({
          path: 'variants',
          match: { isActive: true },
          options: { sort: { price: 1 } },
        })
        .lean();

      if (!product) throw ApiError.notFound('Product not found', [], 'PRODUCT_NOT_FOUND');
      return product;
    }, 120); // Cache 2 minutes
  }

  /**
   * Get featured products
   */
  async getFeaturedProducts(limit = 12) {
    return cache.getOrSet(`products:featured:${limit}`, () => {
      return Product.find({ isActive: true, isFeatured: true })
        .read(READ_SECONDARY)
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
        .read(READ_SECONDARY)
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
        .read(READ_SECONDARY)
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

    const cacheKey = cache.buildKey('products:occasion', {
      occasion,
      page,
      limit,
      sort: query.sort,
    });

    return cache.getOrSet(cacheKey, async () => {
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
    }, 60);
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
    await cache.invalidatePattern('products:');

    return product;
  }

  /**
   * Admin: Update product
   */
  async updateProduct(productId, data) {
    if (data.name) {
      data.slug = generateSlug(data.name);
    }

    const existingProduct = data.images
      ? await Product.findById(productId).select('images.publicId').lean()
      : null;

    const product = await Product.findByIdAndUpdate(productId, data, {
      new: true,
      runValidators: true,
    });

    if (!product) throw ApiError.notFound('Product not found', [], 'PRODUCT_NOT_FOUND');

    if (existingProduct?.images && data.images) {
      const nextPublicIds = new Set((product.images || []).map((image) => image.publicId).filter(Boolean));
      const stalePublicIds = existingProduct.images
        .map((image) => image.publicId)
        .filter((publicId) => publicId && !nextPublicIds.has(publicId));
      uploadService.deleteImages(stalePublicIds);
    }

    await cache.invalidatePattern('products:');
    return product;
  }

  /**
   * Admin: Soft delete product
   */
  async deleteProduct(productId) {
    const product = await Product.findByIdAndUpdate(productId, { isActive: false }, { new: true });
    if (!product) throw ApiError.notFound('Product not found', [], 'PRODUCT_NOT_FOUND');
    await cache.invalidatePattern('products:');
    return product;
  }

  /**
   * Admin: Add variant to product
   */
  async addVariant(productId, data) {
    const product = await Product.findById(productId);
    if (!product) throw ApiError.notFound('Product not found', [], 'PRODUCT_NOT_FOUND');

    const variant = await Variant.create({ ...data, product: productId });
    await cache.invalidatePattern('products:');
    return variant;
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
    if (!variant) throw ApiError.notFound('Variant not found', [], 'VARIANT_NOT_FOUND');
    await cache.invalidatePattern('products:');
    return variant;
  }

  /**
   * Admin: list every variant of a product, including inactive ones, for the
   * variant editor. (Public/admin product lists only surface active ones.)
   */
  async adminGetVariants(productId) {
    return Variant.find({ product: productId }).sort({ createdAt: 1 }).lean();
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
module.exports.buildProductFilter = buildProductFilter;
module.exports.buildProductSort = buildProductSort;
module.exports.parsePriceBound = parsePriceBound;
module.exports.sanitizeFilterValue = sanitizeFilterValue;
module.exports.sanitizeSearchTerm = sanitizeSearchTerm;
