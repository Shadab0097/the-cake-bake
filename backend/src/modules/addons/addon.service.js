const AddOn = require('../../models/AddOn');
const ApiError = require('../../utils/ApiError');
const { generateSlug } = require('../../utils/helpers');

class AddOnService {
  async listAddOns() {
    return AddOn.find({ isActive: true }).sort({ category: 1, sortOrder: 1 }).lean();
  }

  async getByCategory(category) {
    return AddOn.find({ category, isActive: true }).sort({ sortOrder: 1 }).lean();
  }

  async createAddOn(data) {
    data.slug = generateSlug(data.name);
    return AddOn.create(data);
  }

  async updateAddOn(id, data) {
    if (data.name) data.slug = generateSlug(data.name);
    const addon = await AddOn.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!addon) throw ApiError.notFound('Add-on not found');
    return addon;
  }

  async deleteAddOn(id) {
    const addon = await AddOn.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!addon) throw ApiError.notFound('Add-on not found');
    return addon;
  }
}

module.exports = new AddOnService();
