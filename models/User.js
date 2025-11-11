const mongoose = require('mongoose');

const upgradeSchema = new mongoose.Schema({
  upgradeId: { type: Number, required: true },
  level: { type: Number, default: 0 }
});

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    default: 'Unknown'
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  clickPower: {
    type: Number,
    default: 1,
    min: 1
  },
  incomePerSecond: {
    type: Number,
    default: 0,
    min: 0
  },
  passiveUpgrades: [upgradeSchema],
  clickUpgrades: [upgradeSchema],
  completedTasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  claimedPromoCodes: [String],
  referredBy: {
    type: String,
    default: null
  },
  referralCount: {
    type: Number,
    default: 0,
    min: 0
  },
  referralEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  lastOnline: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for leaderboards
userSchema.index({ balance: -1 });
userSchema.index({ referralCount: -1 });

// Method to calculate offline earnings
userSchema.methods.calculateOfflineEarnings = function() {
  if (this.incomePerSecond === 0) return 0;
  
  const now = new Date();
  const secondsOffline = Math.floor((now - this.lastOnline) / 1000);
  
  // Cap offline earnings to 24 hours
  const maxSeconds = 24 * 60 * 60;
  const earnSeconds = Math.min(secondsOffline, maxSeconds);
  
  return this.incomePerSecond * earnSeconds;
};

// Method to get upgrade level
userSchema.methods.getUpgradeLevel = function(upgradeId, isClickUpgrade = false) {
  const upgrades = isClickUpgrade ? this.clickUpgrades : this.passiveUpgrades;
  const upgrade = upgrades.find(u => u.upgradeId === upgradeId);
  return upgrade ? upgrade.level : 0;
};

// Method to add or update upgrade
userSchema.methods.addUpgrade = function(upgradeId, isClickUpgrade = false) {
  const upgrades = isClickUpgrade ? this.clickUpgrades : this.passiveUpgrades;
  const existingUpgrade = upgrades.find(u => u.upgradeId === upgradeId);
  
  if (existingUpgrade) {
    existingUpgrade.level += 1;
  } else {
    upgrades.push({ upgradeId, level: 1 });
  }
};

module.exports = mongoose.model('User', userSchema);
