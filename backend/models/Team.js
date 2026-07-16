const mongoose = require('mongoose');

/**
 * Team — a user's personal collaborator roster.
 * Each user has exactly one Team document.
 * members[] stores refs to other User documents.
 */
const teamSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // one team per user
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

teamSchema.index({ owner: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
