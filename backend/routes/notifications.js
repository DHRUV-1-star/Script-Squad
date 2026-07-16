const express = require('express');
const { protect } = require('../middleware/auth');
const { runDeadlineReminders } = require('../jobs/deadlineReminder');

const router = express.Router();

// @route   POST /api/notifications/test-reminder
// @desc    Manually trigger the deadline reminder job (for testing)
// @access  Private
router.post('/test-reminder', protect, async (req, res) => {
  try {
    console.log(`🧪 Manual reminder trigger by user: ${req.user.email}`);
    const result = await runDeadlineReminders();
    res.json({
      success: true,
      message: `Reminder check complete. ${result.notified} task(s) found, ${result.emails} email(s) sent.`,
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to run reminder job', error: err.message });
  }
});

// @route   GET /api/notifications/upcoming
// @desc    Get tasks with deadlines approaching for current user (preview)
// @access  Private
router.get('/upcoming', protect, async (req, res) => {
  try {
    const Task = require('../models/Task');
    const reminderHours = parseInt(process.env.DEADLINE_REMINDER_HOURS || '24', 10);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);

    const tasks = await Task.find({
      owner: req.user._id,
      status: { $ne: 'done' },
      dueDate: { $gte: now, $lte: windowEnd },
    })
      .populate('project', 'title color')
      .sort({ dueDate: 1 });

    res.json({ success: true, data: tasks, count: tasks.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
