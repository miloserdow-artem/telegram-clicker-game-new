const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true
  },
  reward: {
    type: Number,
    required: true,
    min: 0
  },
  maxUses: {
    type: Number,
    default: null // null means unlimited
  },
  currentUses: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null // null means no expiration
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

// Index for active promo codes
promoCodeSchema.index({ isActive: 1, expiresAt: 1 });

// Method to check if promo code is valid
promoCodeSchema.methods.isValid = function() {
  if (!this.isActive) return false;
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  if (this.maxUses && this.currentUses >= this.maxUses) return false;
  return true;
};

module.exports = mongoose.model('PromoCode', promoCodeSchema);
