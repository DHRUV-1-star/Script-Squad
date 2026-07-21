const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
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
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters'],
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for fast conversation retrieval
chatMessageSchema.index({ from: 1, to: 1, createdAt: -1 });
chatMessageSchema.index({ to: 1, read: 1 }); // for unread count queries

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
