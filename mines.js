/**
 * ==========================================================================
 * Mines Game JavaScript
 * 
 * A Minesweeper-style gambling game with the following features:
 * - 5x5 grid with configurable mine count (3-15 mines)
 * - Progressive multipliers based on safe tiles revealed
 * - Cash out functionality
 * - Balance and statistics tracking
 * - Game history
 * 
 * Multiplier formula: (remainingSafeTiles / remainingTotalTiles) ^ -0.5
 * This creates increasing multipliers as more safe tiles are revealed.
 * 
 * @author Mines Game
 * @version 1.0.0
 * @date 2026
 * ==========================================================================
 */


// ==========================================================================
// GLOBAL VARIABLES AND CONSTANTS
// ==========================================================================

/**
 * Grid configuration
 */
const GRID_SIZE = 5;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

/**
 * Default mine counts available in the dropdown
 */
const MINE_COUNTS = [3, 5, 10, 15];

/**
 * Game state constants
 */
const GAME_STATE = {
    WAITING: 'waiting',       // Waiting to start new game
    PLAYING: 'playing',       // Player is revealing tiles
    GAME_OVER: 'game_over'    // Game ended (win or lose)
};

/**
 * Multiplier cache for common mine counts
 */
const MULTIPLIER_CACHE = {};

// ==========================================================================
// GAME STATE
// ==========================================================================

let gameState = {
    currentBet: 100,              // Current bet amount
    minesCount: 5,                // Number of mines in current game
    revealedTiles: [],            // Array of revealed tile indices
    mineIndices: [],              // Array of mine positions
    state: GAME_STATE.WAITING,    // Current game state
    currentMultiplier: 1.0,       // Current multiplier
    potentialWin: 100,            // Potential win amount
    probabilityEnabled: false,    // Show probability indicators
    
    // Statistics
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    highestWin: 0,
    totalWinnings: 0,
    totalLosses: 0
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================

let balanceEl, currentBetEl, potentialWinEl, currentMultiplierEl;
let gameMessageEl, minesGridEl, cashOutBtn, newGameBtn;
let historyListEl, statsModal, statsModalOverlay;
let minesCountSelect, betInputEl;
let probabilityToggle;

// ==========================================================================
// INITIALIZATION
// ==========================================================================

/**
 * Initializes the game when the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeEventListeners();
    initializeStatsModal();
    initializeMultiplierCache();
    createGrid();
    loadStats();
    syncBalance(); // Sync balance display with localStorage
    updateUI();
    showMessage('Willkommen! Wählen Sie den Einsatz und klicken Sie auf "Neues Spiel"', '');
});

/**
 * References all required DOM elements for easy access.
 */
function initializeElements() {
    balanceEl = document.getElementById('balance');
    currentBetEl = document.getElementById('current-bet');
    potentialWinEl = document.getElementById('potential-win-amount');
    currentMultiplierEl = document.getElementById('current-multiplier');
    gameMessageEl = document.getElementById('game-message');
    minesGridEl = document.getElementById('mines-grid');
    cashOutBtn = document.getElementById('cash-out-btn');
    newGameBtn = document.getElementById('new-game-btn');
    historyListEl = document.getElementById('history-list');
    minesCountSelect = document.getElementById('mines-count');
    betInputEl = document.getElementById('bet-input');
    probabilityToggle = document.getElementById('probability-toggle');
}

/**
 * Initializes all event listeners.
 */
function initializeEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        switch(e.key.toLowerCase()) {
            case 'n':
                if (gameState.state === GAME_STATE.WAITING) {
                    startNewGame();
                }
                break;
            case 'c':
                if (gameState.state === GAME_STATE.PLAYING) {
                    cashOut();
                }
                break;
        }
    });

    // Mine count change
    minesCountSelect.addEventListener('change', function() {
        if (gameState.state === GAME_STATE.WAITING) {
            gameState.minesCount = parseInt(this.value);
        }
    });

    // Bet input change
    betInputEl.addEventListener('change', function() {
        setCustomBet(this.value);
    });
    
    // Probability toggle
    if (probabilityToggle) {
        probabilityToggle.addEventListener('change', function() {
            gameState.probabilityEnabled = this.checked;
            updateProbabilityDisplay();
            saveStats();
        });
    }
}

/**
 * Pre-calculates multipliers for better performance.
 */
function initializeMultiplierCache() {
    MINE_COUNTS.forEach(mines => {
        MULTIPLIER_CACHE[mines] = {};
        const totalSafe = TOTAL_TILES - mines;
        
        for (let revealed = 0; revealed <= totalSafe; revealed++) {
            const remainingSafe = totalSafe - revealed;
            const remainingTotal = TOTAL_TILES - revealed;
            
            if (remainingSafe > 0 && remainingTotal > 0) {
                const multiplier = Math.pow(remainingSafe / remainingTotal, -0.5);
                MULTIPLIER_CACHE[mines][revealed] = Math.round(multiplier * 100) / 100;
            } else if (remainingSafe === 0) {
                MULTIPLIER_CACHE[mines][revealed] = 100; // Very high for clearing all
            }
        }
    });
}

/**
 * Calculates the probability of a tile being safe.
 * 
 * @param {number} tileIndex - The tile index to check
 * @returns {number} Probability (0-1) that the tile is safe
 */
function calculateTileProbability(tileIndex) {
    if (gameState.revealedTiles.includes(tileIndex)) {
        return 1; // Already revealed, safe
    }
    
    const revealed = gameState.revealedTiles.length;
    const totalRemaining = TOTAL_TILES - revealed;
    const minesRemaining = gameState.minesCount;
    
    // Simple probability: (Total remaining - Mines remaining) / Total remaining
    // This gives the probability for any unrevealed tile
    const probability = (totalRemaining - minesRemaining) / totalRemaining;
    
    return Math.max(0, Math.min(1, probability));
}

/**
 * Gets the probability level for display.
 * 
 * @param {number} probability - The probability value (0-1)
 * @returns {string} The probability level: 'extreme', 'high', 'medium', 'low', 'danger'
 */
function getProbabilityLevel(probability) {
    if (probability >= 0.9) return 'extreme';  // 90%+ - Starker grüner Glow
    if (probability >= 0.75) return 'high';    // 75-90% - Grüner Glow
    if (probability >= 0.5) return 'medium';   // 50-75% - Gelb
    if (probability >= 0.35) return 'low';     // 35-50% - Orange
    return 'danger';                           // <35% - Rot
}

/**
 * Updates the probability display on all unrevealed tiles.
 */
function updateProbabilityDisplay() {
    if (!gameState.probabilityEnabled || gameState.state !== GAME_STATE.PLAYING) {
        // Clear probability displays
        const tiles = minesGridEl.querySelectorAll('.mine-tile');
        tiles.forEach(tile => {
            tile.classList.remove('prob-extreme', 'prob-high', 'prob-medium', 'prob-low', 'prob-danger');
            const probDisplay = tile.querySelector('.probability-display');
            if (probDisplay) {
                probDisplay.remove();
            }
        });
        return;
    }
    
    const tiles = minesGridEl.querySelectorAll('.mine-tile');
    
    tiles.forEach((tile, index) => {
        if (gameState.revealedTiles.includes(index)) return;
        
        const probability = calculateTileProbability(index);
        const level = getProbabilityLevel(probability);
        
        // Remove existing probability display
        const existingProb = tile.querySelector('.probability-display');
        if (existingProb) {
            existingProb.remove();
        }
        
        // Update tile class for glow effect (no percentage text)
        tile.classList.remove('prob-extreme', 'prob-high', 'prob-medium', 'prob-low', 'prob-danger');
        tile.classList.add(`prob-${level}`);
    });
}

/**
 * Creates the 5x5 grid of tiles.
 */
function createGrid() {
    minesGridEl.innerHTML = '';
    
    for (let i = 0; i < TOTAL_TILES; i++) {
        const tile = document.createElement('div');
        tile.className = 'mine-tile hidden';
        tile.dataset.index = i;
        tile.onclick = () => revealTile(i);
        minesGridEl.appendChild(tile);
    }
}

// ==========================================================================
// BETTING FUNCTIONS
// ==========================================================================

/**
 * Changes the current bet by the specified amount.
 */
function changeBet(amount) {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    const newBet = gameState.currentBet + amount;
    
    if (newBet >= 1) {
        gameState.currentBet = newBet;
        updateBetDisplay();
    }
}

/**
 * Sets a custom bet from the input field.
 */
function setCustomBet(value) {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    const amount = parseInt(value) || 1;
    gameState.currentBet = Math.max(1, amount);
    updateBetDisplay();
}

/**
 * Sets the bet to half of the player's balance.
 */
function halfBet() {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    const currentBalance = getBalanceSync();
    const halfBalance = Math.floor(currentBalance / 2);
    gameState.currentBet = Math.max(1, halfBalance);
    updateBetDisplay();
}

/**
 * Doubles the current bet.
 */
function doubleBet() {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    gameState.currentBet = gameState.currentBet * 2;
    gameState.currentBet = Math.max(gameState.currentBet, 1);
    updateBetDisplay();
}

/**
 * Sets the bet to the player's entire balance.
 */
function setAllIn() {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    const currentBalance = getBalanceSync();
    gameState.currentBet = currentBalance;
    updateBetDisplay();
}

/**
 * Updates the bet display.
 */
function updateBetDisplay() {
    if (betInputEl) {
        betInputEl.value = gameState.currentBet;
    }
    currentBetEl.textContent = gameState.currentBet;
    updatePotentialWin();
}

// ==========================================================================
// GAME LOGIC
// ==========================================================================

/**
 * Starts a new game with the current bet and mine count.
 */
function startNewGame() {
    if (gameState.state !== GAME_STATE.WAITING && gameState.state !== GAME_STATE.GAME_OVER) {
        return;
    }
    
    if (getBalanceSync() < gameState.currentBet) {
        showMessage('Nicht genügend Guthaben!', 'lose');
        return;
    }
    
    // Deduct bet
    deductFromBalance(gameState.currentBet);
    
    // Reset game state
    gameState.minesCount = parseInt(minesCountSelect.value);
    gameState.revealedTiles = [];
    gameState.state = GAME_STATE.PLAYING;
    gameState.currentMultiplier = 1.0;
    gameState.potentialWin = gameState.currentBet;
    
    // Generate mine positions
    generateMines();
    
    // Reset grid
    resetGrid();
    
    // Update UI
    updateUI();
    updateProbabilityDisplay();
    showMessage('Viel Glück! Klicken Sie auf ein Feld.', '');
    
    // Enable/disable buttons
    newGameBtn.disabled = true;
    cashOutBtn.disabled = false;
}

/**
 * Generates random mine positions.
 */
function generateMines() {
    const indices = [];
    while (indices.length < gameState.minesCount) {
        const randomIndex = Math.floor(Math.random() * TOTAL_TILES);
        if (!indices.includes(randomIndex)) {
            indices.push(randomIndex);
        }
    }
    gameState.mineIndices = indices;
}

/**
 * Resets the grid to initial state.
 */
function resetGrid() {
    const tiles = minesGridEl.querySelectorAll('.mine-tile');
    tiles.forEach(tile => {
        tile.className = 'mine-tile hidden';
        tile.innerHTML = '';
    });
}

/**
 * Reveals a tile at the given index.
 */
function revealTile(index) {
    if (gameState.state !== GAME_STATE.PLAYING) return;
    if (gameState.revealedTiles.includes(index)) return;
    
    const tiles = minesGridEl.querySelectorAll('.mine-tile');
    const tile = tiles[index];
    
    // Check if it's a mine
    if (gameState.mineIndices.includes(index)) {
        // Game over - hit a mine
        tile.className = 'mine-tile mine';
        endGame(false);
        return;
    }
    
    // Safe tile
    gameState.revealedTiles.push(index);
    tile.className = 'mine-tile safe';
    
    // Calculate new multiplier
    updateMultiplier();
    updateUI();
    updateProbabilityDisplay();
    
    // Check if all safe tiles revealed (win)
    const totalSafe = TOTAL_TILES - gameState.minesCount;
    if (gameState.revealedTiles.length === totalSafe) {
        endGame(true);
        return;
    }
    
    // Check if can continue
    getBalance().then((balance) => {
        if (balance <= 0 && gameState.revealedTiles.length < totalSafe) {
            showMessage('Kein Guthaben mehr! Spiel vorbei.', 'lose');
            endGame(false);
        }
    });
}

/**
 * Calculates and updates the current multiplier.
 */
function updateMultiplier() {
    const revealed = gameState.revealedTiles.length;
    const mines = gameState.minesCount;
    
    // Try to get from cache
    if (MULTIPLIER_CACHE[mines] && MULTIPLIER_CACHE[mines][revealed] !== undefined) {
        gameState.currentMultiplier = MULTIPLIER_CACHE[mines][revealed];
    } else {
        // Calculate dynamically
        const totalSafe = TOTAL_TILES - mines;
        const remainingSafe = totalSafe - revealed;
        const remainingTotal = TOTAL_TILES - revealed;
        
        if (remainingSafe > 0 && remainingTotal > 0) {
            gameState.currentMultiplier = Math.pow(remainingSafe / remainingTotal, -0.5);
            gameState.currentMultiplier = Math.round(gameState.currentMultiplier * 100) / 100;
        } else {
            gameState.currentMultiplier = 100;
        }
    }
    
    gameState.potentialWin = Math.round(gameState.currentBet * gameState.currentMultiplier);
}

/**
 * Updates the potential win display.
 */
function updatePotentialWin() {
    currentMultiplierEl.textContent = gameState.currentMultiplier.toFixed(2) + 'x';
    potentialWinEl.textContent = gameState.potentialWin;
}

/**
 * Cash out the current winnings.
 */
function cashOut() {
    if (gameState.state !== GAME_STATE.PLAYING) return;
    
    endGame(true, true);
}

/**
 * Ends the game and calculates results.
 */
function endGame(won, cashedOut = false) {
    gameState.state = GAME_STATE.GAME_OVER;
    
    const tiles = minesGridEl.querySelectorAll('.mine-tile');
    
    // Reveal all mines if game over
    if (!cashedOut) {
        gameState.mineIndices.forEach(index => {
            if (!gameState.revealedTiles.includes(index)) {
                tiles[index].className = 'mine-tile mine';
            }
        });
    }
    
    // Calculate results
    let profit;
    
    if (won) {
        profit = gameState.potentialWin - gameState.currentBet;
        addToBalance(gameState.potentialWin);
        gameState.wins++;
        gameState.totalWinnings += profit;
        
        if (gameState.potentialWin > gameState.highestWin) {
            gameState.highestWin = gameState.potentialWin;
        }
        
        if (cashedOut) {
            showMessage(`Ausgecasht! +${profit}`, 'win');
        } else {
            showMessage(`Gewonnen! Alle sicheren Felder gefunden! +${profit}`, 'win');
        }
    } else {
        profit = -gameState.currentBet;
        gameState.losses++;
        gameState.totalLosses += gameState.currentBet;
        showMessage('Mine getroffen! -' + gameState.currentBet, 'lose');
    }
    
    // Update statistics
    gameState.gamesPlayed++;
    saveStats();
    
    // Add to history
    addToHistory(won, profit);
    
    // Update UI
    gameState.currentMultiplier = 1.0;
    gameState.potentialWin = gameState.currentBet;
    updateUI();
    
    // Enable/disable buttons
    newGameBtn.disabled = false;
    cashOutBtn.disabled = true;
    
    // Reset for next game after delay
    setTimeout(() => {
        if (getBalanceSync() > 0) {
            gameState.state = GAME_STATE.WAITING;
            showMessage('Nächste Runde! Setzen Sie Ihren Einsatz.', '');
            updateUI();
        } else {
            showMessage('Kein Guthaben mehr! Spiel vorbei.', 'lose');
        }
    }, 2000);
}

// ==========================================================================
// UI UPDATES
// ==========================================================================

/**
 * Updates the entire user interface based on the game state.
 */
function updateUI() {
    // Update balance display using syncBalance
    syncBalance();
    
    currentBetEl.textContent = gameState.currentBet;
    
    // Multiplier and potential win
    currentMultiplierEl.textContent = gameState.currentMultiplier.toFixed(2) + 'x';
    potentialWinEl.textContent = gameState.potentialWin;
    
    // Statistics display
    document.getElementById('total-wins').textContent = gameState.wins;
    document.getElementById('total-games').textContent = gameState.gamesPlayed;
    
    // Button states
    cashOutBtn.disabled = gameState.state !== GAME_STATE.PLAYING;
    newGameBtn.disabled = gameState.state === GAME_STATE.PLAYING;
    
    // Mine count select
    minesCountSelect.disabled = gameState.state === GAME_STATE.PLAYING;
}

/**
 * Shows a message on the game table.
 */
function showMessage(message, type) {
    gameMessageEl.textContent = message;
    gameMessageEl.className = `game-message ${type}`;
}

/**
 * Adds an entry to the game history.
 */
function addToHistory(won, profit) {
    const li = document.createElement('li');
    li.className = won ? 'win' : 'lose';
    li.innerHTML = `
        <div>${won ? 'Gewinn' : 'Verlust'}</div>
        <div style="font-size: 0.9em; color: ${profit > 0 ? '#28a745' : '#dc3545'}">
            ${profit > 0 ? '+' : ''}${profit}
        </div>
    `;
    
    historyListEl.insertBefore(li, historyListEl.firstChild);
    
    // Keep maximum 10 entries
    while (historyListEl.children.length > 10) {
        historyListEl.removeChild(historyListEl.lastChild);
    }
}

// ==========================================================================
// LOCAL STORAGE FUNCTIONS
// ==========================================================================

/**
 * Saves game statistics to localStorage.
 */
function saveStats() {
    const stats = {
        currentBet: gameState.currentBet,
        gamesPlayed: gameState.gamesPlayed,
        wins: gameState.wins,
        losses: gameState.losses,
        highestWin: gameState.highestWin,
        totalWinnings: gameState.totalWinnings,
        totalLosses: gameState.totalLosses,
        probabilityEnabled: gameState.probabilityEnabled
    };
    localStorage.setItem('minesStats', JSON.stringify(stats));
}

/**
 * Loads game statistics from localStorage.
 */
function loadStats() {
    const savedStats = localStorage.getItem('minesStats');
    if (savedStats) {
        try {
            const stats = JSON.parse(savedStats);
            gameState.currentBet = stats.currentBet || 100;
            gameState.gamesPlayed = stats.gamesPlayed || 0;
            gameState.wins = stats.wins || 0;
            gameState.losses = stats.losses || 0;
            gameState.highestWin = stats.highestWin || 0;
            gameState.totalWinnings = stats.totalWinnings || 0;
            gameState.totalLosses = stats.totalLosses || 0;
            gameState.probabilityEnabled = stats.probabilityEnabled || false;
            
            // Update UI
            if (probabilityToggle) {
                probabilityToggle.checked = gameState.probabilityEnabled;
            }
        } catch (e) {
            console.error('Error loading stats:', e);
        }
    }
}

/**
 * Resets all statistics.
 */
function resetStats() {
    gameState.currentBet = 100;
    gameState.gamesPlayed = 0;
    gameState.wins = 0;
    gameState.losses = 0;
    gameState.highestWin = 0;
    gameState.totalWinnings = 0;
    gameState.totalLosses = 0;
    gameState.state = GAME_STATE.WAITING;
    
    resetBalance(); // Reset shared balance
    syncBalance();
    saveStats();
    updateUI();
    updateStatsModal();
    showMessage('Statistik zurückgesetzt!', '');
}

// ==========================================================================
// STATS MODAL FUNCTIONS
// ==========================================================================

/**
 * Initializes the stats modal.
 */
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
        if (e.key === 'Escape' && statsModal.style.display === 'block') {
            closeStatsModal();
        }
    });
}

/**
 * Shows the stats modal.
 */
function showStatsModal() {
    updateStatsModal();
    statsModalOverlay.style.display = 'flex';
    statsModal.style.display = 'block';
}

/**
 * Closes the stats modal.
 */
function closeStatsModal() {
    statsModalOverlay.style.display = 'none';
    statsModal.style.display = 'none';
}

/**
 * Updates the stats in the modal.
 */
async function updateStatsModal() {
    // First sync balance to ensure it's up to date
    syncBalance();
    
    const currentBalance = await getBalance();
    const profit = currentBalance - 1000;
    
    document.getElementById('stats-total-games').textContent = gameState.gamesPlayed;
    document.getElementById('stats-wins').textContent = gameState.wins;
    document.getElementById('stats-losses').textContent = gameState.losses;
    document.getElementById('stats-highest-win').textContent = gameState.highestWin;
    document.getElementById('stats-total-winnings').textContent = gameState.totalWinnings;
    document.getElementById('stats-total-losses').textContent = gameState.totalLosses;
    document.getElementById('stats-balance').textContent = Math.round(currentBalance);
    
    const profitEl = document.getElementById('stats-profit');
    profitEl.textContent = profit >= 0 ? `+${profit}` : profit;
    profitEl.className = profit >= 0 ? 'stat-value positive' : 'stat-value negative';
}

// ==========================================================================
// EXPORT FOR GLOBAL USE
// ==========================================================================

window.changeBet = changeBet;
window.setCustomBet = setCustomBet;
window.halfBet = halfBet;
window.doubleBet = doubleBet;
window.setAllIn = setAllIn;
window.startNewGame = startNewGame;
window.revealTile = revealTile;
window.cashOut = cashOut;
window.showStatsModal = showStatsModal;
window.closeStatsModal = closeStatsModal;
window.resetStats = resetStats;
