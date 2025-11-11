const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  channelLink: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  reward: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for active tasks
taskSchema.index({ isActive: 1 });

module.exports = mongoose.model('Task', taskSchema);
