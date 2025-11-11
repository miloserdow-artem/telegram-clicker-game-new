const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const PromoCode = require('../models/PromoCode');
const axios = require('axios');
const crypto = require('crypto-js');
const {
  PASSIVE_UPGRADES,
  CLICK_UPGRADES,
  calculateUpgradePrice,
  calculateUpgradeIncome,
  calculateClickBoost,
  getPassiveUpgrade,
  getClickUpgrade
} = require('../config/upgrades');

// Middleware to verify Telegram authentication
const verifyTelegramAuth = (req, res, next) => {
  const { telegramId, username } = req.body;
  
  if (!telegramId) {
    return res.status(401).json({
      success: false,
      message: 'Telegram ID is required'
    });
  }
  
  req.telegramId = telegramId;
  req.username = username || 'Unknown';
  next();
};

// Get or create user and return game data
router.post('/init', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId, username, referredBy } = req.body;
    
    console.log('Init request:', { telegramId, username, referredBy });
    
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      // Create new user
      user = new User({
        telegramId,
        username,
        referredBy: referredBy || null
      });
      
      // Check if user is admin
      const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
      if (adminIds.includes(telegramId)) {
        user.isAdmin = true;
      }
      
      // Handle referral
      if (referredBy && referredBy !== telegramId) {
        console.log('Processing referral:', { referredBy, telegramId });
        const referrer = await User.findOne({ telegramId: referredBy });
        if (referrer) {
          console.log('Referrer found:', referrer.telegramId, referrer.username);
          const referralReward = parseInt(process.env.REFERRAL_REWARD) || 1000000;
          referrer.balance += referralReward;
          referrer.referralCount += 1;
          referrer.referralEarnings += referralReward;
          await referrer.save();
          console.log('Referral reward given:', referralReward);
        } else {
          console.log('Referrer not found for telegramId:', referredBy);
        }
      } else {
        console.log('No referral or self-referral:', { referredBy, telegramId });
      }
      
      await user.save();
    } else {
      // Calculate offline earnings
      const offlineEarnings = user.calculateOfflineEarnings();
      if (offlineEarnings > 0) {
        user.balance += offlineEarnings;
      }
      
      // Update last online
      user.lastOnline = new Date();
      user.username = username; // Update username in case it changed
      await user.save();
    }
    
    res.json({
      success: true,
      user: {
        telegramId: user.telegramId,
        username: user.username,
        balance: user.balance,
        clickPower: user.clickPower,
        incomePerSecond: user.incomePerSecond,
        referralCount: user.referralCount,
        referralEarnings: user.referralEarnings,
        isAdmin: user.isAdmin,
        offlineEarnings: user.calculateOfflineEarnings(),
        botUsername: process.env.BOT_USERNAME || 'PhilipMorrisCoin_Bot'
      }
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initialize user',
      error: error.message
    });
  }
});

// Handle coin click
router.post('/click', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const { clicks = 1 } = req.body;
    
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Add coins based on click power
    const coinsEarned = user.clickPower * clicks;
    user.balance += coinsEarned;
    user.lastOnline = new Date();
    await user.save();
    
    res.json({
      success: true,
      balance: user.balance,
      coinsEarned
    });
  } catch (error) {
    console.error('Click error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process click'
    });
  }
});

// Get passive upgrades
router.post('/upgrades/passive', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const upgrades = PASSIVE_UPGRADES.map(upgrade => {
      const level = user.getUpgradeLevel(upgrade.id, false);
      const price = calculateUpgradePrice(upgrade.basePrice, level, upgrade.priceMultiplier);
      const income = calculateUpgradeIncome(upgrade.baseIncome, level + 1);
      
      return {
        id: upgrade.id,
        name: upgrade.name,
        description: upgrade.description,
        icon: upgrade.icon,
        level,
        price,
        income,
        canAfford: user.balance >= price
      };
    });
    
    res.json({
      success: true,
      upgrades
    });
  } catch (error) {
    console.error('Get passive upgrades error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upgrades'
    });
  }
});

// Get click upgrades
router.post('/upgrades/click', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const upgrades = CLICK_UPGRADES.map(upgrade => {
      const level = user.getUpgradeLevel(upgrade.id, true);
      const price = calculateUpgradePrice(upgrade.basePrice, level, upgrade.priceMultiplier);
      const clickBoost = calculateClickBoost(upgrade.clickBoost, 1);
      
      return {
        id: upgrade.id,
        name: upgrade.name,
        description: upgrade.description,
        icon: upgrade.icon,
        level,
        price,
        clickBoost,
        canAfford: user.balance >= price
      };
    });
    
    res.json({
      success: true,
      upgrades
    });
  } catch (error) {
    console.error('Get click upgrades error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upgrades'
    });
  }
});

// Buy passive upgrade
router.post('/upgrades/passive/buy', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const { upgradeId } = req.body;
    
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const upgrade = getPassiveUpgrade(upgradeId);
    if (!upgrade) {
      return res.status(404).json({
        success: false,
        message: 'Upgrade not found'
      });
    }
    
    const currentLevel = user.getUpgradeLevel(upgradeId, false);
    const price = calculateUpgradePrice(upgrade.basePrice, currentLevel, upgrade.priceMultiplier);
    
    if (user.balance < price) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Deduct price and add upgrade
    user.balance -= price;
    user.addUpgrade(upgradeId, false);
    
    // Recalculate income per second
    let totalIncome = 0;
    user.passiveUpgrades.forEach(userUpgrade => {
      const upgradeConfig = getPassiveUpgrade(userUpgrade.upgradeId);
      if (upgradeConfig) {
        totalIncome += calculateUpgradeIncome(upgradeConfig.baseIncome, userUpgrade.level);
      }
    });
    user.incomePerSecond = totalIncome;
    
    await user.save();
    
    res.json({
      success: true,
      balance: user.balance,
      incomePerSecond: user.incomePerSecond,
      newLevel: currentLevel + 1
    });
  } catch (error) {
    console.error('Buy passive upgrade error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to buy upgrade'
    });
  }
});

// Buy click upgrade
router.post('/upgrades/click/buy', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const { upgradeId } = req.body;
    
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const upgrade = getClickUpgrade(upgradeId);
    if (!upgrade) {
      return res.status(404).json({
        success: false,
        message: 'Upgrade not found'
      });
    }
    
    const currentLevel = user.getUpgradeLevel(upgradeId, true);
    const price = calculateUpgradePrice(upgrade.basePrice, currentLevel, upgrade.priceMultiplier);
    
    if (user.balance < price) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Deduct price and add upgrade
    user.balance -= price;
    user.addUpgrade(upgradeId, true);
    
    // Recalculate click power
    let totalClickPower = 1; // Base click power
    user.clickUpgrades.forEach(userUpgrade => {
      const upgradeConfig = getClickUpgrade(userUpgrade.upgradeId);
      if (upgradeConfig) {
        totalClickPower += calculateClickBoost(upgradeConfig.clickBoost, userUpgrade.level);
      }
    });
    user.clickPower = totalClickPower;
    
    await user.save();
    
    res.json({
      success: true,
      balance: user.balance,
      clickPower: user.clickPower,
      newLevel: currentLevel + 1
    });
  } catch (error) {
    console.error('Buy click upgrade error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to buy upgrade'
    });
  }
});

// Get leaderboard by balance
router.get('/leaderboard/balance', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    
    const topUsers = await User.find()
      .sort({ balance: -1 })
      .limit(limit)
      .select('telegramId username balance');
    
    const leaderboard = topUsers.map((user, index) => ({
      rank: index + 1,
      telegramId: user.telegramId,
      username: user.username,
      balance: user.balance,
      isTopThree: index < 3
    }));
    
    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Get balance leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard'
    });
  }
});

// Get leaderboard by referrals
router.get('/leaderboard/referrals', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    
    const topUsers = await User.find()
      .sort({ referralCount: -1 })
      .limit(limit)
      .select('telegramId username referralCount referralEarnings');
    
    const leaderboard = topUsers.map((user, index) => ({
      rank: index + 1,
      telegramId: user.telegramId,
      username: user.username,
      referralCount: user.referralCount,
      referralEarnings: user.referralEarnings,
      isFirstPlace: index === 0
    }));
    
    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Get referral leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard'
    });
  }
});

// Get active tasks
router.post('/tasks', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const user = await User.findOne({ telegramId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const tasks = await Task.find({ isActive: true }).sort({ createdAt: -1 });
    
    const tasksWithStatus = tasks.map(task => ({
      id: task._id,
      title: task.title,
      description: task.description,
      channelLink: task.channelLink,
      reward: task.reward,
      completed: user.completedTasks.includes(task._id)
    }));
    
    res.json({
      success: true,
      tasks: tasksWithStatus
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tasks'
    });
  }
});

// Check task completion (verify channel subscription)
router.post('/tasks/check', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const { taskId } = req.body;
    
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const task = await Task.findById(taskId);
    if (!task || !task.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or inactive'
      });
    }
    
    // Check if already completed
    if (user.completedTasks.includes(task._id)) {
      return res.status(400).json({
        success: false,
        message: 'Task already completed'
      });
    }
    
    // Verify channel subscription using Telegram Bot API
    try {
      const botToken = process.env.BOT_TOKEN;
      const response = await axios.get(
        `https://api.telegram.org/bot${botToken}/getChatMember`,
        {
          params: {
            chat_id: task.channelId,
            user_id: telegramId
          }
        }
      );
      
      const memberStatus = response.data.result.status;
      const isSubscribed = ['member', 'administrator', 'creator'].includes(memberStatus);
      
      if (!isSubscribed) {
        return res.json({
          success: false,
          message: 'You are not subscribed to the channel'
        });
      }
      
      // Award the reward
      user.balance += task.reward;
      user.completedTasks.push(task._id);
      await user.save();
      
      res.json({
        success: true,
        message: 'Task completed!',
        reward: task.reward,
        balance: user.balance
      });
    } catch (telegramError) {
      console.error('Telegram API error:', telegramError.response?.data || telegramError.message);
      
      // For testing: auto-complete the task
      if (process.env.NODE_ENV === 'development') {
        user.balance += task.reward;
        user.completedTasks.push(task._id);
        await user.save();
        
        return res.json({
          success: true,
          message: 'Task completed! (Development mode)',
          reward: task.reward,
          balance: user.balance
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to verify subscription'
      });
    }
  } catch (error) {
    console.error('Check task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check task'
    });
  }
});

// Activate promo code
router.post('/promo/activate', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Promo code is required'
      });
    }
    
    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const promoCode = await PromoCode.findOne({ code: code.toUpperCase() });
    
    if (!promoCode) {
      return res.json({
        success: false,
        message: 'Промокода не существует'
      });
    }
    
    if (!promoCode.isValid()) {
      return res.json({
        success: false,
        message: 'Превышен лимит использований'
      });
    }
    
    if (user.claimedPromoCodes.includes(code.toUpperCase())) {
      return res.json({
        success: false,
        message: 'Ты уже использовал промокод'
      });
    }
    
    // Award the reward
    user.balance += promoCode.reward;
    user.claimedPromoCodes.push(code.toUpperCase());
    await user.save();
    
    // Increment usage count
    promoCode.currentUses += 1;
    await promoCode.save();
    
    res.json({
      success: true,
      message: 'Ты активировал промокод',
      reward: promoCode.reward,
      balance: user.balance
    });
  } catch (error) {
    console.error('Activate promo error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка активации промокода'
    });
  }
});

// Test endpoint for referral system (development only)
router.post('/test-referral', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only available in development mode'
      });
    }

    const { referrerId, newUserId, newUserName } = req.body;

    // Find referrer
    const referrer = await User.findOne({ telegramId: referrerId });
    if (!referrer) {
      return res.json({
        success: false,
        message: 'Referrer not found'
      });
    }

    // Check if new user already exists
    let newUser = await User.findOne({ telegramId: newUserId });
    if (newUser) {
      return res.json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create new user with referral
    newUser = new User({
      telegramId: newUserId,
      username: newUserName || 'Test User',
      referredBy: referrerId
    });

    // Give reward to referrer
    const referralReward = parseInt(process.env.REFERRAL_REWARD) || 1000000;
    referrer.balance += referralReward;
    referrer.referralCount += 1;
    referrer.referralEarnings += referralReward;
    
    await referrer.save();
    await newUser.save();

    res.json({
      success: true,
      message: 'Referral test successful',
      referrer: {
        telegramId: referrer.telegramId,
        username: referrer.username,
        referralCount: referrer.referralCount,
        referralEarnings: referrer.referralEarnings,
        balance: referrer.balance
      },
      newUser: {
        telegramId: newUser.telegramId,
        username: newUser.username,
        referredBy: newUser.referredBy
      }
    });
  } catch (error) {
    console.error('Test referral error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test referral',
      error: error.message
    });
  }
});

module.exports = router;
