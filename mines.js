/**
 * Mines Game JavaScript - Premium Edition
 */

const GRID_SIZE = 5;
const TOTAL_TILES = 25;
const CUSTOM_MULTIPLIER_CACHE = {};

const GAME_STATE = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    GAME_OVER: 'game_over'
};

let gameState = {
    currentBet: 100,
    minesCount: 5,
    revealedTiles: [],
    mineIndices: [],
    state: GAME_STATE.WAITING,
    currentMultiplier: 1.0,
    potentialWin: 100,
    hintsUsed: false,
    
    // Stats
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    highestWin: 0
};

// DOM
let balanceEl, currentBetDisplayEl, betInputEl, minesCountSelect;
let currentMultiplierEl, potentialWinEl, gameMessageEl, minesGridEl;
let mainActionBtn, hintBtn, historyListEl, statsModalOverlay;

document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    initMultipliers();
    createGrid();
    loadStats();
    
    // Sync external balance
    setTimeout(() => {
        if(typeof syncBalance === 'function') syncBalance();
        if(typeof getBalanceSync === 'function') {
            const bal = getBalanceSync();
            if(balanceEl) balanceEl.textContent = bal.toFixed(2);
        }
        updateUI();
    }, 50);
});

function initDOM() {
    balanceEl = document.getElementById('balance');
    currentBetDisplayEl = document.getElementById('current-bet-display');
    betInputEl = document.getElementById('bet-input');
    minesCountSelect = document.getElementById('mines-count');
    currentMultiplierEl = document.getElementById('current-multiplier');
    potentialWinEl = document.getElementById('potential-win-amount');
    gameMessageEl = document.getElementById('game-message');
    minesGridEl = document.getElementById('mines-grid');
    mainActionBtn = document.getElementById('main-action-btn');
    hintBtn = document.getElementById('hint-btn');
    historyListEl = document.getElementById('history-list');
    statsModalOverlay = document.getElementById('stats-modal-overlay');

    minesCountSelect.addEventListener('change', (e) => {
        if(gameState.state === GAME_STATE.WAITING) {
            gameState.minesCount = parseInt(e.target.value);
            updatePotentialWin();
        }
    });

    document.addEventListener('keydown', (e) => {
        if(e.code === 'Space') {
            e.preventDefault();
            handleMainAction();
        }
    });
}

function initMultipliers() {
    [3, 5, 10, 15, 20].forEach(mines => {
        CUSTOM_MULTIPLIER_CACHE[mines] = {};
        const totalSafe = TOTAL_TILES - mines;
        
        let currentMult = 1.0;
        for (let r = 1; r <= totalSafe; r++) {
            // Standard House Edge multiplier approx
            const remainingSafe = totalSafe - (r - 1);
            const remainingTotal = TOTAL_TILES - (r - 1);
            const prob = remainingSafe / remainingTotal;
            currentMult = currentMult * (1 / prob) * 0.99; // 1% house edge
            CUSTOM_MULTIPLIER_CACHE[mines][r] = Math.round(currentMult * 100) / 100;
        }
    });
}

function createGrid() {
    minesGridEl.innerHTML = '';
    minesGridEl.className = 'mines-grid'; 
    for (let i = 0; i < TOTAL_TILES; i++) {
        const tile = document.createElement('div');
        tile.className = 'mine-tile';
        tile.onclick = () => revealTile(i);
        minesGridEl.appendChild(tile);
    }
}

// Betting Actions
function setCustomBet(val) {
    if(gameState.state !== GAME_STATE.WAITING) return;
    let bet = parseInt(val);
    if(isNaN(bet) || bet < 1) bet = 1;
    gameState.currentBet = bet;
    updateBetDisplay();
}

function changeBet(amt) {
    if(gameState.state !== GAME_STATE.WAITING) return;
    gameState.currentBet = Math.max(1, gameState.currentBet + amt);
    updateBetDisplay();
}

function halfBet() {
    if(gameState.state !== GAME_STATE.WAITING) return;
    gameState.currentBet = Math.max(1, Math.floor(gameState.currentBet / 2));
    updateBetDisplay();
}

function doubleBet() {
    if(gameState.state !== GAME_STATE.WAITING) return;
    gameState.currentBet = gameState.currentBet * 2;
    updateBetDisplay();
}

function setAllIn() {
    if(gameState.state !== GAME_STATE.WAITING) return;
    if(typeof getBalanceSync === 'function') {
        gameState.currentBet = Math.floor(getBalanceSync());
    }
    updateBetDisplay();
}

function updateBetDisplay() {
    betInputEl.value = gameState.currentBet;
    currentBetDisplayEl.textContent = `€${gameState.currentBet.toFixed(2)}`;
    updatePotentialWin();
}

// Game Flow
function handleMainAction() {
    if(gameState.state === GAME_STATE.WAITING || gameState.state === GAME_STATE.GAME_OVER) {
        startGame();
    } else if(gameState.state === GAME_STATE.PLAYING) {
        if(gameState.revealedTiles.length > 0) {
            cashOut();
        }
    }
}

async function startGame() {
    let currentBal = 0;
    if (typeof getBalanceSync === 'function') currentBal = getBalanceSync();
    
    if (currentBal < gameState.currentBet) {
        showMsg('Nicht genügend Guthaben!', 'danger');
        return;
    }

    gameState.state = GAME_STATE.PLAYING;
    gameState.minesCount = parseInt(minesCountSelect.value);
    gameState.revealedTiles = [];
    gameState.currentMultiplier = 1.0;
    gameState.potentialWin = gameState.currentBet;
    gameState.hintsUsed = false;
    
    // Server start
    try {
        const token = localStorage.getItem('casinoToken');
        const res = await fetch('/api/mines/start', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ bet: gameState.currentBet, minesCount: gameState.minesCount })
        });
        const data = await res.json();
        if (!data.success) {
            showMsg(data.error || 'Server Fehler', 'danger');
            gameState.state = GAME_STATE.WAITING;
            return;
        }
        if (balanceEl) balanceEl.textContent = data.newBalance.toFixed(2);
    } catch(e) {
        showMsg('Netzwerkfehler', 'danger');
        gameState.state = GAME_STATE.WAITING;
        return;
    }

    // Visual reset
    minesGridEl.classList.add('is-playing');
    const tiles = minesGridEl.querySelectorAll('.mine-tile');
    tiles.forEach(t => {
        t.className = 'mine-tile';
        t.innerHTML = '';
        t.style.opacity = '1';
    });
    
    updateUI();
    showMsg('Spiel gestartet. Viel Glück!');
}

function generateMines() {
    // Moved to server
}

async function revealTile(index) {
    if(gameState.state !== GAME_STATE.PLAYING) return;
    if(gameState.revealedTiles.includes(index)) return;

    const tiles = minesGridEl.querySelectorAll('.mine-tile');
    const tile = tiles[index];

    const hintText = tile.querySelector('.hint-text');
    if(hintText) hintText.remove();

    try {
        const token = localStorage.getItem('casinoToken');
        const res = await fetch('/api/mines/reveal', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ index })
        });
        const data = await res.json();
        
        if (!data.success) {
            showMsg('Ungültiger Zug', 'danger');
            return;
        }

        if (data.gameover) { // BOOM or Auto-cashout
            if (!data.win) {
                // Mine hit
                tile.classList.add('revealed', 'mine');
                tile.innerHTML = '<div class="tile-inner"><div class="icon"></div></div>';
                gameState.mineIndices = data.mineIndices || [];
                endGame(false, false, data.newBalance);
            } else {
                // Auto cashout (all safe tiles revealed)
                gameState.revealedTiles.push(index);
                tile.classList.add('revealed', 'safe');
                tile.innerHTML = '<div class="tile-inner"><div class="icon"></div></div>';
                gameState.mineIndices = data.mineIndices || [];
                gameState.potentialWin = data.wonAmount;
                gameState.currentMultiplier = data.multiplier;
                endGame(true, false, data.newBalance);
            }
        } else {
            // Safe, continue playing
            gameState.revealedTiles.push(index);
            tile.classList.add('revealed', 'safe');
            tile.innerHTML = '<div class="tile-inner"><div class="icon"></div></div>';
            gameState.potentialWin = data.potentialWin;
            gameState.currentMultiplier = data.multiplier;
            updateUI();
        }
    } catch(e) {
        showMsg('Netzwerkfehler', 'danger');
    }
}

async function cashOut() {
    if(gameState.state !== GAME_STATE.PLAYING || gameState.revealedTiles.length === 0) return;
    
    try {
        const token = localStorage.getItem('casinoToken');
        const res = await fetch('/api/mines/cashout', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}
        });
        const data = await res.json();
        
        if(!data.success) {
            showMsg('Fehler beim Cashout', 'danger');
            return;
        }
        
        gameState.mineIndices = data.mineIndices || [];
        gameState.potentialWin = data.wonAmount;
        gameState.currentMultiplier = data.multiplier;
        endGame(true, true, data.newBalance);
        
    } catch(e) {
        showMsg('Netzwerkfehler', 'danger');
    }
}

function endGame(won, cashedOut = false, newBalance) {
    gameState.state = GAME_STATE.GAME_OVER;
    minesGridEl.classList.remove('is-playing');
    
    // Reveal everything
    const tiles = minesGridEl.querySelectorAll('.mine-tile');
    
    (gameState.mineIndices || []).forEach(idx => {
        const t = tiles[idx];
        if(!t.classList.contains('revealed')) {
            t.classList.add('revealed', won ? 'mine-faded' : 'mine');
            t.innerHTML = '<div class="tile-inner"><div class="icon"></div></div>';
        }
    });

    for(let i=0; i<TOTAL_TILES; i++) {
        if(!(gameState.mineIndices || []).includes(i) && !gameState.revealedTiles.includes(i)) {
            const t = tiles[i];
            t.style.opacity = '0.4';
        }
    }
    
    gameState.gamesPlayed++;
    
    if(won) {
        gameState.wins++;
        let profit = gameState.potentialWin - gameState.currentBet;
        if(gameState.potentialWin > gameState.highestWin) gameState.highestWin = gameState.potentialWin;
        
        let mText = cashedOut ? `Ausgecasht! +€${profit.toFixed(2)}` : `Gewonnen! +€${profit.toFixed(2)}`;
        showMsg(mText, 'success');
        addHistory(true, gameState.potentialWin, gameState.currentMultiplier);
    } else {
        gameState.losses++;
        showMsg(`Mine getroffen! -€${gameState.currentBet.toFixed(2)}`, 'danger');
        addHistory(false, gameState.currentBet, 0);
    }
    
    if (balanceEl && newBalance !== undefined) balanceEl.textContent = newBalance.toFixed(2);
    if (typeof window.syncBalance === 'function') setTimeout(window.syncBalance, 100);

    saveStats();
    updateUI();
    
    // Automatically reset display after a short time
    setTimeout(() => {
        gameState.potentialWin = gameState.currentBet;
        gameState.currentMultiplier = 1.0;
        updateUI();
    }, 2000);
}

// Hints 
function showHints() {
    if(gameState.state !== GAME_STATE.PLAYING || gameState.hintsUsed) return;
    if(gameState.revealedTiles.length === 0) return; // Must reveal at least 1 tile first maybe? Or just allow anytime
    
    gameState.hintsUsed = true;
    updateUI();

    let unrevealed = [];
    for(let i=0; i<TOTAL_TILES; i++) {
        if(!gameState.revealedTiles.includes(i)) unrevealed.push(i);
    }
    
    let amount = Math.min(3, unrevealed.length);
    if(amount === 0) return;
    
    let shuffled = unrevealed.sort(() => 0.5 - Math.random());
    let selected = shuffled.slice(0, amount);
    
    const tiles = minesGridEl.querySelectorAll('.mine-tile');
    
    selected.forEach(idx => {
        let isMine = gameState.mineIndices.includes(idx);
        let t = tiles[idx];
        
        let pct = isMine ? (Math.floor(Math.random()*25)+75) : (Math.floor(Math.random()*25)+5);
        
        let span = document.createElement('span');
        span.className = `hint-text ${pct >= 50 ? 'hint-danger' : 'hint-safe'}`;
        span.textContent = `${pct}%`;
        t.appendChild(span);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if(span.parentNode === t) t.removeChild(span);
        }, 4000);
    });
}

// UI
function updateUI() {
    if(typeof syncBalance === 'function') syncBalance();
    if(typeof getBalanceSync === 'function' && balanceEl) {
        balanceEl.textContent = getBalanceSync().toFixed(2);
    }
    
    currentMultiplierEl.textContent = `${gameState.currentMultiplier.toFixed(2)}×`;
    potentialWinEl.textContent = `€${gameState.potentialWin.toFixed(2)}`;
    
    betInputEl.disabled = gameState.state === GAME_STATE.PLAYING;
    minesCountSelect.disabled = gameState.state === GAME_STATE.PLAYING;
    
    // Main button logic
    if(gameState.state === GAME_STATE.WAITING || gameState.state === GAME_STATE.GAME_OVER) {
        mainActionBtn.textContent = 'Spielen';
        mainActionBtn.className = 'btn-primary';
        mainActionBtn.disabled = false;
        hintBtn.disabled = true;
    } else {
        if(gameState.revealedTiles.length > 0) {
            mainActionBtn.textContent = `Cash Out €${gameState.potentialWin.toFixed(2)}`;
            mainActionBtn.className = 'btn-primary btn-cashout';
            mainActionBtn.disabled = false;
            hintBtn.disabled = gameState.hintsUsed;
        } else {
            mainActionBtn.textContent = 'Zuerst ein Feld aufdecken';
            mainActionBtn.className = 'btn-primary';
            mainActionBtn.disabled = true;
            hintBtn.disabled = gameState.hintsUsed; // can hint early
        }
    }
    
    if(gameState.state !== GAME_STATE.PLAYING) {
        mainActionBtn.disabled = false;
    }
}

function updatePotentialWin() {
    if(gameState.state === GAME_STATE.WAITING) {
        gameState.potentialWin = gameState.currentBet;
        potentialWinEl.textContent = `€${gameState.potentialWin.toFixed(2)}`;
    }
}

let msgTimeout;
function showMsg(text, type='neutral') {
    gameMessageEl.textContent = text;
    gameMessageEl.className = `game-message ${type === 'danger' ? 'text-danger' : (type === 'success' ? 'text-success' : '')}`;
    gameMessageEl.classList.remove('hidden');
    clearTimeout(msgTimeout);
    msgTimeout = setTimeout(() => {
        gameMessageEl.classList.add('hidden');
    }, 3000);
}

function addHistory(won, amt, mult) {
    const el = document.createElement('div');
    el.className = `history-item ${won?'win':'lose'}`;
    if(won) {
        el.innerHTML = `<span>${mult.toFixed(2)}×</span> <span class="history-val win">+€${amt.toFixed(2)}</span>`;
    } else {
        el.innerHTML = `<span>Bust</span> <span class="history-val lose">-€${amt.toFixed(2)}</span>`;
    }
    historyListEl.prepend(el);
    if(historyListEl.children.length > 15) {
        historyListEl.removeChild(historyListEl.lastChild);
    }
}

// Stats & Storage
function saveStats() {
    localStorage.setItem('minesPremiumStats', JSON.stringify({
        gamesPlayed: gameState.gamesPlayed,
        wins: gameState.wins,
        losses: gameState.losses,
        highestWin: gameState.highestWin
    }));
}

function loadStats() {
    const s = localStorage.getItem('minesPremiumStats');
    if(s) {
        try {
            const parsed = JSON.parse(s);
            gameState.gamesPlayed = parsed.gamesPlayed || 0;
            gameState.wins = parsed.wins || 0;
            gameState.losses = parsed.losses || 0;
            gameState.highestWin = parsed.highestWin || 0;
        } catch(e){}
    }
}

function showStatsModal() {
    document.getElementById('stats-total-games').textContent = gameState.gamesPlayed;
    document.getElementById('stats-wins').textContent = gameState.wins;
    document.getElementById('stats-losses').textContent = gameState.losses;
    document.getElementById('stats-highest-win').textContent = `€${gameState.highestWin.toFixed(2)}`;
    if(typeof getBalanceSync === 'function') {
        const balEl = document.getElementById('stats-balance');
        if(balEl) balEl.textContent = getBalanceSync().toFixed(2);
    }
    statsModalOverlay.classList.remove('hidden');
}

function closeStatsModal() {
    statsModalOverlay.classList.add('hidden');
}

function resetStats() {
    gameState.gamesPlayed = 0;
    gameState.wins = 0;
    gameState.losses = 0;
    gameState.highestWin = 0;
    if (typeof resetBalance === 'function') resetBalance();
    saveStats();
    showStatsModal();
    updateUI();
    showMsg('Statistiken & Balance zurückgesetzt');
}

// Exports
window.setCustomBet = setCustomBet;
window.changeBet = changeBet;
window.halfBet = halfBet;
window.doubleBet = doubleBet;
window.setAllIn = setAllIn;
window.handleMainAction = handleMainAction;
window.showHints = showHints;
window.showStatsModal = showStatsModal;
window.closeStatsModal = closeStatsModal;
window.resetStats = resetStats;
