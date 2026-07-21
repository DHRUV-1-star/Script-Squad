const express = require('express');
const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const Team = require('../models/Team');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ─── Helper: get all teammate IDs for the current user ───────────────────────
async function getTeammateIds(userId) {
  const team = await Team.findOne({ owner: userId });
  return team ? team.members.map((m) => m.toString()) : [];
}

// @route   GET /api/chat/conversations
// @desc    List all teammates with last message + unread count
// @access  Private
router.get('/conversations', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const teammateIds = await getTeammateIds(userId);

    if (!teammateIds.length) {
      return res.json({ success: true, data: [] });
    }

    const teammates = await User.find({ _id: { $in: teammateIds } })
      .select('name email avatar');

    // For each teammate, get last message and unread count
    const conversations = await Promise.all(
      teammates.map(async (mate) => {
        const mateId = mate._id;

        // Last message between the two (either direction)
        const lastMsg = await ChatMessage.findOne({
          $or: [
            { from: userId, to: mateId },
            { from: mateId, to: userId },
          ],
        }).sort({ createdAt: -1 });

        // Count unread messages FROM this teammate TO current user
        const unreadCount = await ChatMessage.countDocuments({
          from: mateId,
          to: userId,
          read: false,
        });

        return {
          user: mate,
          lastMessage: lastMsg || null,
          unreadCount,
        };
      })
    );

    // Sort: conversations with messages first (by latest), then others
    conversations.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
    });

    res.json({ success: true, data: conversations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/chat/messages/:userId
// @desc    Get chat history with a specific user (last 50 messages)
// @access  Private
router.get('/messages/:userId', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const otherId = req.params.userId;

    const messages = await ChatMessage.find({
      $or: [
        { from: userId, to: otherId },
        { from: otherId, to: userId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('from', 'name avatar')
      .populate('to', 'name avatar');

    // Return in ascending order for display
    res.json({ success: true, data: messages.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/chat/messages
// @desc    Send a message to a teammate
// @access  Private
router.post('/messages', protect, async (req, res) => {
  try {
    const { to, content } = req.body;
    if (!to || !content?.trim()) {
      return res.status(400).json({ success: false, message: 'to and content are required' });
    }

    const recipient = await User.findById(to).select('name avatar');
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    const message = await ChatMessage.create({
      from: req.user._id,
      to,
      content: content.trim(),
    });

    const populated = await message.populate([
      { path: 'from', select: 'name avatar' },
      { path: 'to', select: 'name avatar' },
    ]);

    // Emit to recipient in real-time via Socket.IO
    req.io.to(`user-${to}`).emit('chat-message', populated);

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/chat/messages/:userId/read
// @desc    Mark all messages from a user as read
// @access  Private
router.patch('/messages/:userId/read', protect, async (req, res) => {
  try {
    await ChatMessage.updateMany(
      { from: req.params.userId, to: req.user._id, read: false },
      { read: true }
    );
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/chat/unread-count
// @desc    Get total unread message count for current user (for sidebar badge)
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await ChatMessage.countDocuments({ to: req.user._id, read: false });
    res.json({ success: true, data: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
