// Telegram Clicker Game - Client Side Integration
class ClickerGameClient {
    constructor() {
        this.balance = 0;
        this.incomePerSecond = 0;
        this.clickPower = 1;
        this.userId = null;
        this.userName = '';
        this.referralCount = 0;
        this.referralEarned = 0;
        this.referralLink = '';
        this.isLoading = false;
        this.isAdmin = false;
        this.apiUrl = '/api/game';
        
        this.init();
    }

    async init() {
        // Initialize Telegram WebApp
        try {
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.ready();
                window.Telegram.WebApp.expand();
                window.Telegram.WebApp.disableVerticalSwipes();
                
                const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe;
                if (initDataUnsafe && initDataUnsafe.user) {
                    this.userId = initDataUnsafe.user.id.toString();
                    this.userName = initDataUnsafe.user.first_name || 'Unknown';
                    
                    // Check for referral parameter
                    const startParam = initDataUnsafe.start_param;
                    console.log('Start param from Telegram:', startParam);
                    if (startParam) {
                        this.referredBy = startParam;
                        console.log('Referral detected:', this.referredBy);
                    }
                } else {
                    this.userId = 'demo_' + Math.random().toString(36).substr(2, 9);
                    this.userName = 'Demo User';
                }
            } else {
                this.userId = 'demo_' + Math.random().toString(36).substr(2, 9);
                this.userName = 'Demo User';
            }
        } catch (error) {
            console.error('Telegram init error:', error);
            this.userId = 'demo_' + Math.random().toString(36).substr(2, 9);
            this.userName = 'Demo User';
        }

        console.log('User initialized:', this.userId, this.userName);

        await this.loadGameData();
        this.setupEventListeners();
        this.startIncomeTimer();
        
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.loadGameData();
            }
        });
    }

    async loadGameData() {
        try {
            this.isLoading = true;
            
            const requestBody = {
                telegramId: this.userId,
                username: this.userName,
                referredBy: this.referredBy
            };
            console.log('Sending init request:', requestBody);
            
            const response = await fetch(`${this.apiUrl}/init`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            
            if (data.success && data.user) {
                this.balance = data.user.balance;
                this.incomePerSecond = data.user.incomePerSecond;
                this.clickPower = data.user.clickPower;
                this.referralCount = data.user.referralCount;
                this.referralEarned = data.user.referralEarnings;
                this.isAdmin = data.user.isAdmin;
                this.botUsername = data.user.botUsername;
                
                if (data.user.offlineEarnings > 0) {
                    this.showNotification(`Вы заработали ${this.formatNumber(data.user.offlineEarnings)} монет офлайн!`);
                }
                
                this.generateReferralLink();
                this.updateUI();
            }
        } catch (error) {
            console.error('Load game data error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    setupEventListeners() {
        const coin = document.getElementById('coin');
        
        coin.addEventListener('click', (e) => this.handleCoinClick(e));
        coin.addEventListener('mousedown', () => coin.classList.add('clicked'));
        coin.addEventListener('mouseup', () => coin.classList.remove('clicked'));
        
        coin.addEventListener('touchstart', (e) => {
            e.preventDefault();
            coin.classList.add('clicked');
            this.handleCoinClick(e);
        }, { passive: false });
        
        coin.addEventListener('touchend', (e) => {
            e.preventDefault();
            coin.classList.remove('clicked');
        }, { passive: false });
    }

    async handleCoinClick(e) {
        if (this.isLoading) return;
        
        const coin = document.getElementById('coin');
        coin.classList.add('active-animation');
        setTimeout(() => coin.classList.remove('active-animation'), 300);
        
        // Optimistic UI update
        this.balance += this.clickPower;
        this.updateBalance();
        this.showClickEffect(e, this.clickPower);
        
        if (navigator.vibrate) navigator.vibrate(50);
        
        // Send to server
        try {
            const response = await fetch(`${this.apiUrl}/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId: this.userId, clicks: 1 })
            });
            
            const data = await response.json();
            if (data.success) {
                this.balance = data.balance;
                this.updateBalance();
            }
        } catch (error) {
            console.error('Click error:', error);
        }
    }

    showClickEffect(e, amount) {
        const effect = document.createElement('div');
        effect.className = 'click-effect';
        effect.textContent = `+${this.formatNumber(amount)}`;
        
        const rect = e.target.getBoundingClientRect();
        let clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || rect.left + rect.width / 2;
        let clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || rect.top + rect.height / 2;
        
        effect.style.left = (clientX - rect.left) + 'px';
        effect.style.top = (clientY - rect.top) + 'px';
        
        e.target.parentNode.appendChild(effect);
        setTimeout(() => effect.remove(), 1000);
    }

    startIncomeTimer() {
        setInterval(() => {
            if (this.incomePerSecond > 0) {
                this.balance += this.incomePerSecond;
                this.updateBalance();
            }
        }, 1000);
    }

    updateUI() {
        this.updateBalance();
        document.getElementById('income').textContent = `Доход: ${this.formatNumber(this.incomePerSecond)}/сек`;
        this.updateReferralUI();
    }

    updateBalance() {
        document.getElementById('balance').textContent = this.formatNumber(this.balance);
    }

    updateReferralUI() {
        const elements = {
            count: document.getElementById('referralCount'),
            earned: document.getElementById('referralEarned'),
            link: document.getElementById('referralLink')
        };
        
        if (elements.count) elements.count.textContent = this.referralCount;
        if (elements.earned) elements.earned.textContent = this.formatNumber(this.referralEarned);
        if (elements.link) elements.link.value = this.referralLink;
    }

    generateReferralLink() {
        if (!this.botUsername) {
            this.botUsername = 'PhilipMorrisCoin_Bot';
        }
        this.referralLink = `https://t.me/${this.botUsername}/${this.botUsername}?startapp=${this.userId}`;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toFixed(2); // Display two decimal places for numbers less than 1000
    }

    showNotification(message) {
        console.log('Notification:', message);
        // Could add visual notification here
    }

    // Leaderboard methods
    async loadTopPlayers() {
        try {
            const response = await fetch(`${this.apiUrl}/leaderboard/balance`);
            const data = await response.json();
            if (data.success) this.displayTopPlayers(data.leaderboard);
        } catch (error) {
            console.error('Load top players error:', error);
        }
    }

    displayTopPlayers(players) {
        const topList = document.getElementById('topList');
        if (!players || players.length === 0) {
            topList.innerHTML = '<div class="loading">Пока нет игроков в рейтинге</div>';
            return;
        }

        let html = '<ul class="top-list">';
        players.forEach(player => {
            const style = player.isTopThree ? 'background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #333;' : '';
            const trophy = player.isTopThree ? '🏆 ' : '';
            html += `
                <li class="top-item" style="${style}">
                    <div>
                        <span class="top-rank">#${player.rank}</span>
                        <span>${trophy}${player.username}</span>
                    </div>
                    <div>${this.formatNumber(player.balance)}</div>
                </li>
            `;
        });
        html += '</ul>';
        topList.innerHTML = html;
    }

    async loadTopReferrals() {
        try {
            const response = await fetch(`${this.apiUrl}/leaderboard/referrals`);
            const data = await response.json();
            if (data.success) this.displayTopReferrals(data.leaderboard);
        } catch (error) {
            console.error('Load top referrals error:', error);
        }
    }

    displayTopReferrals(players) {
        const topList = document.getElementById('topReferralsList');
        if (!players || players.length === 0) {
            topList.innerHTML = '<div class="loading">Пока нет игроков в рейтинге</div>';
            return;
        }

        let html = '<ul class="top-list">';
        players.forEach(player => {
            const style = player.isFirstPlace ? 'background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); color: #333;' : '';
            const trophy = player.isFirstPlace ? '🏆 ' : '';
            html += `
                <li class="top-item" style="${style}">
                    <div>
                        <span class="top-rank">#${player.rank}</span>
                        <span>${trophy}${player.username}</span>
                    </div>
                    <div>${player.referralCount} рефералов</div>
                </li>
            `;
        });
        html += '</ul>';
        topList.innerHTML = html;
    }

    // Upgrade methods
    async loadPassiveUpgrades() {
        try {
            const response = await fetch(`${this.apiUrl}/upgrades/passive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId: this.userId })
            });

            const data = await response.json();
            if (data.success) this.displayPassiveUpgrades(data.upgrades);
        } catch (error) {
            console.error('Load passive upgrades error:', error);
        }
    }

    displayPassiveUpgrades(upgrades) {
        const list = document.getElementById('passiveUpgradeList');
        if (!upgrades || upgrades.length === 0) {
            list.innerHTML = '<div class="loading">Улучшения недоступны</div>';
            return;
        }

        let html = '';
        upgrades.forEach(u => {
            html += `
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <div class="upgrade-name">${u.icon} ${u.name} (${u.level})</div>
                        <div class="upgrade-price">${this.formatNumber(u.price)}</div>
                    </div>
                    <div class="upgrade-description">${u.description}</div>
                    <button class="buy-btn" ${u.canAfford ? '' : 'disabled'} 
                            onclick="game.buyPassiveUpgrade(${u.id})">
                        Купить (+${u.income}/сек)
                    </button>
                </div>
            `;
        });
        list.innerHTML = html;
    }

    async loadClickUpgrades() {
        try {
            const response = await fetch(`${this.apiUrl}/upgrades/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId: this.userId })
            });

            const data = await response.json();
            if (data.success) this.displayClickUpgrades(data.upgrades);
        } catch (error) {
            console.error('Load click upgrades error:', error);
        }
    }

    displayClickUpgrades(upgrades) {
        const list = document.getElementById('clickUpgradeList');
        if (!upgrades || upgrades.length === 0) {
            list.innerHTML = '<div class="loading">Улучшения недоступны</div>';
            return;
        }

        let html = '';
        upgrades.forEach(u => {
            html += `
                <div class="upgrade-item">
                    <div class="upgrade-header">
                        <div class="upgrade-name">${u.icon} ${u.name} (${u.level})</div>
                        <div class="upgrade-price">${this.formatNumber(u.price)}</div>
                    </div>
                    <div class="upgrade-description">${u.description}</div>
                    <button class="buy-btn" ${u.canAfford ? '' : 'disabled'} 
                            onclick="game.buyClickUpgrade(${u.id})">
                        Купить (+${u.clickBoost} за клик)
                    </button>
                </div>
            `;
        });
        list.innerHTML = html;
    }

    async buyPassiveUpgrade(upgradeId) {
        try {
            const response = await fetch(`${this.apiUrl}/upgrades/passive/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId: this.userId, upgradeId })
            });

            const data = await response.json();
            if (data.success) {
                this.balance = data.balance;
                this.incomePerSecond = data.incomePerSecond;
                this.updateUI();
                this.loadPassiveUpgrades();
            } else {
                alert(data.message || 'Не удалось купить улучшение');
            }
        } catch (error) {
            console.error('Не удалось купить улучшение:', error);
        }
    }

    async buyClickUpgrade(upgradeId) {
        try {
            const response = await fetch(`${this.apiUrl}/upgrades/click/buy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId: this.userId, upgradeId })
            });

            const data = await response.json();
            if (data.success) {
                this.balance = data.balance;
                this.clickPower = data.clickPower;
                this.updateUI();
                this.loadClickUpgrades();
            } else {
                alert(data.message || 'Не удалось купить улучшение');
            }
        } catch (error) {
            console.error('Buy click upgrade error:', error);
        }
    }

    async activatePromo() {
        const promoInput = document.getElementById('promoInput');
        const code = promoInput.value.trim();
        const messageEl = document.getElementById('promoMessage');
        
        if (!code) {
            messageEl.textContent = 'Введите промокод';
            messageEl.className = 'promo-message error';
            return;
        }
        
        try {
            const response = await fetch(`${this.apiUrl}/promo/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId: this.userId, code })
            });

            const data = await response.json();
            
            if (data.success) {
                this.balance = data.balance;
                this.updateBalance();
                messageEl.textContent = `✅ ${data.message} +${this.formatNumber(data.reward)}`;
                messageEl.className = 'promo-message success';
                promoInput.value = '';
            } else {
                messageEl.textContent = data.message;
                messageEl.className = 'promo-message error';
            }
            
            setTimeout(() => {
                messageEl.className = 'promo-message';
            }, 3000);
        } catch (error) {
            console.error('Activate promo error:', error);
            messageEl.textContent = 'Ошибка активации промокода';
            messageEl.className = 'promo-message error';
        }
    }

    // Tasks methods
    async loadTasks() {
        try {
            const response = await fetch(`${this.apiUrl}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId: this.userId })
            });

            const data = await response.json();
            if (data.success) {
                this.displayTasks(data.tasks);
            }
        } catch (error) {
            console.error('Load tasks error:', error);
            document.getElementById('tasksList').innerHTML = '<div class="loading">Ошибка загрузки заданий</div>';
        }
    }

    displayTasks(tasks) {
        const tasksList = document.getElementById('tasksList');
        if (!tasks || tasks.length === 0) {
            tasksList.innerHTML = '<div class="loading">Нет доступных заданий</div>';
            return;
        }

        let html = '';
        tasks.forEach(task => {
            const completedClass = task.completed ? 'completed' : '';
            html += `
                <div class="task-item ${completedClass}">
                    <div class="task-header">
                        <div class="task-title">${task.title}</div>
                        <div class="task-reward">+${this.formatNumber(task.reward)}</div>
                    </div>
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    ${task.completed ? `
                        <div class="task-completed-badge">✅ Выполнено</div>
                    ` : `
                        <div class="task-actions">
                            <button class="task-btn" onclick="game.openTaskChannel('${task.channelLink}')">
                                📢 Подписаться
                            </button>
                            <button class="task-btn check-btn" onclick="game.checkTask('${task.id}')">
                                ✅ Проверить
                            </button>
                        </div>
                    `}
                </div>
            `;
        });
        tasksList.innerHTML = html;
    }

    openTaskChannel(channelLink) {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openTelegramLink(channelLink);
        } else {
            window.open(channelLink, '_blank');
        }
    }

    async checkTask(taskId) {
        try {
            const response = await fetch(`${this.apiUrl}/tasks/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId: this.userId, taskId })
            });

            const data = await response.json();
            
            if (data.success) {
                this.balance = data.balance;
                this.updateBalance();
                this.showNotification(`✅ Задание выполнено! +${this.formatNumber(data.reward)}`);
                this.loadTasks(); // Reload tasks to update UI
            } else {
                alert(data.message || 'Задание не выполнено. Убедитесь, что вы подписались на канал.');
            }
        } catch (error) {
            console.error('Check task error:', error);
            alert('Ошибка проверки задания');
        }
    }
}

// Initialize game
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new ClickerGameClient();
});

// Global functions for HTML onclick handlers
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
    
    if (modalId === 'topModal') {
        game.loadTopPlayers();
    } else if (modalId === 'tasksModal') {
        game.loadTasks();
    } else if (modalId === 'bonusModal') {
        game.loadPassiveUpgrades();
        game.updateReferralUI();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function switchTopTab(tabName) {
    document.querySelectorAll('#topModal .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('#topModal .tab-panel').forEach(panel => panel.classList.remove('active'));
    
    if (tabName === 'balance') {
        document.getElementById('topBalanceTab').classList.add('active');
        game.loadTopPlayers();
    } else if (tabName === 'referrals') {
        document.getElementById('topReferralsTab').classList.add('active');
        game.loadTopReferrals();
    }
}

function switchBonusTab(tabName) {
    document.querySelectorAll('#bonusModal .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('#bonusModal .tab-panel').forEach(panel => panel.classList.remove('active'));
    
    if (tabName === 'passive') {
        document.getElementById('passiveTab').classList.add('active');
        game.loadPassiveUpgrades();
    } else if (tabName === 'click') {
        document.getElementById('clickTab').classList.add('active');
        game.loadClickUpgrades();
    } else if (tabName === 'referral') {
        document.getElementById('referralTab').classList.add('active');
        game.updateReferralUI();
    }
}

function copyReferralLink() {
    const input = document.getElementById('referralLink');
    input.select();
    document.execCommand('copy');
    
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ Скопировано!';
    setTimeout(() => btn.textContent = originalText, 2000);
}

function shareReferralLink() {
    if (window.Telegram?.WebApp) {
        const shareMessage = 'Присоединяйся к игре! (Что бы тот кто тебя пригласил получил бонус при переходе в бота пропиши /start а только потом заходи в игру) Моя реферальная ссылка:'; // Customize this message
        window.Telegram.WebApp.openTelegramLink(
            `https://t.me/share/url?url=${encodeURIComponent(game.referralLink)}&text=${encodeURIComponent(shareMessage)}`
        );
    } else if (navigator.share) {
        navigator.share({
            title: 'Присоединяйся к игре!',
            url: game.referralLink
        });
    } else {
        copyReferralLink();
    }
}

function activatePromo() {
    game.activatePromo();
}
