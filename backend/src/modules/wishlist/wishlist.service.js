const Wishlist = require('../../models/Wishlist');
const Product = require('../../models/Product');
const ApiError = require('../../utils/ApiError');

class WishlistService {
  async getWishlist(userId) {
    let wishlist = await Wishlist.findOne({ user: userId })
      .populate('products', 'name slug images basePrice isFeatured averageRating category isActive')
      .lean();

    if (!wishlist) {
      wishlist = { user: userId, products: [] };
    }

    // Filter out inactive products
    wishlist.products = (wishlist.products || []).filter((p) => p.isActive);
    return wishlist;
  }

  async addToWishlist(userId, productId) {
    const product = await Product.findOne({ _id: productId, isActive: true });
    if (!product) throw ApiError.notFound('Product not found');

    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({ user: userId, products: [] });
    }

    if (!wishlist.products.includes(productId)) {
      wishlist.products.push(productId);
      await wishlist.save();
    }

    return this.getWishlist(userId);
  }

  async removeFromWishlist(userId, productId) {
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) return { user: userId, products: [] };

    wishlist.products = wishlist.products.filter((id) => id.toString() !== productId);
    await wishlist.save();
    return this.getWishlist(userId);
  }
}

module.exports = new WishlistService();
