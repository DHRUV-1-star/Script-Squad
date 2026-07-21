const express = require('express');
const mongoose = require('mongoose');
const Team = require('../models/Team');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const TeamRequest = require('../models/TeamRequest');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ─── Helper: get-or-create the calling user's team document ──────────────────
async function getOrCreateTeam(userId) {
  let team = await Team.findOne({ owner: userId });
  if (!team) {
    team = await Team.create({ owner: userId, members: [] });
  }
  return team;
}

// ─── Helper: ensure mutual membership ────────────────────────────────────────
async function ensureMutualMembership(userAId, userBId) {
  // Add B to A's team
  const teamA = await getOrCreateTeam(userAId);
  if (!teamA.members.some((m) => m.toString() === userBId.toString())) {
    teamA.members.push(userBId);
    await teamA.save();
  }
  // Add A to B's team
  const teamB = await getOrCreateTeam(userBId);
  if (!teamB.members.some((m) => m.toString() === userAId.toString())) {
    teamB.members.push(userAId);
    await teamB.save();
  }
}

// @route   GET /api/team
// @desc    Get the current user's team roster (with member profiles)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const team = await getOrCreateTeam(req.user._id);
    const members = await User.find({ _id: { $in: team.members } }).select(
      'name email avatar createdAt'
    );
    res.json({ success: true, data: members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/team/search?q=<name or email>
// @desc    Search registered users to add to your team
// @access  Private
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    const team = await getOrCreateTeam(req.user._id);
    const excludeIds = [req.user._id, ...team.members];

    const users = await User.find({
      _id: { $nin: excludeIds },
      $or: [
        { name: { $regex: q.trim(), $options: 'i' } },
        { email: { $regex: q.trim(), $options: 'i' } },
      ],
    })
      .select('name email avatar')
      .limit(8);

    // Also fetch pending requests FROM the current user so the UI can show "Pending" state
    const pendingRequests = await TeamRequest.find({
      from: req.user._id,
      to: { $in: users.map((u) => u._id) },
      status: 'pending',
    }).select('to');

    const pendingSet = new Set(pendingRequests.map((r) => r.to.toString()));

    const enriched = users.map((u) => ({
      ...u.toObject(),
      requestPending: pendingSet.has(u._id.toString()),
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/team/activity
// @desc    For each team member, return their active tasks, projects and stats
// @access  Private
router.get('/activity', protect, async (req, res) => {
  try {
    const team = await getOrCreateTeam(req.user._id);
    if (!team.members.length) {
      return res.json({ success: true, data: [] });
    }

    const memberIds = team.members.map((id) => new mongoose.Types.ObjectId(id));

    // Task counts per member per status
    const taskStats = await Task.aggregate([
      { $match: { owner: { $in: memberIds } } },
      {
        $group: {
          _id: { owner: '$owner', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    // In-Progress tasks (with project info) per member — exclude private ones
    const inProgressTasks = await Task.find({
      owner: { $in: memberIds },
      status: 'inprogress',
      isPrivate: { $ne: true },
    })
      .populate('project', 'title color')
      .select('title project timerStartedAt totalTimeSpent')
      .limit(50);

    // Projects where member is the owner — exclude private ones
    const memberProjects = await Project.find({
      owner: { $in: memberIds },
      isPrivate: { $ne: true },
    })
      .select('title color owner status')
      .limit(100);

    // Build per-member maps
    const statsMap = {};
    taskStats.forEach(({ _id, count }) => {
      const uid = _id.owner.toString();
      if (!statsMap[uid]) statsMap[uid] = { todo: 0, inprogress: 0, done: 0 };
      statsMap[uid][_id.status] = count;
    });

    const inProgressMap = {};
    inProgressTasks.forEach((t) => {
      const uid = t.owner ? t.owner.toString() : null;
      if (!uid) return;
      if (!inProgressMap[uid]) inProgressMap[uid] = [];
      inProgressMap[uid].push(t);
    });

    const projectsMap = {};
    memberProjects.forEach((p) => {
      const uid = p.owner.toString();
      if (!projectsMap[uid]) projectsMap[uid] = [];
      projectsMap[uid].push(p);
    });

    const members = await User.find({ _id: { $in: memberIds } }).select(
      'name email avatar createdAt'
    );

    const data = members.map((m) => {
      const uid = m._id.toString();
      return {
        user: m,
        stats: statsMap[uid] || { todo: 0, inprogress: 0, done: 0 },
        inProgressTasks: inProgressMap[uid] || [],
        projects: projectsMap[uid] || [],
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/team/my-visibility
// @desc    Return the logged-in user's own tasks & projects with isPrivate flag
// @access  Private
router.get('/my-visibility', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const tasks = await Task.find({ owner: userId, status: 'inprogress' })
      .populate('project', 'title color')
      .select('title isPrivate project timerStartedAt')
      .sort({ createdAt: -1 });
    const projects = await Project.find({ owner: userId })
      .select('title color isPrivate status')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { tasks, projects } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// JOIN REQUEST ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// @route   GET /api/team/requests/incoming
// @desc    Get all pending requests sent TO the current user
// @access  Private
router.get('/requests/incoming', protect, async (req, res) => {
  try {
    const requests = await TeamRequest.find({ to: req.user._id, status: 'pending' })
      .populate('from', 'name email avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/team/requests/outgoing
// @desc    Get all pending requests sent BY the current user
// @access  Private
router.get('/requests/outgoing', protect, async (req, res) => {
  try {
    const requests = await TeamRequest.find({ from: req.user._id, status: 'pending' })
      .populate('to', 'name email avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/team/requests
// @desc    Send a join request to another user
// @access  Private
router.post('/requests', protect, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'targetUserId is required' });
    }
    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot send a request to yourself' });
    }

    const target = await User.findById(targetUserId).select('name email avatar');
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already in team
    const myTeam = await getOrCreateTeam(req.user._id);
    if (myTeam.members.some((m) => m.toString() === targetUserId)) {
      return res.status(400).json({ success: false, message: 'User is already in your team' });
    }

    // Check for an existing pending request
    const existing = await TeamRequest.findOne({ from: req.user._id, to: targetUserId });
    if (existing) {
      if (existing.status === 'pending') {
        return res.status(400).json({ success: false, message: 'You already sent a request to this user' });
      }
      // Declined before — allow re-send by updating status back to pending
      existing.status = 'pending';
      await existing.save();
      // Notify target via Socket.IO
      req.io.to(`user-${targetUserId}`).emit('team-request-received', {
        request: { ...existing.toObject(), from: req.user },
      });
      return res.json({ success: true, message: `Request re-sent to ${target.name}` });
    }

    const request = await TeamRequest.create({ from: req.user._id, to: targetUserId });

    // Notify target via Socket.IO (real-time)
    req.io.to(`user-${targetUserId}`).emit('team-request-received', {
      request: { ...request.toObject(), from: { _id: req.user._id, name: req.user.name, email: req.user.email, avatar: req.user.avatar } },
    });

    res.status(201).json({ success: true, message: `Join request sent to ${target.name}!` });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Request already sent' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/team/requests/:id/accept
// @desc    Accept a join request — adds BOTH users to each other's teams (mutual)
// @access  Private
router.patch('/requests/:id/accept', protect, async (req, res) => {
  try {
    const request = await TeamRequest.findOne({ _id: req.params.id, to: req.user._id, status: 'pending' })
      .populate('from', 'name email avatar');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    request.status = 'accepted';
    await request.save();

    // Mutual membership: both users join each other's teams
    await ensureMutualMembership(request.from._id, req.user._id);

    // Notify the requester via Socket.IO
    req.io.to(`user-${request.from._id}`).emit('team-request-responded', {
      status: 'accepted',
      by: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
    });

    res.json({ success: true, message: `You and ${request.from.name} are now teammates!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/team/requests/:id/decline
// @desc    Decline a join request
// @access  Private
router.patch('/requests/:id/decline', protect, async (req, res) => {
  try {
    const request = await TeamRequest.findOne({ _id: req.params.id, to: req.user._id, status: 'pending' })
      .populate('from', 'name email avatar');
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    request.status = 'declined';
    await request.save();

    // Notify the requester via Socket.IO
    req.io.to(`user-${request.from._id}`).emit('team-request-responded', {
      status: 'declined',
      by: { _id: req.user._id, name: req.user.name, avatar: req.user.avatar },
    });

    res.json({ success: true, message: 'Request declined' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/team/requests/:id
// @desc    Cancel/withdraw an outgoing request (by the sender)
// @access  Private
router.delete('/requests/:id', protect, async (req, res) => {
  try {
    const request = await TeamRequest.findOneAndDelete({ _id: req.params.id, from: req.user._id, status: 'pending' });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    res.json({ success: true, message: 'Request cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/team/members/:userId
// @desc    Remove a member from your team
// @access  Private
router.delete('/members/:userId', protect, async (req, res) => {
  try {
    const team = await getOrCreateTeam(req.user._id);
    const before = team.members.length;
    team.members = team.members.filter((m) => m.toString() !== req.params.userId);

    if (team.members.length === before) {
      return res.status(404).json({ success: false, message: 'Member not found in your team' });
    }

    await team.save();
    res.json({ success: true, message: 'Member removed from your team' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
