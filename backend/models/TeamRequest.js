const mongoose = require('mongoose');

const teamRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests between the same pair
teamRequestSchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model('TeamRequest', teamRequestSchema);
