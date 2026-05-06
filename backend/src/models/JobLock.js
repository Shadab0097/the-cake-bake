const mongoose = require('mongoose');

const jobLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    owner: {
      type: String,
      required: true,
    },
    lockedUntil: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('JobLock', jobLockSchema);
