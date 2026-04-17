const mongoose = require('mongoose');

const adminRoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminRole', adminRoleSchema);
