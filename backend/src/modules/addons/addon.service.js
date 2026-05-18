const AddOn = require('../../models/AddOn');
const ApiError = require('../../utils/ApiError');
const { generateSlug } = require('../../utils/helpers');
const uploadService = require('../media/upload.service');
const cache = require('../../utils/cache');

class AddOnService {
  async listAddOns() {
    return cache.getOrSet('addons:list', () => {
      return AddOn.find({ isActive: true }).sort({ category: 1, sortOrder: 1 }).lean();
    }, 300);
  }

  async getByCategory(category) {
    return cache.getOrSet(`addons:category:${category}`, () => {
      return AddOn.find({ category, isActive: true }).sort({ sortOrder: 1 }).lean();
    }, 300);
  }

  async createAddOn(data) {
    data.slug = generateSlug(data.name);
    const addon = await AddOn.create(data);
    await cache.invalidatePattern('addons:');
    return addon;
  }

  async updateAddOn(id, data) {
    if (data.name) data.slug = generateSlug(data.name);
    const existingAddOn = data.imagePublicId !== undefined
      ? await AddOn.findById(id).select('imagePublicId').lean()
      : null;
    const addon = await AddOn.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!addon) throw ApiError.notFound('Add-on not found');
    if (existingAddOn?.imagePublicId && existingAddOn.imagePublicId !== addon.imagePublicId) {
      uploadService.deleteImage(existingAddOn.imagePublicId);
    }
    await cache.invalidatePattern('addons:');
    return addon;
  }

  async deleteAddOn(id) {
    const addon = await AddOn.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!addon) throw ApiError.notFound('Add-on not found');
    await cache.invalidatePattern('addons:');
    return addon;
  }
}

module.exports = new AddOnService();
