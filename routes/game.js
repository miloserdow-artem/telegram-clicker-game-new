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

// Daily Rewards Configuration
const DAILY_REWARDS = [
  { day: 1, type: 'shield', amount: 1, message: 'Бонус Щит' },
  { day: 2, type: 'bomb', amount: 1, message: 'Бонус Бомба' },
  { day: 3, type: 'coins', amount: 500000, message: '500,000 Монет' },
  { day: 4, type: 'shield', amount: 1, message: '1 Щит' },
  { day: 5, type: 'bomb', amount: 3, message: '3 Бомбы' },
  { day: 6, type: 'coins', amount: 5000000, message: '5,000,000 Монет' },
  { day: 7, type: 'bomb', amount: 5, message: '5 Бомб' },
];

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
        referredBy: referredBy || null,
        clickPower: 1 // Initialize clickPower to 1 to satisfy schema validation
      });
      
      // Check if user is admin
      const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
      if (adminIds.includes(telegramId)) {
        user.isAdmin = true;
      }
      
      // Referral handling is now primarily done by the bot.
      // This Web App backend will only store the referredBy ID if present.
      // If referredBy is present and it's not a self-referral, award the referrer
      if (referredBy && referredBy !== telegramId) {
        console.log('New user referred by:', referredBy);
        const referrer = await User.findOne({ telegramId: referredBy });
        if (referrer) {
          const referralReward = parseInt(process.env.REFERRAL_REWARD) || 1000000; // Default to 1,000,000 if not set
          referrer.balance += referralReward;
          referrer.referralCount += 1;
          referrer.referralEarnings += referralReward;
          await referrer.save();
          console.log(`Referrer ${referrer.telegramId} awarded ${referralReward} for new user ${telegramId}`);
        } else {
          console.log(`Referrer ${referredBy} not found for new user ${telegramId}`);
        }
      } else {
        console.log('New user without referral or self-referral.');
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
        botUsername: process.env.BOT_USERNAME || 'PhilipMorrisCoin_Bot',
        bombs: user.bombs,
        shields: user.shields,
        shieldActiveUntil: user.shieldActiveUntil
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

    let bonusDropped = null;
    const random = Math.random();
    const BOMB_DROP_CHANCE = parseFloat(process.env.BOMB_DROP_CHANCE) || 0.001;
    const SHIELD_DROP_CHANCE = parseFloat(process.env.SHIELD_DROP_CHANCE) || 0.001;

    if (random < BOMB_DROP_CHANCE) {
      user.bombs += 1;
      bonusDropped = { type: 'bomb' };
    } else if (random < BOMB_DROP_CHANCE + SHIELD_DROP_CHANCE) {
      user.shields += 1;
      bonusDropped = { type: 'shield' };
    }
    
    await user.save();
    
    res.json({
      success: true,
      balance: user.balance,
      coinsEarned,
      bombs: user.bombs,
      shields: user.shields,
      shieldActiveUntil: user.shieldActiveUntil,
      bonusDropped
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
    if (promoCode.reward.type === 'coins') {
      user.balance += promoCode.reward.amount;
    } else if (promoCode.reward.type === 'bomb') {
      user.bombs += promoCode.reward.amount;
    } else if (promoCode.reward.type === 'shield') {
      user.shields += promoCode.reward.amount;
    }

    user.claimedPromoCodes.push(code.toUpperCase());
    await user.save();
    
    // Increment usage count
    promoCode.currentUses += 1;
    await promoCode.save();
    
    res.json({
      success: true,
      message: 'Ты активировал промокод',
      rewardType: promoCode.reward.type,
      rewardAmount: promoCode.reward.amount,
      balance: user.balance,
      bombs: user.bombs,
      shields: user.shields
    });
  } catch (error) {
    console.error('Activate promo error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка активации промокода'
    });
  }
});

// Use Bomb
router.post('/useBomb', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const { targetTelegramId } = req.body;

    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.bombs === 0) {
      return res.status(400).json({ success: false, message: 'У вас нет бомб!' });
    }

    const targetUser = await User.findOne({ telegramId: targetTelegramId });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Цель не найдена' });
    }

    if (targetUser.telegramId === user.telegramId) {
      return res.status(400).json({ success: false, message: 'Нельзя бомбить себя!' });
    }

    // Check if target has an active shield
    const now = new Date();
    if (targetUser.shieldActiveUntil && targetUser.shieldActiveUntil > now) {
      user.bombs -= 1; // Bomb is consumed even if target is shielded
      await user.save();
      return res.json({
        success: false,
        message: `${targetUser.username} защищен щитом! Ваша бомба потрачена.`,
        bombs: user.bombs,
        balance: user.balance,
        targetUsername: targetUser.username
      });
    }

    const BOMB_DAMAGE = parseInt(process.env.BOMB_DAMAGE) || 300000;
    targetUser.balance = Math.max(0, targetUser.balance - BOMB_DAMAGE);
    user.bombs -= 1;

    await Promise.all([user.save(), targetUser.save()]);

    res.json({
      success: true,
      message: `Вы успешно сбросили бомбу на ${targetUser.username}!`,
      bombs: user.bombs,
      balance: user.balance,
      targetUsername: targetUser.username
    });

  } catch (error) {
    console.error('Use bomb error:', error);
    res.status(500).json({ success: false, message: 'Ошибка при использовании бомбы' });
  }
});

// Activate Shield
router.post('/activateShield', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;

    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.shields === 0) {
      return res.status(400).json({ success: false, message: 'У вас нет щитов!' });
    }

    const SHIELD_DURATION_HOURS = parseInt(process.env.SHIELD_DURATION_HOURS) || 3;
    const now = new Date();
    const shieldEndTime = new Date(now.getTime() + SHIELD_DURATION_HOURS * 60 * 60 * 1000);

    user.shieldActiveUntil = shieldEndTime;
    user.shields -= 1;

    await user.save();

    res.json({
      success: true,
      message: 'Щит активирован!',
      shields: user.shields,
      shieldActiveUntil: user.shieldActiveUntil
    });

  } catch (error) {
    console.error('Activate shield error:', error);
    res.status(500).json({ success: false, message: 'Ошибка при активации щита' });
  }
});

// Get daily rewards status
router.post('/daily-rewards', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const user = await User.findOne({ telegramId });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastClaimed = user.lastClaimedDailyRewardDate ? new Date(user.lastClaimedDailyRewardDate.getFullYear(), user.lastClaimedDailyRewardDate.getMonth(), user.lastClaimedDailyRewardDate.getDate()) : null;

    let currentStreak = user.dailyRewardStreak;

    // Check if streak needs to be reset
    if (lastClaimed) {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      if (lastClaimed.getTime() < yesterday.getTime()) {
        // If last claim was before yesterday, reset streak
        currentStreak = 0;
      }
    }

    res.json({
      success: true,
      dailyRewards: {
        streak: currentStreak,
        lastClaimedDate: user.lastClaimedDailyRewardDate,
        rewards: DAILY_REWARDS
      }
    });

  } catch (error) {
    console.error('Get daily rewards error:', error);
    res.status(500).json({ success: false, message: 'Failed to get daily rewards' });
  }
});

// Claim daily reward
router.post('/daily-rewards/claim', verifyTelegramAuth, async (req, res) => {
  try {
    const { telegramId } = req;
    const user = await User.findOne({ telegramId });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastClaimed = user.lastClaimedDailyRewardDate ? new Date(user.lastClaimedDailyRewardDate.getFullYear(), user.lastClaimedDailyRewardDate.getMonth(), user.lastClaimedDailyRewardDate.getDate()) : null;

    // Check if already claimed today
    if (lastClaimed && lastClaimed.getTime() === today.getTime()) {
      return res.status(400).json({ success: false, message: 'Вы уже получили сегодняшнюю награду.' });
    }

    let currentStreak = user.dailyRewardStreak;

    // Check if streak needs to be reset
    if (lastClaimed) {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      if (lastClaimed.getTime() < yesterday.getTime()) {
        // If last claim was before yesterday, reset streak
        currentStreak = 0;
      }
    }

    const rewardIndex = currentStreak % DAILY_REWARDS.length;
    const reward = DAILY_REWARDS[rewardIndex];

    if (!reward) {
      return res.status(500).json({ success: false, message: 'Ошибка: награда не найдена.' });
    }

    // Grant reward
    let rewardMessage = '';
    if (reward.type === 'coins') {
      user.balance += reward.amount;
      rewardMessage = `${reward.amount} монет`;
    } else if (reward.type === 'bomb') {
      user.bombs += reward.amount;
      rewardMessage = `${reward.amount} бомб`;
    } else if (reward.type === 'shield') {
      user.shields += reward.amount;
      rewardMessage = `${reward.amount} щитов`;
    }

    user.dailyRewardStreak = currentStreak + 1;
    user.lastClaimedDailyRewardDate = now;
    user.lastOnline = now; // Update last online as well

    await user.save();

    res.json({
      success: true,
      message: 'Награда успешно получена!',
      rewardMessage: reward.message,
      balance: user.balance,
      bombs: user.bombs,
      shields: user.shields,
      dailyRewardStreak: user.dailyRewardStreak
    });

  } catch (error) {
    console.error('Claim daily reward error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim daily reward' });
  }
});

module.exports = router;
