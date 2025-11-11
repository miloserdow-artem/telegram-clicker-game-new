require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api'); // Import Telegram Bot API

// Import routes
const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Telegram Bot Token
const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  console.error('❌ BOT_TOKEN is not set in environment variables.');
  process.exit(1);
}
const bot = new TelegramBot(botToken, { polling: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Telegram Bot Handlers
bot.onText(/^\/start (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referrerId = match[1]; // Captured referrer ID from the deep link
  const webAppUrl = process.env.WEB_APP_URL || `https://t.me/${process.env.BOT_USERNAME || 'PhilipMorrisCoin_Bot'}/?startapp=${referrerId}`;

  console.log(`User ${chatId} started bot with referrer ID: ${referrerId}`);

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Играть', web_app: { url: webAppUrl } }]
      ]
    }
  };
  bot.sendMessage(chatId, 'Добро пожаловать! Нажмите "Играть", чтобы начать.', opts);
});

bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  const webAppUrl = process.env.WEB_APP_URL || `https://t.me/${process.env.BOT_USERNAME || 'PhilipMorrisCoin_Bot'}`;

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Играть', web_app: { url: webAppUrl } }]
      ]
    }
  };
  bot.sendMessage(chatId, 'Добро пожаловать! Нажмите "Играть", чтобы начать.', opts);
});

bot.on('message', (msg) => {
  // Ignore /start commands as they are handled by onText
  if (msg.text && msg.text.startsWith('/start')) {
    return;
  }
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Я бот-кликер! Нажмите /start, чтобы начать игру.');
});

// Routes
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  mongoose.connection.close();
  bot.stopPolling(); // Stop bot polling
  process.exit(0);
});
