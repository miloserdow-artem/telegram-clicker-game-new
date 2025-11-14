const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load .env from project root
const mongoose = require('mongoose');
const User = require('../models/User'); // Corrected path to your User model

async function migrateUsers() {
  try {
    console.log(process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB for migration');

    // Обновляем всех пользователей, добавляя новые поля, если их нет
    const result = await User.updateMany(
      {
        $or: [
          { bombs: { $exists: false } },
          { shields: { $exists: false } },
          { shieldActiveUntil: { $exists: false } }, // Also include shieldActiveUntil
          { dailyRewardStreak: { $exists: false } },
          { lastClaimedDailyRewardDate: { $exists: false } }
        ]
      },
      {
        $set: {
          bombs: 0, // Дефолтное значение для бомб
          shields: 0, // Дефолтное значение для щитов
          shieldActiveUntil: null, // Дефолтное значение для shieldActiveUntil
          dailyRewardStreak: 0, // Дефолтное значение для dailyRewardStreak
          lastClaimedDailyRewardDate: null // Дефолтное значение для lastClaimedDailyRewardDate
        }
      }
    );

    console.log(`✅ Миграция завершена: ${result.modifiedCount} пользователей обновлено.`);
  } catch (error) {
    console.error('❌ Ошибка при миграции:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrateUsers();
