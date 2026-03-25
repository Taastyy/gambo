/* ==========================================================================
   FUSSBALL WETTEN - LOGIC
   ========================================================================== */

// Teams configuration
const TEAMS = [
    { id: 'GER', name: 'Deutschland', emoji: '🇩🇪', strength: 85 },
    { id: 'FRA', name: 'Frankreich', emoji: '🇫🇷', strength: 88 },
    { id: 'ENG', name: 'England', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', strength: 86 },
    { id: 'SPA', name: 'Spanien', emoji: '🇪🇸', strength: 84 },
    { id: 'ITA', name: 'Italien', emoji: '🇮🇹', strength: 82 },
    { id: 'BRA', name: 'Brasilien', emoji: '🇧🇷', strength: 89 },
    { id: 'ARG', name: 'Argentinien', emoji: '🇦🇷', strength: 87 },
    { id: 'POR', name: 'Portugal', emoji: '🇵🇹', strength: 83 },
    { id: 'NED', name: 'Niederlande', emoji: '🇳🇱', strength: 81 },
    { id: 'BEL', name: 'Belgien', emoji: '🇧🇪', strength: 80 }
];

// Game State
let matches = [];
let betSlip = [];
let activeBets = [];

let stats = {
    totalBets: 0,
    wins: 0,
    losses: 0,
    totalWinnings: 0,
    highestWin: 0
};

// DOM Elements
let matchesListEl, slipItemsEl, slipTotalOddsEl, slipPayoutEl, slipBetInputEl, placeBetBtnEl, activeBetsListEl;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    loadStats();
    loadTeamData();
    generateNewMatches();
    updateUI();
    updateStatsUI();
});

function initializeElements() {
    matchesListEl = document.getElementById('matches-list');
    slipItemsEl = document.getElementById('slip-items');
    slipTotalOddsEl = document.getElementById('slip-total-odds');
    slipPayoutEl = document.getElementById('slip-payout');
    slipBetInputEl = document.getElementById('slip-bet-amount');
    placeBetBtnEl = document.getElementById('place-bet-btn');
    activeBetsListEl = document.getElementById('active-bets-list');

    // Bet input listener
    slipBetInputEl.addEventListener('input', updateSlipCalculations);
}

function loadStats() {
    const saved = localStorage.getItem('footballStats');
    if (saved) stats = JSON.parse(saved);
}

function loadTeamData() {
    const saved = localStorage.getItem('footballTeamData');
    if (saved) {
        const parsed = JSON.parse(saved);
        TEAMS.forEach(team => {
            if (parsed[team.id]) team.strength = parsed[team.id];
        });
    }
}

function saveTeamData() {
    const data = {};
    TEAMS.forEach(team => data[team.id] = team.strength);
    localStorage.setItem('footballTeamData', JSON.stringify(data));
}

function saveStats() {
    localStorage.setItem('footballStats', JSON.stringify(stats));
}

function generateNewMatches() {
    matches = [];
    const shuffled = [...TEAMS].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < shuffled.length; i += 2) {
        const home = shuffled[i];
        const away = shuffled[i + 1];
        if (!home || !away) break;

        matches.push(createMatch(home, away));
    }
    
    renderMatches();
    // Clear slip if matches changed? No, let's keep it but mark as invalid or update odds.
    // For simplicity, we just clear the slip.
    betSlip = [];
    renderSlip();
}

function createMatch(home, away) {
    // Basic 1X2 odds calculation
    const diff = home.strength - away.strength; // -10 to +10 usually
    
    // Base probabilities
    let pWin = 0.45 + (diff / 100);
    let pDraw = 0.25;
    let pLoss = 0.30 - (diff / 100);
    
    // Normalize pick odds (with juice/vig)
    const margin = 1.05; // 5% margin
    const oddsHome = (1 / pWin * margin).toFixed(2);
    const oddsDraw = (1 / pDraw * margin).toFixed(2);
    const oddsAway = (1 / pLoss * margin).toFixed(2);

    return {
        id: Math.random().toString(36).substr(2, 9),
        home,
        away,
        odds: {
            '1': parseFloat(oddsHome),
            'X': parseFloat(oddsDraw),
            '2': parseFloat(oddsAway)
        },
        scores: [] // For score betting in future or just result
    };
}

function renderMatches() {
    matchesListEl.innerHTML = '';
    matches.forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.innerHTML = `
            <div class="team home">
                <span class="team-flag">${match.home.emoji}</span>
                <span class="team-name">${match.home.name}</span>
            </div>
            <div class="match-odds">
                <button class="odd-btn" onclick="addToSlip('${match.id}', '1')">
                    <span>1</span>
                    <span>x${match.odds['1']}</span>
                </button>
                <button class="odd-btn" onclick="addToSlip('${match.id}', 'X')">
                    <span>X</span>
                    <span>x${match.odds['X']}</span>
                </button>
                <button class="odd-btn" onclick="addToSlip('${match.id}', '2')">
                    <span>2</span>
                    <span>x${match.odds['2']}</span>
                </button>
            </div>
            <div class="team away">
                <span class="team-flag">${match.away.emoji}</span>
                <span class="team-name">${match.away.name}</span>
            </div>
        `;
        matchesListEl.appendChild(card);
    });
}

function addToSlip(matchId, pick) {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Check if match already in slip
    const existingIndex = betSlip.findIndex(s => s.matchId === matchId);
    if (existingIndex !== -1) {
        if (betSlip[existingIndex].pick === pick) {
            // Remove if same pick
            betSlip.splice(existingIndex, 1);
        } else {
            // Update pick if different
            betSlip[existingIndex].pick = pick;
            betSlip[existingIndex].odds = match.odds[pick];
        }
    } else {
        // Add new
        betSlip.push({
            matchId,
            matchStr: `${match.home.name} - ${match.away.name}`,
            pick,
            odds: match.odds[pick]
        });
    }

    renderSlip();
    updateUISelections();
}

function renderSlip() {
    slipItemsEl.innerHTML = '';
    if (betSlip.length === 0) {
        slipItemsEl.innerHTML = '<div class="empty-slip-msg">Wähle eine Quote aus, um eine Wette hinzuzufügen.</div>';
    } else {
        betSlip.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'slip-item';
            el.innerHTML = `
                <div class="slip-item-header">
                    <span>Einzelwette</span>
                    <span class="remove-item" onclick="removeFromSlip(${index})">&times;</span>
                </div>
                <div class="slip-item-match">${item.matchStr}</div>
                <div class="slip-item-pick">
                    <span>Ergebnis: ${item.pick === 'X' ? 'Unentschieden' : (item.pick === '1' ? 'Heimsieg' : 'Auswärtssieg')}</span>
                    <span>x${item.odds}</span>
                </div>
            `;
            slipItemsEl.appendChild(el);
        });
    }

    document.getElementById('bet-count').textContent = betSlip.length;
    updateSlipCalculations();
}

function removeFromSlip(index) {
    betSlip.splice(index, 1);
    renderSlip();
    updateUISelections();
}

function updateSlipCalculations() {
    const totalOdds = betSlip.reduce((acc, item) => acc * item.odds, 1);
    const betAmount = parseFloat(slipBetInputEl.value) || 0;
    const payout = totalOdds * betAmount;

    slipTotalOddsEl.textContent = betSlip.length > 0 ? totalOdds.toFixed(2) : '1.00';
    slipPayoutEl.textContent = (betSlip.length > 0 && betAmount > 0) ? Math.floor(payout).toLocaleString() : '0';
    
    placeBetBtnEl.disabled = betSlip.length === 0 || betAmount < 10;
}

function updateUISelections() {
    // Clear all
    document.querySelectorAll('.odd-btn').forEach(btn => btn.classList.remove('selected'));
    
    // Set selected
    betSlip.forEach(item => {
        // This is a bit inefficient (searching DOM), but for small number of matches it's fine
        const matchIndex = matches.findIndex(m => m.id === item.matchId);
        if (matchIndex !== -1) {
            const card = matchesListEl.children[matchIndex];
            const btns = card.querySelectorAll('.odd-btn');
            if (item.pick === '1') btns[0].classList.add('selected');
            if (item.pick === 'X') btns[1].classList.add('selected');
            if (item.pick === '2') btns[2].classList.add('selected');
        }
    });
}

function adjustSlipBet(factor) {
    const val = parseFloat(slipBetInputEl.value) || 100;
    slipBetInputEl.value = Math.max(10, Math.floor(val * factor));
    updateSlipCalculations();
}

function setSlipMaxBet() {
    if (typeof getBalanceSync === 'function') {
        slipBetInputEl.value = Math.floor(getBalanceSync());
        updateSlipCalculations();
    }
}

async function placeBet() {
    if (placeBetBtnEl.disabled) return;
    
    const amount = parseFloat(slipBetInputEl.value);
    if (!amount || amount < 10) return;

    placeBetBtnEl.disabled = true;

    const totalOdds = betSlip.reduce((acc, item) => acc * item.odds, 1);
    
    // Call server
    try {
        const token = localStorage.getItem('casinoToken') || '';
        const res = await fetch('/api/football/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ amount, totalOdds })
        });
        const data = await res.json();
        
        if (!data.success) {
            showGameMessage(data.error || 'Server Fehler!', 'error');
            placeBetBtnEl.disabled = false;
            return;
        }

        // Deduct balance instantly
        if (document.getElementById('balance')) document.getElementById('balance').textContent = Math.round(data.newBalance - data.wonAmount).toLocaleString();

        const ticket = {
            id: Date.now(),
            bets: [...betSlip],
            amount,
            totalOdds,
            potentialPayout: data.wonAmount || Math.floor(amount * totalOdds),
            status: 'pending'
        };

        activeBets.push(ticket);
        stats.totalBets++;
        saveStats();
        renderActiveBets();
        updateStatsUI();
        
        betSlip = [];
        renderSlip();
        updateUISelections();
        
        startSimulation(ticket, data.isWin, data);

    } catch(e) {
        showGameMessage('Netzwerkfehler', 'error');
        placeBetBtnEl.disabled = false;
    }
}

function renderActiveBets() {
    activeBetsListEl.innerHTML = '';
    activeBets.forEach(bet => {
        const el = document.createElement('div');
        el.className = 'active-bet-card';
        el.innerHTML = `
            <div class="active-bet-info">
                <span>Einsatz: ${bet.amount}</span>
                <span>Quote: ${bet.totalOdds.toFixed(2)}</span>
            </div>
            <div class="active-bet-matches">
                ${bet.bets.length} Spiel(e) in Auswahl
            </div>
        `;
        activeBetsListEl.appendChild(el);
    });
}

async function startSimulation(ticket, isWin, serverData) {
    const overlay = document.getElementById('sim-overlay');
    const simMatchesEl = document.getElementById('sim-matches');
    const timerEl = document.getElementById('sim-timer');
    const closeBtn = document.getElementById('close-sim-btn');
    
    overlay.classList.add('show');
    closeBtn.style.display = 'none';
    
    // Prepare match results
    const results = ticket.bets.map(b => {
        const match = matches.find(m => m.id === b.matchId);
        return {
            ...b,
            home: match.home,
            away: match.away,
            scoreHome: 0,
            scoreAway: 0,
            finalScoreHome: 0,
            finalScoreAway: 0
        };
    });

    // Make sure we lose at least one if `isWin` is false
    let fakeLoseIndex = -1;
    if (!isWin) fakeLoseIndex = Math.floor(Math.random() * results.length);

    results.forEach((res, index) => {
        let shouldWinThisMatch = false;
        if (isWin) {
            shouldWinThisMatch = true;
        } else {
            if (index === fakeLoseIndex) shouldWinThisMatch = false;
            else shouldWinThisMatch = Math.random() < 0.5;
        }

        if (shouldWinThisMatch) {
            if (res.pick === '1') { res.finalScoreHome = 2; res.finalScoreAway = 0; }
            if (res.pick === '2') { res.finalScoreHome = 0; res.finalScoreAway = 2; }
            if (res.pick === 'X') { res.finalScoreHome = 1; res.finalScoreAway = 1; }
        } else {
            if (res.pick === '1') { res.finalScoreHome = 0; res.finalScoreAway = 2; }
            if (res.pick === '2') { res.finalScoreHome = 2; res.finalScoreAway = 0; }
            if (res.pick === 'X') { res.finalScoreHome = 2; res.finalScoreAway = 1; }
        }
    });

    // Simulate minutes
    for (let m = 0; m <= 90; m += 2) {
        timerEl.textContent = m + "'";
        
        // Randomly update scores based on final goals
        results.forEach(res => {
            if (res.scoreHome < res.finalScoreHome && Math.random() < 0.05) res.scoreHome++;
            if (res.scoreAway < res.finalScoreAway && Math.random() < 0.05) res.scoreAway++;
        });

        // Render simulation state
        simMatchesEl.innerHTML = '';
        results.forEach(res => {
            const row = document.createElement('div');
            row.className = 'sim-match-row';
            row.innerHTML = `
                <div class="team">${res.home.emoji} ${res.home.name}</div>
                <div class="sim-score">${res.scoreHome} : ${res.scoreAway}</div>
                <div class="team">${res.away.name} ${res.away.emoji}</div>
            `;
            simMatchesEl.appendChild(row);
        });

        await delay(100);
    }

    // Final state
    timerEl.textContent = "90'";
    timerEl.style.color = "var(--win)";
    closeBtn.style.display = 'block';
    
    // Check ticket result
    checkTicketResult(ticket, results, serverData);
}

function checkTicketResult(ticket, simResults, serverData) {
    let won = true;
    
    simResults.forEach(res => {
        let result = 'X';
        if (res.finalScoreHome > res.finalScoreAway) result = '1';
        if (res.finalScoreHome < res.finalScoreAway) result = '2';
        
        if (res.pick !== result) won = false;
        
        // Update Team Strengths (Dynamic Odds)
        updateTeamForm(res.home, res.away, result);
    });

    ticket.status = won ? 'won' : 'lost';
    
    if (won) {
        handleWin(ticket.potentialPayout, serverData);
    } else {
        handleLoss(ticket.amount, serverData);
    }

    saveTeamData();
    // After simulation, we can generate new matches for the next round
    setTimeout(generateNewMatches, 2000);
}

function updateTeamForm(home, away, result) {
    if (result === '1') {
        home.strength = Math.min(99, home.strength + 0.5);
        away.strength = Math.max(60, away.strength - 0.5);
    } else if (result === '2') {
        away.strength = Math.min(99, away.strength + 0.5);
        home.strength = Math.max(60, home.strength - 0.5);
    } else {
        // Draw: convergence?
    }
}

async function handleWin(amount, serverData) {
    stats.wins++;
    stats.totalWinnings += amount;
    if (amount > stats.highestWin) stats.highestWin = amount;
    
    if (serverData && document.getElementById('balance')) {
        document.getElementById('balance').textContent = Math.round(serverData.newBalance).toLocaleString();
        if (typeof window.syncBalance === 'function') setTimeout(window.syncBalance, 100);
    }
    
    saveStats();
    updateStatsUI();
    showWinOverlay(amount);
}

function handleLoss(amount, serverData) {
    stats.losses++;
    saveStats();
    updateStatsUI();

    if (serverData && document.getElementById('balance')) {
        document.getElementById('balance').textContent = Math.round(serverData.newBalance).toLocaleString();
        if (typeof window.syncBalance === 'function') setTimeout(window.syncBalance, 100);
    }

    showGameMessage(`Schade! Kein Gewinn diesmal.`, 'error');
}

function updateStatsUI() {
    const totalBetsEl = document.getElementById('stats-total-bets');
    const winsEl = document.getElementById('stats-wins');
    const lossesEl = document.getElementById('stats-losses');
    const highestWinEl = document.getElementById('stats-highest-win');
    const totalWinsHeaderEl = document.getElementById('total-wins');

    if (totalBetsEl) totalBetsEl.textContent = stats.totalBets;
    if (winsEl) winsEl.textContent = stats.wins;
    if (lossesEl) lossesEl.textContent = stats.losses;
    if (highestWinEl) highestWinEl.textContent = stats.highestWin.toLocaleString();
    if (totalWinsHeaderEl) totalWinsHeaderEl.textContent = stats.totalWinnings.toLocaleString();
}

function updateUI() {
    updateStatsUI();
    syncBalanceDisplay();
}

function closeSim() {
    document.getElementById('sim-overlay').classList.remove('show');
    activeBets = []; // Clear for this demo, or keep history
    renderActiveBets();
}

function showWinOverlay(amount) {
    const overlay = document.getElementById('win-overlay');
    document.getElementById('win-amount-large').textContent = `+${amount.toLocaleString()}`;
    overlay.classList.add('show');
    createConfetti();
}

function closeWinOverlay() {
    document.getElementById('win-overlay').classList.remove('show');
}

// Helpers
function poissonRandom(mean) {
    let L = Math.exp(-mean);
    let p = 1.0;
    let k = 0;
    do {
        k++;
        p *= Math.random();
    } while (p > L);
    return k - 1;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showGameMessage(msg, type) {
    const el = document.getElementById('game-message');
    el.textContent = msg;
    el.className = `game-message show ${type}`;
    setTimeout(() => el.classList.remove('show'), 3000);
}

function syncBalanceDisplay() {
    if (typeof getBalanceSync === 'function') {
        const b = getBalanceSync();
        document.getElementById('balance').textContent = Math.round(b).toLocaleString();
    }
}

function createConfetti() {
    const container = document.getElementById('confetti');
    container.innerHTML = '';
    const colors = ['#4caf50', '#ffd700', '#ffffff', '#2196f3', '#f44336'];
    for (let i = 0; i < 100; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + '%';
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        c.style.animationDelay = Math.random() * 2 + 's';
        c.style.animationDuration = (Math.random() * 1 + 2) + 's';
        container.appendChild(c);
    }
}

// Global exposure
window.addToSlip = addToSlip;
window.removeFromSlip = removeFromSlip;
window.adjustSlipBet = adjustSlipBet;
window.setSlipMaxBet = setSlipMaxBet;
window.placeBet = placeBet;
window.generateNewMatches = generateNewMatches;
window.closeSim = closeSim;
window.closeWinOverlay = closeWinOverlay;
