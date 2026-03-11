// ==========================================================================
// PFERDERENNEN - Horse Racing Game Logic
// ==========================================================================

// Horse configuration with odds
const HORSES = [
    { id: 1, name: 'FLITZER', emoji: '🏇', odds: 3.0 },
    { id: 2, name: 'STURM', emoji: '🐎', odds: 4.0 },
    { id: 3, name: 'BLITZ', emoji: '🏇', odds: 5.0 },
    { id: 4, name: 'DONNER', emoji: '🐎', odds: 6.0 },
    { id: 5, name: 'FEUER', emoji: '🏇', odds: 8.0 },
    { id: 6, name: 'GOLD', emoji: '🐎', odds: 12.0 }
];

// Game state
let currentBet = 100;
let selectedHorse = null;
let isRacing = false;
let balance = 1000;

// Statistics
let stats = {
    totalRaces: 0,
    totalWins: 0,
    totalLosses: 0,
    totalWinnings: 0,
    highestWin: 0,
    currentStreak: 0,
    maxStreak: 0
};

// DOM Elements
let balanceEl, betInput, raceBtn, selectedDisplay;

// Initialize game
document.addEventListener('DOMContentLoaded', function () {
    loadDynamicOdds();
    initializeElements();
    loadStats();
    setupEventListeners();
    updateUI();
    randomizeOdds();
});

// Load dynamic odds from storage
function loadDynamicOdds() {
    try {
        const savedOdds = localStorage.getItem('dynamicHorseOdds');
        if (savedOdds) {
            const parsedOdds = JSON.parse(savedOdds);
            parsedOdds.forEach(po => {
                const h = HORSES.find(h => h.id === po.id);
                if (h) h.odds = po.odds;
            });
        }
    } catch (e) { }
}

// Initialize DOM elements
function initializeElements() {
    balanceEl = document.getElementById('balance');
    betInput = document.getElementById('bet-input');
    raceBtn = document.getElementById('race-btn');
    selectedDisplay = document.getElementById('selected-horse-name');
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
        if (e.code === 'Space' && !isRacing) {
            e.preventDefault();
            if (selectedHorse) {
                startRace();
            }
        } else if (e.code === 'ArrowUp') {
            adjustBet(10);
        } else if (e.code === 'ArrowDown') {
            adjustBet(-10);
        }
    });
}

// Randomize odds slightly to add variety
function randomizeOdds() {
    const variance = [0.9, 0.95, 1.0, 1.05, 1.1];

    HORSES.forEach((horse, index) => {
        const factor = variance[Math.floor(Math.random() * variance.length)];
        const newOdds = (horse.odds * factor).toFixed(1);
        document.getElementById(`odds-${horse.id}`).textContent = `x${newOdds}`;

        const sideOdds = document.getElementById(`side-odds-${horse.id}`);
        if (sideOdds) sideOdds.textContent = `x${newOdds}`;

        horse.displayOdds = parseFloat(newOdds);
    });
}

// Select a horse
function selectHorse(horseId) {
    if (isRacing) return;

    selectedHorse = HORSES.find(h => h.id === horseId);

    // Update button states
    document.querySelectorAll('.horse-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.horse) === horseId) {
            btn.classList.add('selected');
        }
    });

    // Update selected display
    selectedDisplay.textContent = `${selectedHorse.emoji} ${selectedHorse.name}`;

    showMessage(`Auf ${selectedHorse.name} gesetzt!`, '');
}

// Adjust bet
function adjustBet(amount) {
    if (isRacing) return;

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
    if (isRacing) return;

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
    if (isRacing) return;

    currentBet = Math.max(1, Math.floor(currentBet / 2));
    betInput.value = currentBet;
    updateBetPreset();
    updateUI();
}

// Double the bet
function doubleBet() {
    if (isRacing) return;

    currentBet = currentBet * 2;
    betInput.value = currentBet;
    updateBetPreset();
    updateUI();
}

// Max bet
function maxBet() {
    if (isRacing) return;

    if (typeof getBalanceSync === 'function') {
        balance = getBalanceSync();
        currentBet = Math.max(1, balance);
        betInput.value = currentBet;
        updateBetPreset();
        updateUI();
    }
}

// Start the race
async function startRace() {
    if (isRacing) return;

    if (!selectedHorse) {
        showMessage('Bitte wähle zuerst ein Pferd!', 'error');
        return;
    }

    // Get current balance
    if (typeof getBalanceSync === 'function') {
        balance = getBalanceSync();
    }

    // Check if balance is sufficient
    if (balance < currentBet) {
        showMessage('Nicht genügend Guthaben!', 'error');
        return;
    }

    // Deduct bet
    if (typeof deductFromBalance === 'function') {
        const success = await deductFromBalance(currentBet);
        if (!success) {
            showMessage('Nicht genügend Guthaben!', 'error');
            return;
        }
    } else {
        balance -= currentBet;
    }

    balance = getBalanceSync ? getBalanceSync() : balance;
    balanceEl.textContent = Math.round(balance);

    isRacing = true;
    raceBtn.disabled = true;
    raceBtn.querySelector('.race-text').textContent = 'RENNT...';

    // Disable horse buttons
    document.querySelectorAll('.horse-btn').forEach(btn => {
        btn.classList.add('disabled');
    });

    // Clear previous results
    clearRaceResults();

    // Show countdown
    await showCountdown();

    // Run the race
    const winner = await runRace();

    // Check result
    await checkResult(winner);

    // Reset race button
    isRacing = false;
    raceBtn.disabled = false;
    raceBtn.querySelector('.race-text').textContent = 'RENNEN STARTEN';

    // Enable horse buttons
    document.querySelectorAll('.horse-btn').forEach(btn => {
        btn.classList.remove('disabled');
    });

    // Update odds dynamically
    randomizeOdds();

    // Update UI
    updateUI();
}

// Show countdown
async function showCountdown() {
    const countdownEl = document.getElementById('countdown');
    const statusEl = document.getElementById('race-status');

    statusEl.textContent = 'Bereitmachen...';
    countdownEl.textContent = '3';
    await delay(500);
    countdownEl.textContent = '2';
    await delay(500);
    countdownEl.textContent = '1';
    await delay(500);
    countdownEl.textContent = '';
    statusEl.textContent = 'Und los!';
}

// Run the race animation
async function runRace() {
    const horses = document.querySelectorAll('.horse');
    const trackWidth = document.getElementById('race-track').offsetWidth - 100;

    // Initialize positions
    const positions = Array(HORSES.length).fill(0);

    // === BETTER WAY: Casino Probability Logic ===
    // Pre-determine the winner mathematically based on exact odds to guarantee fairness
    let totalProb = 0;
    const probs = HORSES.map(h => {
        const prob = 1 / h.odds; // Lower odds -> Higher probability
        totalProb += prob;
        return prob;
    });
    
    let rand = Math.random() * totalProb;
    let targetWinnerIndex = HORSES.length - 1;
    for (let i = 0; i < HORSES.length; i++) {
        if (rand < probs[i]) {
            targetWinnerIndex = i;
            break;
        }
        rand -= probs[i];
    }
    
    // Plan the race duration for each horse
    const winnerFinishFrame = 80 + Math.floor(Math.random() * 20); // Winner needs 80-100 frames
    const finishFrames = [];
    for (let i = 0; i < HORSES.length; i++) {
        if (i === targetWinnerIndex) {
            finishFrames.push(winnerFinishFrame);
        } else {
            // Losers arrive 2 to 40 frames later than the winner
            finishFrames.push(winnerFinishFrame + 2 + Math.random() * 38);
        }
    }
    
    let currentFrame = 0;
    let raceFinished = false;
    
    // Animate race
    while (!raceFinished) {
        currentFrame++;
        let anyCrossed = false;
        
        horses.forEach((horseEl, index) => {
            let framesLeft = finishFrames[index] - currentFrame;
            let distLeft = trackWidth - positions[index];
            let step = 0;
            
            if (framesLeft <= 0) {
                positions[index] = trackWidth;
            } else {
                if (framesLeft < 15) {
                    // Smoothly close remaining distance near finish line
                    step = distLeft / framesLeft;
                    step += (Math.random() * 1.5 - 0.75); // slight variance
                } else {
                    // Average step required
                    const avgStep = trackWidth / finishFrames[index];
                    // Wild variance during the bulk of the race! (0.2x to 1.8x)
                    step = avgStep * (0.2 + Math.random() * 1.6);
                    
                    // Add random drama bursts
                    if (Math.random() < 0.05) step *= 2.5; // sprint
                    if (Math.random() < 0.05) step *= 0.3; // stumble
                }
                positions[index] += step;
            }
            
            // Re-clamp
            if (positions[index] >= trackWidth) {
                positions[index] = trackWidth;
                if (index === targetWinnerIndex) {
                    anyCrossed = true; // Winner has crossed!
                }
            }
            
            horseEl.style.left = `${50 + positions[index]}px`;
            
            // Add racing class for animation
            if (positions[index] > 10 && positions[index] < trackWidth) {
                horseEl.classList.add('racing');
            } else {
                horseEl.classList.remove('racing');
            }
        });
        
        if (anyCrossed) {
            raceFinished = true;
        }
        
        await delay(40);
    }
    
    // Stop animations
    horses.forEach(horseEl => {
        horseEl.classList.remove('racing');
    });
    
    // Mark winner
    const winnerHorse = document.querySelector(`#horse-${targetWinnerIndex + 1}`);
    winnerHorse.classList.add('winner');
    
    return targetWinnerIndex + 1;
}

// Check race result
async function checkResult(winnerId) {
    stats.totalRaces++;

    const statusEl = document.getElementById('race-status');
    const winnerHorse = HORSES.find(h => h.id === winnerId);

    const won = winnerId === selectedHorse.id;

    if (won) {
        // Calculate winnings
        const odds = selectedHorse.displayOdds || selectedHorse.odds;
        const winAmount = Math.floor(currentBet * odds);

        // Add to balance
        if (typeof addToBalance === 'function') {
            await addToBalance(winAmount);
        } else {
            balance += winAmount;
        }

        balance = getBalanceSync ? getBalanceSync() : balance;

        // Update stats
        stats.totalWins++;
        stats.totalWinnings += winAmount;
        stats.currentStreak++;

        if (stats.currentStreak > stats.maxStreak) {
            stats.maxStreak = stats.currentStreak;
        }

        if (winAmount > stats.highestWin) {
            stats.highestWin = winAmount;
        }

        // Show win
        statusEl.textContent = `${winnerHorse.name} gewinnt! Du hast gewonnen!`;
        showMessage(`Glückwunsch! +${winAmount.toLocaleString()}`, 'win');

        // Big win animation
        await triggerWinAnimation(winAmount, winnerHorse);

        // Update balance display
        balanceEl.textContent = Math.round(balance);
    } else {
        // Update stats
        stats.totalLosses += currentBet;
        stats.currentStreak = 0;

        // Show loss
        statusEl.textContent = `${winnerHorse.name} gewinnt! Du hast verloren.`;
        showMessage(`Schade! -${currentBet.toLocaleString()}`, 'lose');
    }

    // ADJUST ODDS REALISTICALLY BASED ON PERFORMANCE
    HORSES.forEach(horse => {
        if (horse.id === winnerId) {
            // Winner becomes a favorite, odds go down (min 1.2)
            horse.odds = Math.max(1.2, horse.odds * 0.85);
        } else {
            // Losers become less popular, odds go up (max 50.0)
            horse.odds = Math.min(50.0, horse.odds * 1.05);
        }
    });
    // Save dynamic odds
    localStorage.setItem('dynamicHorseOdds', JSON.stringify(HORSES.map(h => ({ id: h.id, odds: h.odds }))));

    saveStats();

    // Add to history
    addToHistory(winnerHorse, won);
}

// Trigger win animation
async function triggerWinAnimation(winAmount, winnerHorse) {
    const overlay = document.getElementById('win-overlay');
    const winTitle = document.getElementById('win-title');
    const winHorse = document.getElementById('win-horse');
    const winAmountLarge = document.getElementById('win-amount-large');

    // Set win details
    winTitle.textContent = '🎉 SIEG! 🎉';
    winHorse.innerHTML = `${winnerHorse.emoji} ${winnerHorse.name}`;
    winAmountLarge.textContent = `+${winAmount.toLocaleString()}`;

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
    const emojis = ['🏆', '💰', '🎉', '⭐', '🎊'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';

        // Use either color or emoji
        if (Math.random() > 0.5) {
            confetti.style.width = '20px';
            confetti.style.height = '20px';
            confetti.style.fontSize = '16px';
            confetti.style.backgroundColor = 'transparent';
            confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        } else {
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        }

        container.appendChild(confetti);
    }
}

// Close win overlay
function closeWinOverlay() {
    document.getElementById('win-overlay').classList.remove('show');
}

// Clear race results
function clearRaceResults() {
    document.querySelectorAll('.horse').forEach(horse => {
        horse.style.left = '50px';
        horse.classList.remove('winner', 'racing');
    });
}

// Add to game history
function addToHistory(winnerHorse, won) {
    const historyList = document.getElementById('history-list');
    const item = document.createElement('div');

    const horseInfo = HORSES.find(h => h.id === winnerHorse.id);
    const displayOdds = horseInfo.displayOdds || horseInfo.odds;
    const winAmount = won ? Math.floor(currentBet * displayOdds) : 0;

    item.className = `history-item ${won ? 'win' : 'lose'}`;
    item.innerHTML = `
        <span class="history-horse">${winnerHorse.emoji} ${winnerHorse.name}</span>
        <span class="history-amount">${won ? '+' : '-'}${won ? winAmount.toLocaleString() : currentBet.toLocaleString()}</span>
    `;

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
    document.getElementById('stats-total-races').textContent = stats.totalRaces;
    document.getElementById('stats-wins').textContent = stats.totalWins;
    document.getElementById('stats-losses').textContent = stats.totalLosses;
    document.getElementById('stats-highest-win').textContent = stats.highestWin.toLocaleString();
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
    messageEl.className = `game-message show ${type}`;

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
}

// Close stats modal
function closeStatsModal() {
    document.getElementById('stats-modal-overlay').classList.remove('show');
}

// Reset game
function resetGame() {
    // Reset horses to starting position
    clearRaceResults();

    // Reset selection
    selectedHorse = null;
    document.querySelectorAll('.horse-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    selectedDisplay.textContent = '-';

    // Update status
    document.getElementById('race-status').textContent = 'Wähle dein Pferd und setze!';

    // Randomize odds
    randomizeOdds();

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
    } else {
        showMessage('Spiel zurückgesetzt!', 'success');
    }
}

// Update statistics
function updateStats(result, bet) {
    stats.totalGames++;

    if (result.win) {
        stats.totalWins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.maxStreak) {
            stats.maxStreak = stats.currentStreak;
        }
    } else {
        stats.currentStreak = 0;
    }

    saveStats();
}

// Save statistics to localStorage
function saveStats() {
    localStorage.setItem('horseRacingStats', JSON.stringify(stats));
}

// Load statistics from localStorage
function loadStats() {
    const savedStats = localStorage.getItem('horseRacingStats');
    if (savedStats) {
        stats = JSON.parse(savedStats);
    }
}

// Reset statistics
function resetStats() {
    stats = {
        totalRaces: 0,
        totalWins: 0,
        totalLosses: 0,
        totalWinnings: 0,
        highestWin: 0,
        currentStreak: 0,
        maxStreak: 0
    };

    // Reset base odds
    HORSES[0].odds = 3.0;
    HORSES[1].odds = 4.0;
    HORSES[2].odds = 5.0;
    HORSES[3].odds = 6.0;
    HORSES[4].odds = 8.0;
    HORSES[5].odds = 12.0;
    localStorage.removeItem('dynamicHorseOdds');
    randomizeOdds();

    saveStats();
    updateStatsUI();
    closeStatsModal();
    showMessage('Statistik zurückgesetzt!', 'success');
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
window.selectHorse = selectHorse;
window.startRace = startRace;
window.showStatsModal = showStatsModal;
window.resetGame = resetGame;
window.closeWinOverlay = closeWinOverlay;
