const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const Variant = require('../../models/Variant');
const AddOn = require('../../models/AddOn');
const Coupon = require('../../models/Coupon');
const CouponUsage = require('../../models/CouponUsage');
const ApiError = require('../../utils/ApiError');

class CartService {
  /**
   * Get user's cart with computed totals
   */
  async getCart(userId) {
    let cart = await Cart.findOne({ user: userId })
      .populate('items.product', 'name slug images isActive allowCustomMessage hasEgglessOption egglessExtraPrice')
      .populate('items.variant', 'weight price compareAtPrice stock isActive')
      .populate('items.addOns', 'name price image')
      .populate('appliedCoupon')
      .lean();

    if (!cart) {
      cart = { user: userId, items: [], appliedCoupon: null, deliveryNotes: '' };
    }

    return this.computeCartTotals(cart);
  }

  /**
   * Add item to cart
   */
  async addItem(userId, itemData) {
    const { productId, variantId, quantity, addOns, cakeMessage, isEggless } = itemData;

    // Validate product and variant
    const [product, variant] = await Promise.all([
      Product.findOne({ _id: productId, isActive: true }),
      Variant.findOne({ _id: variantId, product: productId, isActive: true }),
    ]);

    if (!product) throw ApiError.notFound('Product not found');
    if (!variant) throw ApiError.notFound('Variant not found');
    if (variant.stock < quantity) throw ApiError.badRequest('Insufficient stock');

    // Validate add-ons
    let validAddOns = [];
    if (addOns && addOns.length > 0) {
      validAddOns = await AddOn.find({ _id: { $in: addOns }, isActive: true });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Check if same product+variant already in cart
    const existingIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId && item.variant.toString() === variantId
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
      if (cakeMessage) cart.items[existingIndex].cakeMessage = cakeMessage;
      if (isEggless !== undefined) cart.items[existingIndex].isEggless = isEggless;
      if (validAddOns.length > 0) {
        cart.items[existingIndex].addOns = validAddOns.map((a) => a._id);
      }
    } else {
      cart.items.push({
        product: productId,
        variant: variantId,
        quantity,
        addOns: validAddOns.map((a) => a._id),
        cakeMessage: cakeMessage || '',
        isEggless: isEggless || false,
        snapshotName: product.name,
        snapshotPrice: variant.price,
        snapshotImage: product.images[0]?.url || '',
      });
    }

    await cart.save();
    return this.getCart(userId);
  }

  /**
   * Update cart item
   */
  async updateItem(userId, itemId, updateData) {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) throw ApiError.notFound('Cart not found');

    const item = cart.items.id(itemId);
    if (!item) throw ApiError.notFound('Item not found in cart');

    if (updateData.quantity !== undefined) {
      if (updateData.quantity < 1) throw ApiError.badRequest('Quantity must be at least 1');
      const variant = await Variant.findById(item.variant);
      if (variant && variant.stock < updateData.quantity) {
        throw ApiError.badRequest('Insufficient stock');
      }
      item.quantity = updateData.quantity;
    }

    if (updateData.cakeMessage !== undefined) item.cakeMessage = updateData.cakeMessage;
    if (updateData.isEggless !== undefined) item.isEggless = updateData.isEggless;
    if (updateData.addOns) {
      const validAddOns = await AddOn.find({ _id: { $in: updateData.addOns }, isActive: true });
      item.addOns = validAddOns.map((a) => a._id);
    }

    await cart.save();
    return this.getCart(userId);
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId, itemId) {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) throw ApiError.notFound('Cart not found');

    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
    await cart.save();
    return this.getCart(userId);
  }

  /**
   * Apply coupon to cart
   */
  async applyCoupon(userId, couponCode) {
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!coupon) throw ApiError.badRequest('Invalid or expired coupon');

    // Check usage limits
    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      throw ApiError.badRequest('Coupon usage limit reached');
    }

    const userUsage = await CouponUsage.countDocuments({ coupon: coupon._id, user: userId });
    if (userUsage >= coupon.perUserLimit) {
      throw ApiError.badRequest('You have already used this coupon');
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      throw ApiError.badRequest('Cart is empty');
    }

    cart.appliedCoupon = coupon._id;
    await cart.save();

    return this.getCart(userId);
  }

  /**
   * Remove coupon from cart
   */
  async removeCoupon(userId) {
    await Cart.findOneAndUpdate({ user: userId }, { appliedCoupon: null });
    return this.getCart(userId);
  }

  /**
   * Clear cart
   */
  async clearCart(userId) {
    await Cart.findOneAndUpdate(
      { user: userId },
      { items: [], appliedCoupon: null, deliveryNotes: '' }
    );
    return { items: [], subtotal: 0, discount: 0, total: 0 };
  }

  /**
   * Compute cart totals
   */
  computeCartTotals(cart) {
    let subtotal = 0;

    const computedItems = cart.items.map((item) => {
      let itemPrice = item.variant?.price || item.snapshotPrice || 0;

      // Eggless extra
      if (item.isEggless && item.product?.egglessExtraPrice) {
        itemPrice += item.product.egglessExtraPrice;
      }

      // Add-on prices
      let addOnTotal = 0;
      if (item.addOns && item.addOns.length > 0) {
        addOnTotal = item.addOns.reduce((sum, addon) => sum + (addon.price || 0), 0);
      }

      const lineTotal = (itemPrice + addOnTotal) * item.quantity;
      subtotal += lineTotal;

      return { ...item, itemPrice, addOnTotal, lineTotal };
    });

    // Compute discount from coupon
    let discount = 0;
    if (cart.appliedCoupon) {
      const coupon = cart.appliedCoupon;
      if (subtotal >= (coupon.minOrderAmount || 0)) {
        if (coupon.type === 'percentage') {
          discount = Math.round((subtotal * coupon.value) / 100);
          if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
          }
        } else {
          discount = coupon.value;
        }
      }
    }

    const total = subtotal - discount;

    return {
      ...cart,
      items: computedItems,
      subtotal,
      discount,
      total: total > 0 ? total : 0,
      itemCount: computedItems.reduce((sum, item) => sum + item.quantity, 0),
    };
  }
}

module.exports = new CartService();
