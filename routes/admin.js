const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Task = require('../models/Task');
const PromoCode = require('../models/PromoCode');

// Middleware to verify admin access
const verifyAdmin = async (req, res, next) => {
  const { telegramId } = req.body;
  
  if (!telegramId) {
    return res.status(401).json({
      success: false,
      message: 'Telegram ID is required'
    });
  }
  
  const user = await User.findOne({ telegramId });
  if (!user || !user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  req.adminUser = user;
  next();
};

// Get all tasks (admin only)
router.post('/tasks', verifyAdmin, async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      tasks: tasks.map(task => ({
        id: task._id,
        title: task.title,
        description: task.description,
        channelLink: task.channelLink,
        channelId: task.channelId,
        reward: task.reward,
        isActive: task.isActive,
        createdBy: task.createdBy,
        createdAt: task.createdAt
      }))
    });
  } catch (error) {
    console.error('Get admin tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tasks'
    });
  }
});

// Create new task (admin only)
router.post('/tasks/create', verifyAdmin, async (req, res) => {
  try {
    const { title, description, channelLink, channelId, reward } = req.body;
    
    if (!title || !channelLink || !channelId || reward === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Title, channel link, channel ID, and reward are required'
      });
    }
    
    const task = new Task({
      title,
      description: description || '',
      channelLink,
      channelId,
      reward: parseInt(reward),
      createdBy: req.adminUser.telegramId
    });
    
    await task.save();
    
    res.json({
      success: true,
      message: 'Task created successfully',
      task: {
        id: task._id,
        title: task.title,
        description: task.description,
        channelLink: task.channelLink,
        channelId: task.channelId,
        reward: task.reward,
        isActive: task.isActive
      }
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task'
    });
  }
});

// Update task (admin only)
router.post('/tasks/update', verifyAdmin, async (req, res) => {
  try {
    const { taskId, title, description, channelLink, channelId, reward, isActive } = req.body;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
    }
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (channelLink !== undefined) task.channelLink = channelLink;
    if (channelId !== undefined) task.channelId = channelId;
    if (reward !== undefined) task.reward = parseInt(reward);
    if (isActive !== undefined) task.isActive = isActive;
    
    await task.save();
    
    res.json({
      success: true,
      message: 'Task updated successfully',
      task: {
        id: task._id,
        title: task.title,
        description: task.description,
        channelLink: task.channelLink,
        channelId: task.channelId,
        reward: task.reward,
        isActive: task.isActive
      }
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task'
    });
  }
});

// Delete task (admin only)
router.post('/tasks/delete', verifyAdmin, async (req, res) => {
  try {
    const { taskId } = req.body;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
    }
    
    const task = await Task.findByIdAndDelete(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task'
    });
  }
});

// Get all promo codes (admin only)
router.post('/promo', verifyAdmin, async (req, res) => {
  try {
    const promoCodes = await PromoCode.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      promoCodes: promoCodes.map(promo => ({
        id: promo._id,
        code: promo.code,
        reward: promo.reward,
        maxUses: promo.maxUses,
        currentUses: promo.currentUses,
        isActive: promo.isActive,
        expiresAt: promo.expiresAt,
        createdBy: promo.createdBy,
        createdAt: promo.createdAt
      }))
    });
  } catch (error) {
    console.error('Get promo codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get promo codes'
    });
  }
});

// Create new promo code (admin only)
router.post('/promo/create', verifyAdmin, async (req, res) => {
  try {
    const { code, reward, maxUses, expiresAt } = req.body;
    
    if (!code || reward === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Code and reward are required'
      });
    }
    
    // Check if code already exists
    const existingPromo = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existingPromo) {
      return res.status(400).json({
        success: false,
        message: 'Promo code already exists'
      });
    }
    
    const promoCode = new PromoCode({
      code: code.toUpperCase(),
      reward: parseInt(reward),
      maxUses: maxUses ? parseInt(maxUses) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.adminUser.telegramId
    });
    
    await promoCode.save();
    
    res.json({
      success: true,
      message: 'Promo code created successfully',
      promoCode: {
        id: promoCode._id,
        code: promoCode.code,
        reward: promoCode.reward,
        maxUses: promoCode.maxUses,
        expiresAt: promoCode.expiresAt,
        isActive: promoCode.isActive
      }
    });
  } catch (error) {
    console.error('Create promo code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create promo code'
    });
  }
});

// Update promo code (admin only)
router.post('/promo/update', verifyAdmin, async (req, res) => {
  try {
    const { promoId, reward, maxUses, isActive, expiresAt } = req.body;
    
    if (!promoId) {
      return res.status(400).json({
        success: false,
        message: 'Promo code ID is required'
      });
    }
    
    const promoCode = await PromoCode.findById(promoId);
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }
    
    if (reward !== undefined) promoCode.reward = parseInt(reward);
    if (maxUses !== undefined) promoCode.maxUses = maxUses ? parseInt(maxUses) : null;
    if (isActive !== undefined) promoCode.isActive = isActive;
    if (expiresAt !== undefined) promoCode.expiresAt = expiresAt ? new Date(expiresAt) : null;
    
    await promoCode.save();
    
    res.json({
      success: true,
      message: 'Promo code updated successfully',
      promoCode: {
        id: promoCode._id,
        code: promoCode.code,
        reward: promoCode.reward,
        maxUses: promoCode.maxUses,
        currentUses: promoCode.currentUses,
        isActive: promoCode.isActive,
        expiresAt: promoCode.expiresAt
      }
    });
  } catch (error) {
    console.error('Update promo code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update promo code'
    });
  }
});

// Delete promo code (admin only)
router.post('/promo/delete', verifyAdmin, async (req, res) => {
  try {
    const { promoId } = req.body;
    
    if (!promoId) {
      return res.status(400).json({
        success: false,
        message: 'Promo code ID is required'
      });
    }
    
    const promoCode = await PromoCode.findByIdAndDelete(promoId);
    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Promo code deleted successfully'
    });
  } catch (error) {
    console.error('Delete promo code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete promo code'
    });
  }
});

// Get statistics (admin only)
router.post('/stats', verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastOnline: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    const totalTasks = await Task.countDocuments();
    const activeTasks = await Task.countDocuments({ isActive: true });
    const totalPromoCodes = await PromoCode.countDocuments();
    const activePromoCodes = await PromoCode.countDocuments({ isActive: true });
    
    const topUsersByBalance = await User.find()
      .sort({ balance: -1 })
      .limit(10)
      .select('username balance');
    
    const topUsersByReferrals = await User.find()
      .sort({ referralCount: -1 })
      .limit(10)
      .select('username referralCount');
    
    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active24h: activeUsers
        },
        tasks: {
          total: totalTasks,
          active: activeTasks
        },
        promoCodes: {
          total: totalPromoCodes,
          active: activePromoCodes
        },
        topByBalance: topUsersByBalance,
        topByReferrals: topUsersByReferrals
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
});

module.exports = router;
