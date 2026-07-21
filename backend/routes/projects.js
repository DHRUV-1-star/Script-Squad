const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/projects
// @desc    Get all projects owned by user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = { owner: req.user._id };

    if (status) filter.status = status;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const projects = await Project.find(filter)
      .populate('owner', 'name email avatar')
      .sort({ createdAt: -1 });

    // Get task counts per project
    const projectIds = projects.map((p) => p._id);
    const taskCounts = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: '$project', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
    ]);

    const countMap = {};
    taskCounts.forEach((tc) => {
      countMap[tc._id.toString()] = { total: tc.total, done: tc.done };
    });

    const enriched = projects.map((p) => ({
      ...p.toObject(),
      taskCount: countMap[p._id.toString()]?.total || 0,
      completedCount: countMap[p._id.toString()]?.done || 0,
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/projects
// @desc    Create project
// @access  Private
router.post(
  '/',
  protect,
  [
    body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
    body('description').optional().isLength({ max: 500 }),
    body('color').optional().isHexColor().withMessage('Must be a valid hex color'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const project = await Project.create({
        ...req.body,
        owner: req.user._id,
      });
      res.status(201).json({ success: true, data: project });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   PATCH /api/projects/:id/privacy
// @desc    Toggle isPrivate flag for a project (owner only)
// @access  Private
router.patch('/:id/privacy', protect, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    project.isPrivate = !project.isPrivate;
    await project.save();
    res.json({ success: true, data: { _id: project._id, isPrivate: project.isPrivate } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id }).populate(
      'owner',
      'name email avatar'
    );
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private
router.put(
  '/:id',
  protect,
  [
    body('title').optional().trim().notEmpty().isLength({ max: 100 }),
    body('description').optional().isLength({ max: 500 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const project = await Project.findOneAndUpdate(
        { _id: req.params.id, owner: req.user._id },
        req.body,
        { new: true, runValidators: true }
      );
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      res.json({ success: true, data: project });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @route   DELETE /api/projects/:id
// @desc    Delete project and all its tasks
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Delete all tasks belonging to the project
    await Task.deleteMany({ project: req.params.id });
    await Project.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Project and all tasks deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
