// Passive Income Upgrades
const PASSIVE_UPGRADES = [
  {
    id: 1,
    name: 'Кириешки',
    description: 'ХАхахахаххпхп',
    basePrice: 100,
    baseIncome: 0.01,
    priceMultiplier: 1.2,
    icon: '🍟'
  },
  {
    id: 2,
    name: 'Кириешки 2',
    description: 'Тоже самое что первое только покруче',
    basePrice: 1000,
    baseIncome: 0.1,
    priceMultiplier: 1.2,
    icon: '⛏️'
  },
  {
    id: 3,
    name: 'Кириешки 3',
    description: 'С холодцом и хреном',
    basePrice: 10000,
    baseIncome: 1,
    priceMultiplier: 1.2,
    icon: '🏭'
  },
  {
    id: 4,
    name: 'Чивапчичи',
    description: 'Хз просто слово смешное',
    basePrice: 100000,
    baseIncome: 5,
    priceMultiplier: 1.2,
    icon: '🏦'
  },
  {
    id: 5,
    name: 'Чивапчичи 2',
    description: 'Ну типо ты крут если купил',
    basePrice: 1000000,
    baseIncome: 25,
    priceMultiplier: 1.2,
    icon: '🚗'
  },
  {
    id: 6,
    name: 'Чивапчичи 3',
    description: 'Будто фильм Чивапчичи: 3',
    basePrice: 10000000,
    baseIncome: 100,
    priceMultiplier: 1.2,
    icon: '🧑🏻'
  },
  {
    id: 7,
    name: 'Артёмчик и Костик',
    description: 'Да да мы',
    basePrice: 100000000,
    baseIncome: 500,
    priceMultiplier: 1.2,
    icon: '👦🏻'
  },
  {
    id: 8,
    name: 'Филип Моррис!',
    description: 'Самый высокий статус',
    basePrice: 1000000000,
    baseIncome: 2500,
    priceMultiplier: 1.2,
    icon: '🚬'
  }
];

// Click Power Upgrades
const CLICK_UPGRADES = [
  {
    id: 1,
    name: 'Лох',
    description: 'Не придумал описание',
    basePrice: 200,
    clickBoost: 1,
    priceMultiplier: 1.7,
    icon: '👆'
  },
  {
    id: 2,
    name: 'Нормис',
    description: 'Ну ты уже чего то достиг',
    basePrice: 2000,
    clickBoost: 2,
    priceMultiplier: 1.7,
    icon: '💪'
  },
  {
    id: 3,
    name: 'Среднячок',
    description: 'Давай побольше, ок?',
    basePrice: 20000,
    clickBoost: 5,
    priceMultiplier: 1.7,
    icon: '👊'
  },
  {
    id: 4,
    name: 'Норм чел',
    description: 'Не дать не взять',
    basePrice: 200000,
    clickBoost: 10,
    priceMultiplier: 1.7,
    icon: '⚡'
  },
  {
    id: 5,
    name: 'Крутой',
    description: 'Мы начинаем тебя уважать',
    basePrice: 2000000,
    clickBoost: 25,
    priceMultiplier: 1.7,
    icon: '✨'
  },
  {
    id: 6,
    name: 'Мега крутой',
    description: 'Реально респект',
    basePrice: 20000000,
    clickBoost: 50,
    priceMultiplier: 1.7,
    icon: '🌟'
  }
];

// Helper functions
function calculateUpgradePrice(basePrice, level, multiplier) {
  return Math.floor(basePrice * Math.pow(multiplier, level));
}

function calculateUpgradeIncome(baseIncome, level) {
  return baseIncome * level;
}

function calculateClickBoost(baseBoost, level) {
  return baseBoost * level;
}

function getPassiveUpgrade(id) {
  return PASSIVE_UPGRADES.find(u => u.id === id);
}

function getClickUpgrade(id) {
  return CLICK_UPGRADES.find(u => u.id === id);
}

module.exports = {
  PASSIVE_UPGRADES,
  CLICK_UPGRADES,
  calculateUpgradePrice,
  calculateUpgradeIncome,
  calculateClickBoost,
  getPassiveUpgrade,
  getClickUpgrade
};
