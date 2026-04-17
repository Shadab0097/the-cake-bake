const User = require('../../models/User');
const Address = require('../../models/Address');
const ApiError = require('../../utils/ApiError');

class UserService {
  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async updateProfile(userId, data) {
    const user = await User.findByIdAndUpdate(userId, data, {
      new: true,
      runValidators: true,
    });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async getAddresses(userId) {
    return Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 });
  }

  async createAddress(userId, data) {
    if (data.isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    // If first address, make it default
    const count = await Address.countDocuments({ user: userId });
    if (count === 0) data.isDefault = true;

    return Address.create({ ...data, user: userId });
  }

  async updateAddress(userId, addressId, data) {
    if (data.isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    const address = await Address.findOneAndUpdate(
      { _id: addressId, user: userId },
      data,
      { new: true, runValidators: true }
    );

    if (!address) throw ApiError.notFound('Address not found');
    return address;
  }

  async deleteAddress(userId, addressId) {
    const address = await Address.findOneAndDelete({ _id: addressId, user: userId });
    if (!address) throw ApiError.notFound('Address not found');

    // If deleted address was default, make another one default
    if (address.isDefault) {
      const nextAddress = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return address;
  }

  async setDefaultAddress(userId, addressId) {
    await Address.updateMany({ user: userId }, { isDefault: false });

    const address = await Address.findOneAndUpdate(
      { _id: addressId, user: userId },
      { isDefault: true },
      { new: true }
    );

    if (!address) throw ApiError.notFound('Address not found');
    return address;
  }
}

module.exports = new UserService();
