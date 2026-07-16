const nodemailer = require('nodemailer');

// ── Transporter ──────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function priorityBadge(priority) {
  const map = {
    high:   { color: '#ef4444', bg: '#fee2e2', label: '🔴 High' },
    medium: { color: '#f59e0b', bg: '#fef3c7', label: '🟡 Medium' },
    low:    { color: '#22c55e', bg: '#dcfce7', label: '🟢 Low' },
  };
  const p = map[priority] || map['medium'];
  return `<span style="background:${p.bg};color:${p.color};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">${p.label}</span>`;
}

function taskRow(task) {
  const hoursLeft = Math.max(
    0,
    Math.round((new Date(task.dueDate) - Date.now()) / 36e5)
  );
  const urgency = hoursLeft <= 6 ? '#ef4444' : hoursLeft <= 12 ? '#f59e0b' : '#6366f1';

  return `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
        <div style="font-weight:600;color:#1e293b;font-size:15px;margin-bottom:4px;">${task.title}</div>
        ${task.description ? `<div style="color:#64748b;font-size:13px;margin-bottom:6px;">${task.description.substring(0, 100)}${task.description.length > 100 ? '…' : ''}</div>` : ''}
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${priorityBadge(task.priority)}
          ${task.project?.title ? `<span style="background:#e0e7ff;color:#4338ca;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">📁 ${task.project.title}</span>` : ''}
        </div>
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;text-align:right;white-space:nowrap;">
        <div style="color:${urgency};font-weight:700;font-size:14px;">⏰ ${hoursLeft}h left</div>
        <div style="color:#94a3b8;font-size:12px;margin-top:2px;">${formatDate(task.dueDate)}</div>
      </td>
    </tr>`;
}

// ── HTML Email Template ───────────────────────────────────────────────────────
function buildEmailHtml(userName, tasks) {
  const reminderHours = process.env.DEADLINE_REMINDER_HOURS || 24;
  const taskRows = tasks.map(taskRow).join('');
  const taskWord = tasks.length === 1 ? 'task' : 'tasks';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Deadline Reminder – Script Squad</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">⚡</div>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Deadline Reminder</h1>
            <p style="margin:8px 0 0;color:#c7d2fe;font-size:14px;">Script Squad · Task Manager</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px;">
            <p style="margin:0 0 8px;color:#1e293b;font-size:16px;">Hi <strong>${userName}</strong> 👋</p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              You have <strong style="color:#6366f1;">${tasks.length} ${taskWord}</strong> with deadlines approaching in the next
              <strong style="color:#6366f1;">${reminderHours} hours</strong>. Don't let them slip through the cracks!
            </p>

            <!-- Tasks Table -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:collapse;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:12px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Task</th>
                  <th style="padding:12px 16px;text-align:right;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Due</th>
                </tr>
              </thead>
              <tbody>
                ${taskRows}
              </tbody>
            </table>

            <!-- CTA -->
            <div style="text-align:center;margin-top:32px;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}"
                style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:50px;font-weight:700;font-size:15px;letter-spacing:0.3px;">
                Open Script Squad →
              </a>
            </div>

            <p style="margin:32px 0 0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.6;">
              This is an automated reminder from Script Squad.<br/>
              Complete or reschedule your tasks to stop receiving these reminders.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f1f5f9;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              © ${new Date().getFullYear()} Script Squad · Built with ❤️ by the Script Squad team
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

// ── Send Function ─────────────────────────────────────────────────────────────
/**
 * Send a deadline reminder email to a user.
 * @param {{ name: string, email: string }} user
 * @param {Array} tasks  – Array of populated Task documents
 */
async function sendDeadlineReminderEmail(user, tasks) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Email credentials not configured. Skipping notification.');
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"Script Squad" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `⏰ ${tasks.length} task${tasks.length > 1 ? 's' : ''} due soon — Script Squad`,
    html: buildEmailHtml(user.name, tasks),
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Deadline reminder sent to ${user.email} (${tasks.length} task${tasks.length > 1 ? 's' : ''})`);
}

module.exports = { sendDeadlineReminderEmail, sendPasswordResetEmail };

// ── Password Reset Email ──────────────────────────────────────────────────────
/**
 * Send a password reset link to the user.
 * @param {{ name: string, email: string }} user
 * @param {string} resetUrl  – Full reset URL including token
 */
async function sendPasswordResetEmail(user, resetUrl) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Email credentials not configured. Skipping password reset email.');
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Your Password – Script Squad</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🔑</div>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Reset Your Password</h1>
            <p style="margin:8px 0 0;color:#c7d2fe;font-size:14px;">Script Squad · Account Security</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 40px;">
            <p style="margin:0 0 8px;color:#1e293b;font-size:16px;">Hi <strong>${user.name}</strong> 👋</p>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
              We received a request to reset your Script Squad password. Click the button below to set a new password.
              This link is valid for <strong style="color:#6366f1;">10 minutes</strong>.
            </p>

            <!-- CTA -->
            <div style="text-align:center;margin:32px 0;">
              <a href="${resetUrl}"
                style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:50px;font-weight:700;font-size:15px;letter-spacing:0.3px;">
                Reset Password →
              </a>
            </div>

            <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;text-align:center;">
              Or copy and paste this URL into your browser:
            </p>
            <p style="margin:0 0 24px;color:#6366f1;font-size:12px;text-align:center;word-break:break-all;">
              ${resetUrl}
            </p>

            <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;text-align:center;line-height:1.6;">
              If you did not request a password reset, you can safely ignore this email.<br/>
              Your password will not be changed.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f1f5f9;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              © ${new Date().getFullYear()} Script Squad · Built with ❤️ by the Script Squad team
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"Script Squad" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: '🔑 Reset your Script Squad password',
    html,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Password reset email sent to ${user.email}`);
}

