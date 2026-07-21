const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['todo', 'inprogress', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    tags: [{ type: String }],
    completedAt: {
      type: Date,
      default: null,
    },
    // ── Timer fields ──────────────────────────────────────────────────────────
    // Timestamp when the task entered 'inprogress' (cleared when it leaves)
    timerStartedAt: {
      type: Date,
      default: null,
    },
    // Total accumulated time in milliseconds (survives pause/resume cycles)
    totalTimeSpent: {
      type: Number,
      default: 0,
    },
    // ── Privacy field ─────────────────────────────────────────────────────────
    // When true, this task is hidden from the owner's team activity card
    isPrivate: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Indexes for performance
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ owner: 1, status: 1 });
taskSchema.index({ owner: 1, dueDate: 1 });

// Set completedAt timestamp automatically
// Auto-manage timer when status transitions to/from 'inprogress'
// Also reset reminderSent when dueDate changes so user gets re-notified
taskSchema.pre('save', function () {
  if (this.isModified('status')) {
    // → Moving INTO inprogress: start the timer
    if (this.status === 'inprogress') {
      this.timerStartedAt = new Date();
    }

    // → Moving OUT of inprogress: accumulate elapsed time, clear start marker
    if (this.status !== 'inprogress' && this.timerStartedAt) {
      const elapsed = Date.now() - this.timerStartedAt.getTime();
      this.totalTimeSpent = (this.totalTimeSpent || 0) + elapsed;
      this.timerStartedAt = null;
    }

    // Set/clear completedAt
    if (this.status === 'done' && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== 'done') {
      this.completedAt = null;
    }
  }
  if (this.isModified('dueDate')) {
    this.reminderSent = false;
  }
});

module.exports = mongoose.model('Task', taskSchema);
