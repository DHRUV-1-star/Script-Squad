const cron = require('node-cron');
const Task = require('../models/Task');
const User = require('../models/User');
const { sendDeadlineReminderEmail } = require('../utils/emailService');

/**
 * Core function: find upcoming tasks and send reminder emails.
 * Can be called by the cron schedule or manually via the test route.
 */
async function runDeadlineReminders() {
  try {
    const reminderHours = parseInt(process.env.DEADLINE_REMINDER_HOURS || '24', 10);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);

    console.log(`🔔 Running deadline reminder check (window: ${reminderHours}h)…`);

    // Find all tasks due within the window, not done, not already notified
    const tasks = await Task.find({
      status: { $ne: 'done' },
      dueDate: { $gte: now, $lte: windowEnd },
      reminderSent: false,
    })
      .populate('owner', 'name email')
      .populate('project', 'title color');

    if (tasks.length === 0) {
      console.log('✅ No upcoming deadlines to notify about.');
      return { notified: 0, emails: 0 };
    }

    console.log(`📋 Found ${tasks.length} task(s) with approaching deadlines.`);

    // Group tasks by owner
    const tasksByUser = tasks.reduce((acc, task) => {
      if (!task.owner) return acc;
      const uid = task.owner._id.toString();
      if (!acc[uid]) acc[uid] = { user: task.owner, tasks: [] };
      acc[uid].tasks.push(task);
      return acc;
    }, {});

    let emailsSent = 0;

    // Send one email per user (batched) and mark tasks as reminded
    for (const { user, tasks: userTasks } of Object.values(tasksByUser)) {
      try {
        await sendDeadlineReminderEmail(user, userTasks);

        // Mark all tasks for this user as reminded
        const taskIds = userTasks.map((t) => t._id);
        await Task.updateMany({ _id: { $in: taskIds } }, { reminderSent: true });

        emailsSent++;
      } catch (emailErr) {
        console.error(`❌ Failed to send reminder to ${user.email}:`, emailErr.message);
      }
    }

    console.log(`📧 Deadline reminders sent to ${emailsSent} user(s).`);
    return { notified: tasks.length, emails: emailsSent };
  } catch (err) {
    console.error('❌ Deadline reminder job error:', err);
    throw err;
  }
}

/**
 * Start the cron job.
 * Default: every hour at :00 — "0 * * * *"
 * Configurable via DEADLINE_CRON_SCHEDULE env var.
 */
function startDeadlineReminderJob() {
  const schedule = process.env.DEADLINE_CRON_SCHEDULE || '0 * * * *';

  if (!cron.validate(schedule)) {
    console.error(`❌ Invalid cron schedule: "${schedule}". Using default "0 * * * *"`);
  }

  cron.schedule(schedule, async () => {
    await runDeadlineReminders();
  });

  console.log(`⏰ Deadline reminder cron job started (schedule: "${schedule}")`);
}

module.exports = { startDeadlineReminderJob, runDeadlineReminders };
