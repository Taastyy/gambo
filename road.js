/**
 * ==========================================================================
 * Road Game JavaScript - Revamped Version
 * 
 * A modern, linear gambling game with the following features:
 * - Configurable number of steps (5-20)
 * - Progressive multipliers based on safe steps taken
 * - Cash out functionality
 * - Balance and statistics tracking
 * - Game history
 * - Enhanced animations and visual feedback
 * 
 * Multiplier formula: (1.10 + 0.10 * steps)^steps
 * This creates increasing multipliers as more safe steps are taken.
 * 
 * @author Road Game
 * @version 3.0.0
 * @date 2026
 * ==========================================================================
 */

// ==========================================================================
// GAME CONFIGURATION
// ==========================================================================

const CONFIG = {
    STEP_COUNTS: [5, 10, 15, 20],
    DEFAULT_BET: 100,
    MIN_BET: 10,
    MAX_BET: 500,
    INITIAL_BALANCE: 1000,
    MULTIPLIER_BASE: 1.10,
    MULTIPLIER_STEP: 0.10,
    HISTORY_MAX_ENTRIES: 10,
    ROAD_STEPS: 10
};

// ==========================================================================
// GAME STATE CLASS
// ==========================================================================

class RoadGame {
    constructor() {
        this.state = {
            currentBet: CONFIG.DEFAULT_BET,
            stepsCount: 10,
            currentStep: 0,
            isGameOver: false,
            isPlaying: false,
            currentMultiplier: 1.0,
            potentialWin: CONFIG.DEFAULT_BET,
            crashPoint: null,
            
            // Statistics
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            highestWin: 0,
            totalWinnings: 0,
            totalLosses: 0
        };
        
        this.elements = {};
        this.animations = [];
    }
    
    reset() {
        const stepsCount = parseInt(game.elements.roadSteps.value) || CONFIG.ROAD_STEPS;
        this.state = {
            currentBet: CONFIG.DEFAULT_BET,
            stepsCount: stepsCount,
            currentStep: 0,
            isGameOver: false,
            isPlaying: false,
            currentMultiplier: 1.0,
            potentialWin: CONFIG.DEFAULT_BET,
            crashPoint: null,
            gamesPlayed: this.state.gamesPlayed,
            wins: this.state.wins,
            losses: this.state.losses,
            highestWin: this.state.highestWin,
            totalWinnings: this.state.totalWinnings,
            totalLosses: this.state.totalLosses
        };
        
        // Recreate the road with the current step count
        if (game.elements.roadTrack) {
            createRoad();
        }
        
        // Update UI
        if (game.elements.betInput) {
            game.elements.betInput.value = this.state.currentBet;
        }
        updateUI();
    }
}

// ==========================================================================
// DOM ELEMENTS REGISTRATION
// ==========================================================================

function initializeElements() {
    const elements = {
        balance: document.getElementById('balance'),
        currentBet: document.getElementById('current-bet'),
        potentialWin: document.getElementById('potential-win-amount'),
        currentMultiplier: document.getElementById('current-multiplier'),
        gameMessage: document.getElementById('game-message'),
        roadTrack: document.querySelector('.road-track'),
        cashOutBtn: document.getElementById('cash-out-btn'),
        newGameBtn: document.getElementById('new-game-btn'),
        historyList: document.getElementById('history-list'),
        roadSteps: document.getElementById('road-steps'),
        betInput: document.getElementById('bet-input'),
        progressStep: document.getElementById('progress-step'),
        progressFill: document.getElementById('progress-fill'),
        roadContainer: document.querySelector('.road-container'),
        gameTable: document.querySelector('.game-table')
    };
    
    return elements;
}

// ==========================================================================
// GAME INITIALIZATION
// ==========================================================================

let game;

document.addEventListener('DOMContentLoaded', function() {
    game = new RoadGame();
    game.elements = initializeElements();
    
    initializeEventListeners();
    
    // Set initial steps count from dropdown
    game.state.stepsCount = parseInt(game.elements.roadSteps.value) || CONFIG.ROAD_STEPS;
    
    createRoad();
    loadStats();
    syncBalance();
    updateUI();
    showMessage('Wähle deinen Einsatz und starte!', '');
});

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================

function initializeEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        const key = e.key.toLowerCase();
        
        if (key === 'n' && !game.state.isPlaying) {
            startNewGame();
        } else if (key === 'c' && game.state.isPlaying) {
            cashOut();
        } else if (key === ' ' || key === 'enter') {
            e.preventDefault();
            if (!game.state.isPlaying) {
                startNewGame();
            } else {
                takeStep();
            }
        }
    });
    
    // Step count change
    game.elements.roadSteps.addEventListener('change', function() {
        if (!game.state.isPlaying) {
            game.state.stepsCount = parseInt(this.value);
            createRoad(); // Recreate the road with the new step count
            updateProgressDisplay();
        }
    });
    
    // Bet input change
    game.elements.betInput.addEventListener('change', function() {
        setCustomBet(this.value);
    });
}

// ==========================================================================
// ROAD CREATION
// ==========================================================================

function createRoad() {
    const roadTrack = game.elements.roadTrack;
    roadTrack.innerHTML = '';
    
    const stepsCount = parseInt(game.elements.roadSteps.value) || CONFIG.ROAD_STEPS;
    
    for (let i = 0; i < stepsCount; i++) {
        const step = document.createElement('div');
        step.className = 'road-step';
        step.id = `step-${i}`;
        step.dataset.index = i;
        step.innerHTML = `<span class="step-number">${i + 1}</span>`;
        step.addEventListener('click', () => handleStepClick(i));
        roadTrack.appendChild(step);
    }
    
    updateProgressDisplay();
}

function handleStepClick(index) {
    if (!game.state.isPlaying) return;
    
    if (index === game.state.currentStep) {
        takeStep();
    }
}

// ==========================================================================
// BETTING FUNCTIONS
// ==========================================================================

function changeBet(amount) {
    if (game.state.isPlaying) return;
    
    const currentBalance = getBalanceSync();
    const maxBet = Math.min(CONFIG.MAX_BET, currentBalance);
    const newBet = game.state.currentBet + amount;
    
    if (newBet >= CONFIG.MIN_BET && newBet <= maxBet) {
        game.state.currentBet = newBet;
        updateBetDisplay();
    }
}

function setCustomBet(value) {
    if (game.state.isPlaying) return;
    
    const amount = parseInt(value) || CONFIG.MIN_BET;
    const currentBalance = getBalanceSync();
    const maxBet = Math.min(CONFIG.MAX_BET, currentBalance);
    
    game.state.currentBet = Math.max(CONFIG.MIN_BET, Math.min(amount, maxBet));
    updateBetDisplay();
}

function halfBet() {
    if (game.state.isPlaying) return;
    
    const currentBalance = getBalanceSync();
    const halfBalance = Math.floor(currentBalance / 2 / 10) * 10;
    
    game.state.currentBet = Math.max(CONFIG.MIN_BET, halfBalance);
    updateBetDisplay();
}

function doubleBet() {
    if (game.state.isPlaying) return;
    
    const currentBalance = getBalanceSync();
    const doubledBet = game.state.currentBet * 2;
    
    game.state.currentBet = Math.min(doubledBet, currentBalance);
    game.state.currentBet = Math.max(game.state.currentBet, CONFIG.MIN_BET);
    updateBetDisplay();
}

function setAllIn() {
    if (game.state.isPlaying) return;
    
    const currentBalance = getBalanceSync();
    game.state.currentBet = Math.min(CONFIG.MAX_BET, currentBalance);
    updateBetDisplay();
}

function updateBetDisplay() {
    if (game.elements.betInput) {
        game.elements.betInput.value = game.state.currentBet;
    }
    game.elements.currentBet.textContent = game.state.currentBet;
    updatePotentialWin();
}

// ==========================================================================
// GAME LOGIC
// ==========================================================================

function startNewGame() {
    if (game.state.isPlaying) return;
    
    const currentBalance = getBalanceSync();
    if (currentBalance < game.state.currentBet) {
        showMessage('Nicht genügend Guthaben!', 'lose');
        return;
    }
    
    // Deduct bet
    deductFromBalance(game.state.currentBet);
    
    // Reset game state
    game.state.stepsCount = parseInt(game.elements.roadSteps.value);
    game.state.currentStep = 0;
    game.state.isGameOver = false;
    game.state.isPlaying = true;
    game.state.currentMultiplier = 1.0;
    game.state.potentialWin = game.state.currentBet;
    game.state.crashPoint = generateCrashPoint();
    
    // Reset road display
    resetRoad();
    
    // Add playing animation
    if (game.elements.roadContainer) {
        game.elements.roadContainer.classList.add('playing');
    }
    
    // Update UI
    updateUI();
    showMessage('Viel Glück! Klicke auf den nächsten Schritt.', '');
    
    // Button states
    game.elements.newGameBtn.disabled = true;
    game.elements.cashOutBtn.disabled = false;
}

function generateCrashPoint() {
    const stepsCount = game.state.stepsCount || CONFIG.ROAD_STEPS;
    
    // Small chance (5%) that crash point is beyond the road - allows winning
    if (Math.random() < 0.05) {
        return stepsCount + 1; // Rare win possible - crash point beyond the end
    }
    
    // Generate crash point - later steps more likely
    const weights = [];
    for (let i = 1; i <= stepsCount; i++) {
        // Quadratic: weight = i^2
        const weight = Math.pow(i, 2);
        weights.push(weight);
    }
    
    // Calculate total weight
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    // Generate random number between 0 and totalWeight
    const random = Math.random() * totalWeight;
    
    // Find which step corresponds to the random number
    let cumulativeWeight = 0;
    for (let i = 0; i < weights.length; i++) {
        cumulativeWeight += weights[i];
        if (random < cumulativeWeight) {
            return i + 1; // +1 because steps are 1-indexed
        }
    }
    
    // Fallback (should never reach here)
    return stepsCount;
}

function takeStep() {
    if (!game.state.isPlaying) return;
    
    game.state.currentStep++;
    
    // Check if crashed
    if (game.state.currentStep >= game.state.crashPoint) {
        revealCrashPoint();
        endGame(false);
        return;
    }
    
    // Safe step - update multiplier
    updateMultiplier();
    
    // Update road display
    updateRoadDisplay();
    updateUI();
    
    // Check if reached the end
    if (game.state.currentStep >= game.state.stepsCount) {
        endGame(true);
        return;
    }
    
    // Check balance
    getBalance().then((balance) => {
        if (balance <= 0) {
            showMessage('Kein Guthaben mehr! Spiel vorbei.', 'lose');
            endGame(false);
        }
    });
}

function updateMultiplier() {
    const steps = game.state.currentStep;
    
    // Use a more realistic multiplier formula: 1.0 + (0.05 * steps)
    game.state.currentMultiplier = 1.0 + (0.05 * steps);
    
    // Round to 2 decimal places
    game.state.currentMultiplier = Math.round(game.state.currentMultiplier * 100) / 100;
    
    // Calculate potential win
    game.state.potentialWin = Math.round(game.state.currentBet * game.state.currentMultiplier);
}

function updateRoadDisplay() {
    const stepsCount = parseInt(game.elements.roadSteps.value) || CONFIG.ROAD_STEPS;
    
    // Mark completed safe steps
    for (let i = 0; i < game.state.currentStep && i < stepsCount; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        if (stepEl) {
            stepEl.className = 'road-step safe';
        }
    }
    
    // Mark current step
    if (game.state.currentStep < stepsCount) {
        const currentStepEl = document.getElementById(`step-${game.state.currentStep}`);
        if (currentStepEl) {
            currentStepEl.className = 'road-step current';
        }
    }
    
    updateProgressDisplay();
}

function updateProgressDisplay() {
    if (game.elements.progressStep) {
        game.elements.progressStep.textContent = `${game.state.currentStep}/${game.state.stepsCount}`;
    }
    
    if (game.elements.progressFill) {
        const percentage = (game.state.currentStep / game.state.stepsCount) * 100;
        game.elements.progressFill.style.width = `${percentage}%`;
    }
}

function resetRoad() {
    const stepsCount = parseInt(game.elements.roadSteps.value) || CONFIG.ROAD_STEPS;
    
    for (let i = 0; i < stepsCount; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        if (stepEl) {
            stepEl.className = 'road-step';
            stepEl.innerHTML = `<span class="step-number">${i + 1}</span>`;
        }
    }
    
    // Mark first step as current
    const firstStepEl = document.getElementById('step-0');
    if (firstStepEl) {
        firstStepEl.className = 'road-step current';
    }
    
    updateProgressDisplay();
}

function revealCrashPoint() {
    const crashIndex = game.state.crashPoint - 1;
    const stepsCount = parseInt(game.elements.roadSteps.value) || CONFIG.ROAD_STEPS;
    
    // Mark all safe steps
    for (let i = 0; i < crashIndex && i < stepsCount; i++) {
        const stepEl = document.getElementById(`step-${i}`);
        if (stepEl) {
            stepEl.className = 'road-step safe';
        }
    }
    
    // Mark crash step
    if (crashIndex < stepsCount) {
        const crashStepEl = document.getElementById(`step-${crashIndex}`);
        if (crashStepEl) {
            crashStepEl.className = 'road-step crash';
            crashStepEl.innerHTML = `<span class="step-number">✕</span>`;
        }
    }
}

function updatePotentialWin() {
    game.elements.currentMultiplier.textContent = game.state.currentMultiplier.toFixed(2) + 'x';
    game.elements.potentialWin.textContent = game.state.potentialWin;
}

function cashOut() {
    if (!game.state.isPlaying) return;
    if (game.state.currentStep === 0) return;
    
    endGame(true, true);
}

function endGame(won, cashedOut = false) {
    game.state.isPlaying = false;
    game.state.isGameOver = true;
    
    const profit = won ? game.state.potentialWin - game.state.currentBet : -game.state.currentBet;
    
    if (won) {
        addToBalance(game.state.potentialWin);
        game.state.wins++;
        game.state.totalWinnings += profit;
        
        if (game.state.potentialWin > game.state.highestWin) {
            game.state.highestWin = game.state.potentialWin;
        }
        
        if (cashedOut) {
            showMessage(`Gewonnen! Du hast ${profit} ausgecasht!`, 'win');
            triggerVictoryAnimation();
        } else {
            showMessage(`Herzlichen Glückwunsch! Du hast alle Schritte überlebt und ${profit} gewonnen!`, 'win');
            triggerVictoryAnimation();
        }
    } else {
        game.state.losses++;
        game.state.totalLosses += game.state.currentBet;
        showMessage(`Oh nein! Du bist auf eine Mine getreten und hast ${game.state.currentBet} verloren!`, 'lose');
        triggerShakeAnimation();
    }
    
    // Remove playing animation
    if (game.elements.roadContainer) {
        game.elements.roadContainer.classList.remove('playing');
    }
    
    // Update statistics
    game.state.gamesPlayed++;
    saveStats();
    
    // Add to history
    addToHistory(won, profit, game.state.currentStep);
    
    // Update UI
    game.state.currentMultiplier = 1.0;
    game.state.potentialWin = game.state.currentBet;
    updateUI();
    
    // Button states
    game.elements.newGameBtn.disabled = false;
    game.elements.cashOutBtn.disabled = true;
    game.elements.roadSteps.disabled = false;
    
    // Reset for next game after delay
    setTimeout(() => {
        if (getBalanceSync() > 0) {
            showMessage('Bereit für die nächste Runde! Setze deinen Einsatz und starte.', '');
            updateUI();
        } else {
            showMessage('Kein Guthaben mehr! Spiel vorbei.', 'lose');
        }
    }, 2000);
}

// ==========================================================================
// ANIMATIONS
// ==========================================================================

function triggerVictoryAnimation() {
    if (!game.elements.gameTable) return;
    
    game.elements.gameTable.classList.add('victory');
    setTimeout(() => {
        game.elements.gameTable.classList.remove('victory');
    }, 2000);
}

function triggerShakeAnimation() {
    if (!game.elements.gameTable) return;
    
    game.elements.gameTable.classList.add('shake');
    setTimeout(() => {
        game.elements.gameTable.classList.remove('shake');
    }, 500);
}

// ==========================================================================
// UI UPDATES
// ==========================================================================

function updateUI() {
    syncBalance();
    
    game.elements.currentBet.textContent = game.state.currentBet;
    game.elements.currentMultiplier.textContent = game.state.currentMultiplier.toFixed(2) + 'x';
    game.elements.potentialWin.textContent = game.state.potentialWin;
    
    // Button states
    game.elements.cashOutBtn.disabled = !game.state.isPlaying || game.state.currentStep === 0;
    game.elements.newGameBtn.disabled = game.state.isPlaying;
    game.elements.roadSteps.disabled = game.state.isPlaying;
    
    // Update progress
    updateProgressDisplay();
}

function showMessage(message, type) {
    const messageText = game.elements.gameMessage.querySelector('.message-text');
    const messageIcon = game.elements.gameMessage.querySelector('.message-icon');
    
    if (messageText) {
        messageText.textContent = message;
    }
    
    if (messageIcon) {
        if (type === 'win') {
            messageIcon.textContent = '🎉';
        } else if (type === 'lose') {
            messageIcon.textContent = '💥';
        } else {
            messageIcon.textContent = '🎮';
        }
    }
    
    game.elements.gameMessage.className = `game-message ${type}`;
    
    // Add animation for better feedback
    if (type === 'win') {
        game.elements.gameMessage.classList.add('pulse');
        setTimeout(() => {
            game.elements.gameMessage.classList.remove('pulse');
        }, 1000);
    } else if (type === 'lose') {
        game.elements.gameMessage.classList.add('shake');
        setTimeout(() => {
            game.elements.gameMessage.classList.remove('shake');
        }, 500);
    }
}

function addToHistory(won, profit, steps = 0) {
    const historyList = game.elements.historyList;
    const li = document.createElement('li');
    li.className = won ? 'win' : 'lose';
    li.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">${won ? 'Gewinn' : 'Verlust'}</div>
        <div style="font-size: 1.1em; color: ${profit > 0 ? 'var(--neon-green)' : 'var(--neon-red)'}; font-weight: bold;">
            ${profit > 0 ? '+' : ''}${profit}
        </div>
        <div style="font-size: 0.8em; color: var(--text-secondary); margin-top: 5px;">${steps} Schritte</div>
    `;
    
    historyList.insertBefore(li, historyList.firstChild);
    
    // Keep maximum entries
    while (historyList.children.length > CONFIG.HISTORY_MAX_ENTRIES) {
        historyList.removeChild(historyList.lastChild);
    }
}

// ==========================================================================
// LOCAL STORAGE
// ==========================================================================

function saveStats() {
    const stats = {
        currentBet: game.state.currentBet,
        gamesPlayed: game.state.gamesPlayed,
        wins: game.state.wins,
        losses: game.state.losses,
        highestWin: game.state.highestWin,
        totalWinnings: game.state.totalWinnings,
        totalLosses: game.state.totalLosses
    };
    localStorage.setItem('roadStats', JSON.stringify(stats));
}

function loadStats() {
    const savedStats = localStorage.getItem('roadStats');
    if (savedStats) {
        try {
            const stats = JSON.parse(savedStats);
            game.state.currentBet = stats.currentBet || CONFIG.DEFAULT_BET;
            game.state.gamesPlayed = stats.gamesPlayed || 0;
            game.state.wins = stats.wins || 0;
            game.state.losses = stats.losses || 0;
            game.state.highestWin = stats.highestWin || 0;
            game.state.totalWinnings = stats.totalWinnings || 0;
            game.state.totalLosses = stats.totalLosses || 0;
            
            // Update bet input display
            if (game.elements.betInput) {
                game.elements.betInput.value = game.state.currentBet;
            }
        } catch (e) {
            console.error('Error loading stats:', e);
        }
    }
}

function resetStats() {
    game.state.currentBet = CONFIG.DEFAULT_BET;
    game.state.gamesPlayed = 0;
    game.state.wins = 0;
    game.state.losses = 0;
    game.state.highestWin = 0;
    game.state.totalWinnings = 0;
    game.state.totalLosses = 0;
    
    resetBalance().then(() => {
        syncBalance();
        saveStats();
        updateUI();
        updateStatsModal();
        showMessage('Statistik zurückgesetzt!', '');
    });
}

// ==========================================================================
// STATS MODAL
// ==========================================================================

let statsModal, statsModalOverlay;

function initializeStatsModal() {
    statsModal = document.getElementById('stats-modal');
    statsModalOverlay = document.getElementById('stats-modal-overlay');
    
    document.getElementById('close-stats-modal').addEventListener('click', closeStatsModal);
    document.getElementById('reset-stats-btn').addEventListener('click', resetStats);
    
    statsModalOverlay.addEventListener('click', function(e) {
        if (e.target === statsModalOverlay) {
            closeStatsModal();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && statsModal && statsModal.style.display === 'block') {
            closeStatsModal();
        }
    });
}

function showStatsModal() {
    updateStatsModal();
    statsModalOverlay.style.display = 'flex';
    statsModal.style.display = 'block';
}

function closeStatsModal() {
    statsModalOverlay.style.display = 'none';
    statsModal.style.display = 'none';
}

async function updateStatsModal() {
    // Initialize modal if not already done
    if (!statsModal) {
        initializeStatsModal();
    }
    
    syncBalance();
    const currentBalance = await getBalance();
    const profit = currentBalance - CONFIG.INITIAL_BALANCE;
    
    document.getElementById('stats-total-games').textContent = game.state.gamesPlayed;
    document.getElementById('stats-wins').textContent = game.state.wins;
    document.getElementById('stats-losses').textContent = game.state.losses;
    document.getElementById('stats-highest-win').textContent = game.state.highestWin;
    document.getElementById('stats-total-winnings').textContent = game.state.totalWinnings;
    document.getElementById('stats-total-losses').textContent = game.state.totalLosses;
    document.getElementById('stats-balance').textContent = Math.round(currentBalance);
    
    const profitEl = document.getElementById('stats-profit');
    profitEl.textContent = profit >= 0 ? `+${profit}` : profit;
    profitEl.className = `stat-value ${profit >= 0 ? 'positive' : 'negative'}`;
}

// Initialize stats modal on load
document.addEventListener('DOMContentLoaded', initializeStatsModal);

// ==========================================================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ==========================================================================

window.changeBet = changeBet;
window.setCustomBet = setCustomBet;
window.halfBet = halfBet;
window.doubleBet = doubleBet;
window.setAllIn = setAllIn;
window.startNewGame = startNewGame;
window.takeStep = takeStep;
window.handleStepClick = handleStepClick;
window.cashOut = cashOut;
window.showStatsModal = showStatsModal;
window.closeStatsModal = closeStatsModal;
window.resetStats = resetStats;
