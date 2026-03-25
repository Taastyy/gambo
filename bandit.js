// ==========================================================================
// SUPER BANDIT - Advanced Slot Machine Game Logic
// ==========================================================================

// ==========================================================================
// SOUND ENGINE (Web Audio API – no files needed)
// ==========================================================================
var _sndCtx = null;
function _ensureSnd() {
    if (!_sndCtx) try { _sndCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
}
function _tone(freq, dur, vol, type, detune) {
    if (!_sndCtx) return;
    try {
        var o = _sndCtx.createOscillator();
        var g = _sndCtx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        if (detune) o.detune.value = detune;
        g.gain.setValueAtTime(vol || 0.08, _sndCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, _sndCtx.currentTime + dur);
        o.connect(g); g.connect(_sndCtx.destination);
        o.start(); o.stop(_sndCtx.currentTime + dur);
    } catch (e) { }
}

// --- Individual sound effects ---
function sfxSpinStart() {
    // Lever pull / whoosh: descending noise burst
    _tone(600, 0.08, 0.07, 'sawtooth');
    setTimeout(function () { _tone(400, 0.06, 0.05, 'sawtooth'); }, 40);
    setTimeout(function () { _tone(250, 0.06, 0.04, 'sawtooth'); }, 80);
}

function sfxReelTick() {
    // Soft click per symbol change
    _tone(1200 + Math.random() * 400, 0.02, 0.015, 'square');
}

function sfxReelStop(reelIndex) {
    // Heavy thunk – pitch rises slightly with each reel
    var base = 180 + reelIndex * 30;
    _tone(base, 0.12, 0.1, 'sine');
    _tone(base * 0.5, 0.08, 0.06, 'triangle');
}

function sfxWin() {
    // Ascending major triad chime
    _tone(523, 0.18, 0.09, 'sine');            // C5
    setTimeout(function () { _tone(659, 0.18, 0.09, 'sine'); }, 100);  // E5
    setTimeout(function () { _tone(784, 0.22, 0.10, 'sine'); }, 200);  // G5
    setTimeout(function () { _tone(1047, 0.25, 0.08, 'sine'); }, 320); // C6
}

function sfxBigWin() {
    // Fanfare arpeggio
    var notes = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
    notes.forEach(function (n, i) {
        setTimeout(function () {
            _tone(n, 0.2, 0.08, 'sine');
            _tone(n * 0.5, 0.15, 0.04, 'triangle');
        }, i * 100);
    });
}

function sfxJackpot() {
    // Dramatic rising cascade with shimmer
    var notes = [262, 330, 392, 523, 659, 784, 1047, 1319, 1568, 2093];
    notes.forEach(function (n, i) {
        setTimeout(function () {
            _tone(n, 0.3, 0.07, 'sine');
            _tone(n * 1.005, 0.3, 0.05, 'sine');  // slight detune = shimmer
            _tone(n * 0.5, 0.2, 0.03, 'triangle');
        }, i * 120);
    });
}

function sfxLose() {
    // Low descending minor tone
    _tone(350, 0.15, 0.05, 'sine');
    setTimeout(function () { _tone(280, 0.18, 0.04, 'sine'); }, 120);
    setTimeout(function () { _tone(220, 0.22, 0.03, 'triangle'); }, 240);
}

function sfxClick() {
    _tone(800, 0.03, 0.03, 'sine');
}


// Game symbols with their values (5 reel game)
const SYMBOLS = [
    { emoji: '🍒', name: 'cherry', value: 5, color: '#ff3366' },
    { emoji: '🍋', name: 'lemon', value: 10, color: '#ffd700' },
    { emoji: '🍊', name: 'orange', value: 15, color: '#ff9900' },
    { emoji: '🍇', name: 'grapes', value: 25, color: '#9933ff' },
    { emoji: '⭐', name: 'star', value: 50, color: '#00ffff' },
    { emoji: '🔔', name: 'bell', value: 100, color: '#ffd700' },
    { emoji: '💎', name: 'diamond', value: 200, color: '#00ffff' },
    { emoji: '7️⃣', name: 'seven', value: 500, color: '#ff00ff' }
];

// Game state
let currentBet = 100;
let isSpinning = false;
let isAutoroll = false;
let autorollTimeout = null;

let jackpot = 0;

// Statistics
let stats = {
    totalGames: 0,
    totalWins: 0,
    totalLosses: 0,
    totalLossesCount: 0,
    totalWinnings: 0,
    highestWin: 0,
    jackpots: 0,
    currentStreak: 0,
    maxStreak: 0
};

// DOM Elements
let reels = [];
let reelSymbols = [];
let spinBtn, balanceEl, betInput;

// Initialize game
document.addEventListener('DOMContentLoaded', function () {
    initializeElements();
    loadStats();
    initializeReels();
    setupEventListeners();
    updateUI();
    startDecoLights();
    loadJackpot();

    // Stop autoroll when page is unloaded
    window.addEventListener('beforeunload', function () {
        if (isAutoroll) {
            localStorage.setItem('banditAutoroll', 'false');
        }
    });
});

// Initialize DOM elements
function initializeElements() {
    spinBtn = document.getElementById('spin-btn');
    balanceEl = document.getElementById('balance');
    betInput = document.getElementById('bet-input');

    // Get reel elements
    for (let i = 1; i <= 5; i++) {
        reels.push(document.getElementById(`reel${i}`));
        reelSymbols.push(document.getElementById(`reel${i}-symbols`));
    }
}

// Setup event listeners
function setupEventListeners() {
    // Close modal
    document.getElementById('close-stats-modal').addEventListener('click', closeStatsModal);

    // Close modal on overlay click
    document.getElementById('stats-modal-overlay').addEventListener('click', function (e) {
        if (e.target === this) {
            closeStatsModal();
        }
    });

    // Reset stats button
    document.getElementById('reset-stats-btn').addEventListener('click', resetStats);

    // Bet preset buttons
    document.querySelectorAll('.bet-preset-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const bet = parseInt(this.dataset.bet);
            setBet(bet);

            // Update active state
            document.querySelectorAll('.bet-preset-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Bet input change
    betInput.addEventListener('change', function () {
        let value = parseInt(this.value);
        if (value < 1) value = 1;
        currentBet = value;
        this.value = value;
        updateBetPreset();
        updateUI();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        if (e.code === 'Space' && !isSpinning && !isAutoroll) {
            e.preventDefault();
            spin();
        } else if (e.code === 'KeyA') {
            toggleAutoroll();
        } else if (e.code === 'ArrowUp') {
            adjustBet(10);
        } else if (e.code === 'ArrowDown') {
            adjustBet(-10);
        }
    });
}

// Initialize reels with random symbols
function initializeReels() {
    const symbols = SYMBOLS.map(s => s.emoji);

    reelSymbols.forEach((reel, index) => {
        // Create initial symbol display
        const randomSymbol = getRandomSymbol();
        reel.innerHTML = `<span class="reel-symbol">${randomSymbol.emoji}</span>`;
        reel.dataset.symbol = randomSymbol.emoji;
    });
}

// Get random symbol
function getRandomSymbol() {
    // Weighted random - lower symbols more common
    const weights = [30, 25, 20, 15, 10, 8, 5, 2];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
            return SYMBOLS[i];
        }
    }

    return SYMBOLS[0];
}

// Adjust bet
function adjustBet(amount) {
    _ensureSnd(); sfxClick();
    if (isSpinning) return;

    const newBet = currentBet + amount;
    if (newBet >= 1) {
        currentBet = newBet;
        betInput.value = currentBet;
        updateBetPreset();
        updateUI();
    }
}

// Set bet directly
function setBet(bet) {
    if (isSpinning) return;

    currentBet = Math.max(1, bet);
    betInput.value = currentBet;
    updateUI();
}

// Update bet preset buttons
function updateBetPreset() {
    document.querySelectorAll('.bet-preset-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.bet) === currentBet) {
            btn.classList.add('active');
        }
    });
}

// Half the bet
function halfBet() {
    if (isSpinning) return;

    currentBet = Math.max(1, Math.floor(currentBet / 2));
    betInput.value = currentBet;
    updateBetPreset();
    updateUI();
}

// Double the bet
function doubleBet() {
    if (isSpinning) return;

    currentBet = currentBet * 2;
    betInput.value = currentBet;
    updateBetPreset();
    updateUI();
}

// Max bet
function maxBet() {
    if (isSpinning) return;

    if (typeof getBalanceSync === 'function') {
        balance = getBalanceSync();
        currentBet = Math.max(1, balance);
        betInput.value = currentBet;
        updateBetPreset();
        updateUI();
    }
}

// Toggle autoroll
function toggleAutoroll() {
    isAutoroll = !isAutoroll;
    const btn = document.getElementById('autoroll-btn');
    const btnText = btn.querySelector('.autoroll-text');

    if (isAutoroll) {
        btn.classList.add('active');
        btnText.textContent = 'STOPPEN';
        showMessage('⚡ Autoroll aktiviert!', 'success');
        startAutoroll();
    } else {
        btn.classList.remove('active');
        btnText.textContent = 'AUTOROLL';
        if (autorollTimeout) {
            clearTimeout(autorollTimeout);
            autorollTimeout = null;
        }
        showMessage('⏹️ Autoroll deaktiviert!', 'info');
    }
}

// Start autoroll
function startAutoroll() {
    if (!isAutoroll) return;

    // Get current balance
    if (typeof getBalanceSync === 'function') {
        balance = getBalanceSync();
    }

    // Check if balance is sufficient
    if (balance < currentBet) {
        showMessage('❌ Nicht genügend Guthaben für Autoroll!', 'error');
        toggleAutoroll();
        return;
    }

    // Start spin
    spin().then(() => {
        // Continue autoroll after spin completes
        if (isAutoroll) {
            autorollTimeout = setTimeout(() => {
                startAutoroll();
            }, 500);
        }
    });
}

// Load jackpot from storage
function loadJackpot() {
    const savedJackpot = localStorage.getItem('banditJackpot');
    if (savedJackpot) {
        jackpot = parseInt(savedJackpot);
        document.getElementById('jackpot').textContent = jackpot.toLocaleString();
    }
}

// Save jackpot to storage
function saveJackpot() {
    localStorage.setItem('banditJackpot', jackpot.toString());
}

// Main spin function
async function spin() {
    if (isSpinning) return Promise.resolve();

    let balance = 0;
    if (typeof getBalanceSync === 'function') balance = getBalanceSync();

    if (balance < currentBet) {
        showMessage('Nicht genügend Guthaben!', 'error');
        return Promise.resolve();
    }

    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.querySelector('.spin-text').textContent = 'DREHT...';

    _ensureSnd();
    sfxSpinStart();
    clearWinHighlights();
    document.getElementById('win-display').classList.add('hidden');

    let serverResult = null;
    try {
        const token = localStorage.getItem('casinoToken') || '';
        const res = await fetch('/api/bandit/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ bet: currentBet })
        });
        serverResult = await res.json();
    } catch (e) {
        showMessage('Netzwerkfehler', 'error');
        isSpinning = false;
        spinBtn.disabled = false;
        spinBtn.querySelector('.spin-text').textContent = 'DREHEN';
        return Promise.resolve();
    }

    if (!serverResult || !serverResult.success) {
        showMessage(serverResult?.error || 'Server error', 'error');
        isSpinning = false;
        spinBtn.disabled = false;
        spinBtn.querySelector('.spin-text').textContent = 'DREHEN';
        return Promise.resolve();
    }

    const { symbols: finalSymbols, win, isJackpot, multiplier, wonAmount, winningIndices, newBalance } = serverResult;
    
    // balance is immediately deducted on server, we can reflect locally
    if (document.getElementById('balance')) document.getElementById('balance').textContent = Math.round(newBalance - wonAmount);

    const spinPromises = [];
    for (let i = 0; i < 5; i++) {
        reels[i].classList.add('spinning');
        spinPromises.push(spinReel(i, finalSymbols[i]));
    }

    await Promise.all(spinPromises);

    const result = { win, isJackpot, multiplier, symbols: finalSymbols, winningIndices };
    updateStats(result, currentBet);

    if (win) {
        if (isJackpot) {
            jackpot += wonAmount;
            saveJackpot();
            document.getElementById('jackpot').textContent = jackpot.toLocaleString();
        }

        highlightWins(winningIndices);

        if (isJackpot) sfxJackpot();
        else if (multiplier >= 50) sfxBigWin();
        else sfxWin();
        
        showWinDisplay(wonAmount, result);

        if (multiplier >= 50) {
            await triggerBigWinAnimation(wonAmount, result);
        }
    } else {
        sfxLose();
        showMessage('❌ Kein Gewinn. Versuche es nochmal!', 'error');
    }

    // sync final balance
    if (typeof window.syncBalance === 'function') window.syncBalance();
    if (document.getElementById('balance')) document.getElementById('balance').textContent = Math.round(newBalance);

    isSpinning = false;
    spinBtn.disabled = false;
    spinBtn.querySelector('.spin-text').textContent = 'DREHEN';
    
    updateUI();
    addToHistory(result, currentBet);

    return Promise.resolve();
}


// Spin individual reel
async function spinReel(index, finalSymbol) {
    const reel = reels[index];
    const reelSymbol = reelSymbols[index];

    // Rapid symbol change animation
    for (let i = 0; i < 15; i++) {
        const tempSymbol = getRandomSymbol();
        reelSymbol.innerHTML = `<span class="reel-symbol">${tempSymbol}</span>`;
        if (i % 3 === 0) sfxReelTick();  // tick every 3rd symbol
        await delay(50 + (index * 50));
    }

    // Slow down
    for (let i = 0; i < 5; i++) {
        const tempSymbol = getRandomSymbol();
        reelSymbol.innerHTML = `<span class="reel-symbol">${tempSymbol}</span>`;
        await delay(100 + (index * 50));
    }

    // Stop with final symbol
    reel.classList.remove('spinning');
    reel.classList.add('stopping');
    reelSymbol.innerHTML = `<span class="reel-symbol">${finalSymbol.emoji}</span>`;
    reelSymbol.dataset.symbol = finalSymbol.emoji;
    sfxReelStop(index);  // Sound: heavy thunk

    await delay(300);
    reel.classList.remove('stopping');
}

// Generate final symbols
function generateFinalSymbols() {
    const symbols = [];
    const winChance = 0.015; // 1.5% win rate
    const willWin = Math.random() < winChance;

    if (willWin) {
        // Choose a winning symbol (prefer rarer symbols for bigger wins)
        const winSymbol = getWinningSymbol();
        for (let i = 0; i < 5; i++) {
            symbols.push(winSymbol);
        }
    } else {
        // Generate symbols without 5 matching
        for (let i = 0; i < 5; i++) {
            symbols.push(getRandomSymbol());
        }

        // Make sure we don't have 5 matching
        const counts = {};
        symbols.forEach(s => {
            counts[s.emoji] = (counts[s.emoji] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(counts));
        if (maxCount >= 5) {
            // Change one symbol to break the win
            const changeIndex = Math.floor(Math.random() * 5);
            let newSymbol = getRandomSymbol();
            while (newSymbol.emoji === symbols[changeIndex].emoji) {
                newSymbol = getRandomSymbol();
            }
            symbols[changeIndex] = newSymbol;
        }
    }

    return symbols;
}

// Get winning symbol with weighted probability
function getWinningSymbol() {
    // Higher chance for bigger wins
    const roll = Math.random();
    if (roll < 0.02) {
        return SYMBOLS.find(s => s.name === 'seven'); // 2% jackpot
    } else if (roll < 0.05) {
        return SYMBOLS.find(s => s.name === 'diamond'); // 3% diamond
    } else if (roll < 0.12) {
        return SYMBOLS.find(s => s.name === 'bell'); // 7% bell
    } else if (roll < 0.25) {
        return SYMBOLS.find(s => s.name === 'star'); // 13% star
    } else if (roll < 0.45) {
        return SYMBOLS.find(s => s.name === 'grapes'); // 20% grapes
    } else {
        return SYMBOLS[Math.floor(Math.random() * 4)]; // 55% lower symbols
    }
}

// Check for win
function checkWin(symbols) {
    // Count matching symbols
    const counts = {};
    symbols.forEach(s => {
        counts[s.emoji] = (counts[s.emoji] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(counts));

    if (maxCount >= 3) {
        // Find the winning symbol
        const winningSymbol = symbols.find(s => counts[s.emoji] === maxCount);
        let multiplier = winningSymbol.value;
        let isJackpot = winningSymbol.name === 'seven';

        // Reduce multiplier for 3 or 4 matching symbols
        if (maxCount === 3) {
            multiplier = Math.floor(winningSymbol.value * 0.2);
        } else if (maxCount === 4) {
            multiplier = Math.floor(winningSymbol.value * 0.4);
        }

        return {
            win: true,
            isJackpot: isJackpot,
            multiplier: multiplier,
            symbols: symbols,
            winningIndices: symbols.map((s, i) => s.emoji === winningSymbol.emoji ? i : -1).filter(i => i !== -1)
        };
    }

    return {
        win: false,
        multiplier: 0,
        symbols: symbols,
        winningIndices: []
    };
}

// Highlight winning symbols
function highlightWins(winningIndices) {
    winningIndices.forEach(index => {
        reels[index].classList.add('winning');
        setTimeout(() => {
            reels[index].classList.remove('winning');
        }, 2000);
    });
}

// Clear win highlights
function clearWinHighlights() {
    reels.forEach(reel => {
        reel.classList.remove('winning');
    });
}

// Show win display
function showWinDisplay(winAmount, result) {
    const winDisplay = document.getElementById('win-display');
    const winAmountEl = document.getElementById('win-amount');
    const winMultiplierEl = document.getElementById('win-multiplier');

    winAmountEl.textContent = `+${winAmount.toLocaleString()}`;

    let multiplierText = '';
    if (result.isJackpot) {
        multiplierText = '🎉 JACKPOT! 🎉';
    } else {
        multiplierText = `${result.multiplier}x Gewinn!`;
    }
    winMultiplierEl.textContent = multiplierText;

    winDisplay.classList.remove('hidden');
}

// Trigger big win animation
async function triggerBigWinAnimation(winAmount, result) {
    const overlay = document.getElementById('win-overlay');
    const amountLarge = document.getElementById('win-amount-large');
    const winDetails = document.getElementById('win-details');

    // Set win details
    amountLarge.textContent = `+${winAmount.toLocaleString()}`;

    const symbolEmojis = result.symbols.map(s => s.emoji).join(' ');
    winDetails.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 10px;">${symbolEmojis}</div>
        <div>${result.isJackpot ? '🎉 JACKPOT! 🎉' : `${result.multiplier}x GEWINN!`}</div>
    `;

    // Show overlay
    overlay.classList.add('show');

    // Create confetti
    createConfetti();

    // Wait for animation
    await delay(4000);

    // Hide overlay
    overlay.classList.remove('show');
}

// Create confetti effect
function createConfetti() {
    const container = document.getElementById('confetti');
    container.innerHTML = '';

    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffd700'];

    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        container.appendChild(confetti);
    }
}

// Close win overlay
function closeWinOverlay() {
    document.getElementById('win-overlay').classList.remove('show');
}

// Update statistics
function updateStats(result, bet) {
    stats.totalGames++;

    if (result.win) {
        const winAmount = bet * result.multiplier;
        stats.totalWins++;
        stats.totalWinnings += winAmount;
        stats.currentStreak++;

        if (stats.currentStreak > stats.maxStreak) {
            stats.maxStreak = stats.currentStreak;
        }

        if (winAmount > stats.highestWin) {
            stats.highestWin = winAmount;
        }

        if (result.isJackpot) {
            stats.jackpots++;
        }
    } else {
        stats.currentStreak = 0;
        stats.totalLosses += bet;
        stats.totalLossesCount++;
    }

    saveStats();
}

// Save statistics to localStorage
function saveStats() {
    localStorage.setItem('banditStats', JSON.stringify(stats));
}

// Load statistics from localStorage
function loadStats() {
    const savedStats = localStorage.getItem('banditStats');
    if (savedStats) {
        stats = JSON.parse(savedStats);
        // Ensure totalLossesCount exists for backward compatibility
        if (typeof stats.totalLossesCount === 'undefined') {
            stats.totalLossesCount = stats.totalGames - stats.totalWins;
        }
    }
}

// Reset statistics
function resetStats() {
    stats = {
        totalGames: 0,
        totalWins: 0,
        totalLosses: 0,
        totalLossesCount: 0,
        totalWinnings: 0,
        highestWin: 0,
        jackpots: 0,
        currentStreak: 0,
        maxStreak: 0
    };

    saveStats();
    updateStatsUI();
    closeStatsModal();
    showMessage('Statistik zurückgesetzt!', 'success');
}

// Add to game history
function addToHistory(result, bet) {
    const historyList = document.getElementById('history-list');
    const item = document.createElement('div');

    if (result.win) {
        const winAmount = bet * result.multiplier;
        item.className = 'history-item win';
        item.innerHTML = `
            <div class="history-symbols">${result.symbols.map(s => s.emoji).join('')}</div>
            <div class="history-amount">+${winAmount.toLocaleString()}</div>
        `;
    } else {
        item.className = 'history-item lose';
        item.innerHTML = `
            <div class="history-symbols">${result.symbols.map(s => s.emoji).join('')}</div>
            <div class="history-amount">-${bet.toLocaleString()}</div>
        `;
    }

    historyList.insertBefore(item, historyList.firstChild);

    // Keep only last 20 entries
    while (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }
}

// Update UI elements
function updateUI() {
    document.getElementById('current-bet').textContent = currentBet;
    document.getElementById('total-wins').textContent = stats.totalWins;
}

// Update statistics UI
function updateStatsUI() {
    document.getElementById('stats-total-games').textContent = stats.totalGames;
    document.getElementById('stats-wins').textContent = stats.totalWins;
    document.getElementById('stats-losses').textContent = stats.totalLossesCount;
    document.getElementById('stats-highest-win').textContent = stats.highestWin.toLocaleString();
    document.getElementById('stats-jackpots').textContent = stats.jackpots;
    document.getElementById('stats-total-winnings').textContent = stats.totalWinnings.toLocaleString();
    document.getElementById('stats-total-losses').textContent = stats.totalLosses.toLocaleString();

    if (typeof getBalanceSync === 'function') {
        const currentBalance = getBalanceSync();
        document.getElementById('stats-balance').textContent = Math.round(currentBalance);
    }

    const profit = stats.totalWinnings - stats.totalLosses;
    const profitEl = document.getElementById('stats-profit');
    profitEl.textContent = profit >= 0 ? `+${profit.toLocaleString()}` : profit.toLocaleString();

    const profitCard = document.getElementById('profit-card');
    if (profit >= 0) {
        profitCard.classList.add('win');
        profitCard.classList.remove('lose');
    } else {
        profitCard.classList.add('lose');
        profitCard.classList.remove('win');
    }
}

// Show game message
function showMessage(message, type) {
    const messageEl = document.getElementById('game-message');
    messageEl.textContent = message;
    messageEl.className = `game-message ${type}`;

    // Auto-clear message after 3 seconds
    setTimeout(() => {
        if (messageEl.textContent === message) {
            messageEl.textContent = '';
            messageEl.className = 'game-message';
        }
    }, 3000);
}

// Show stats modal
function showStatsModal() {
    updateStatsUI();
    document.getElementById('stats-modal-overlay').classList.add('show');
    document.getElementById('stats-modal').style.display = 'block';
}

// Close stats modal
function closeStatsModal() {
    document.getElementById('stats-modal-overlay').classList.remove('show');
    document.getElementById('stats-modal').style.display = 'none';
}

// Reset game
function resetGame() {
    if (typeof resetBalance === 'function') {
        resetBalance().then(() => {
            if (typeof syncBalance === 'function') {
                syncBalance();
            }
            if (typeof getBalanceSync === 'function') {
                const balance = getBalanceSync();
                balanceEl.textContent = Math.round(balance);
                document.getElementById('stats-balance').textContent = Math.round(balance);
            }
            showMessage('Spiel zurückgesetzt!', 'success');
        });
    }
}

// Start decorative lights animation
function startDecoLights() {
    const lights = document.querySelectorAll('.deco-lights .light');
    let lightIndex = 0;

    setInterval(() => {
        lights.forEach((light, index) => {
            light.style.opacity = index === lightIndex ? '1' : '0.3';
        });
        lightIndex = (lightIndex + 1) % lights.length;
    }, 100);
}

// Utility function to create delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Make functions globally available
window.adjustBet = adjustBet;
window.halfBet = halfBet;
window.doubleBet = doubleBet;
window.maxBet = maxBet;
window.spin = spin;
window.showStatsModal = showStatsModal;
window.resetGame = resetGame;
window.closeWinOverlay = closeWinOverlay;
