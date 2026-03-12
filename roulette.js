/**
 * Roulette — European Roulette with Canvas Wheel
 */

const WHEEL_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const SEGMENTS      = 37;
const SEG_DEG       = 360 / SEGMENTS;
const SEG_RAD       = (Math.PI * 2) / SEGMENTS;

/* ---------- State ---------- */
let state = {
    currentChip: 10,
    bets: [],
    totalBet: 0,
    history: [],
    spinning: false,
    wheelAngle: 0     // current visual rotation in degrees
};

let stats = { games: 0, won: 0, lost: 0 };

/* ---------- DOM ---------- */
const canvas     = document.getElementById('wheel-canvas');
const ctx        = canvas.getContext('2d');
const ballEl     = document.getElementById('ball');
const displayNum = document.getElementById('winning-number');
const histList   = document.getElementById('history-list');
const toastEl    = document.getElementById('toast-message');
const statsModal = document.getElementById('stats-modal-overlay');

/* ---------- Init ---------- */
function init() {
    loadStats();
    buildBoard();
    drawWheel(0);
    setupControls();
    updateUI();
}

/* ---------- Stats ---------- */
function loadStats() {
    try { stats = JSON.parse(localStorage.getItem('rouletteStats')) || stats; } catch(e) {}
}
function saveStats() {
    localStorage.setItem('rouletteStats', JSON.stringify(stats));
}
function updateStatsModal() {
    document.getElementById('stat-games').textContent = stats.games;
    document.getElementById('stat-won-amount').textContent = stats.won;
    document.getElementById('stat-lost-amount').textContent = stats.lost;
    const profit = stats.won - stats.lost;
    const profitEl = document.getElementById('stat-profit');
    profitEl.textContent = profit;
    profitEl.style.color = profit > 0 ? 'var(--green)' : (profit < 0 ? 'var(--red)' : 'var(--text)');
}

/* ---------- Helpers ---------- */
function getColor(n) {
    if (n === 0) return 'green';
    return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

/* ==========================================================================
   CANVAS WHEEL — realistic look
   ========================================================================== */
function drawWheel(rotation) {
    const W = canvas.width;
    const cx = W / 2, cy = W / 2;
    const R = W / 2 - 4;              // outer radius

    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation * Math.PI / 180);

    // --- Outer chrome ring ---
    const rimGrad = ctx.createRadialGradient(0, 0, R - 18, 0, 0, R);
    rimGrad.addColorStop(0, '#888');
    rimGrad.addColorStop(0.3, '#bbb');
    rimGrad.addColorStop(0.5, '#ddd');
    rimGrad.addColorStop(0.7, '#aaa');
    rimGrad.addColorStop(1, '#555');
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad; ctx.fill();

    // Gold trim
    ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#c9a44c'; ctx.lineWidth = 2; ctx.stroke();

    // --- Dark inner wheel ---
    ctx.beginPath(); ctx.arc(0, 0, R - 12, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0c10'; ctx.fill();

    // --- Pockets ---
    const pocketOuter = R - 14;
    const pocketInner = R - 60;

    for (let i = 0; i < SEGMENTS; i++) {
        const num = WHEEL_NUMBERS[i];
        const startA = -Math.PI / 2 - SEG_RAD / 2 + i * SEG_RAD;
        const endA   = startA + SEG_RAD;

        // Pocket fill
        ctx.beginPath();
        ctx.arc(0, 0, pocketOuter, startA, endA);
        ctx.arc(0, 0, pocketInner, endA, startA, true);
        ctx.closePath();

        if (num === 0)                     ctx.fillStyle = '#27ae60';
        else if (RED_NUMBERS.includes(num)) ctx.fillStyle = '#c0392b';
        else                                ctx.fillStyle = '#1a1e24';
        ctx.fill();

        // Pocket dividers
        ctx.beginPath();
        ctx.moveTo(Math.cos(startA) * pocketInner, Math.sin(startA) * pocketInner);
        ctx.lineTo(Math.cos(startA) * pocketOuter, Math.sin(startA) * pocketOuter);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();

        // Number text
        const textR = (pocketOuter + pocketInner) / 2;
        const textA = startA + SEG_RAD / 2;
        const tx = Math.cos(textA) * textR;
        const ty = Math.sin(textA) * textR;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(textA + Math.PI / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        ctx.fillText(num, 0, 0);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // --- Inner decorative rings ---
    // Ball track groove
    ctx.beginPath(); ctx.arc(0, 0, pocketOuter + 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,200,200,0.15)'; ctx.lineWidth = 4; ctx.stroke();

    // Inner ring
    ctx.beginPath(); ctx.arc(0, 0, pocketInner, 0, Math.PI * 2);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke();

    // Spokes / diamond decorations
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (pocketInner - 4), Math.sin(a) * (pocketInner - 4));
        ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30);
        ctx.strokeStyle = 'rgba(201,164,76,0.15)'; ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
}

/* ==========================================================================
   BOARD BUILD
   ========================================================================== */
function buildBoard() {
    const row3 = document.getElementById('row-3');
    const row2 = document.getElementById('row-2');
    const row1 = document.getElementById('row-1');

    for (let i = 1; i <= 36; i++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell num-' + i + (getColor(i) === 'red' ? ' red' : '');
        cell.dataset.bet = 'num-' + i;
        cell.textContent = i;
        if (i % 3 === 0)      row3.appendChild(cell);
        else if (i % 3 === 2) row2.appendChild(cell);
        else                   row1.appendChild(cell);
    }

    document.querySelectorAll('.board-cell').forEach(cell => {
        if (!cell.classList.contains('empty-left') && !cell.classList.contains('empty-right')) {
            cell.addEventListener('click', () => placeBet(cell));
        }
    });

    // Modal bindings
    document.getElementById('btn-stats').addEventListener('click', () => {
        updateStatsModal();
        statsModal.classList.remove('hidden');
    });
    document.getElementById('close-stats-btn').addEventListener('click', () => {
        statsModal.classList.add('hidden');
    });
    document.getElementById('btn-reset-balance').addEventListener('click', async () => {
        if (confirm('Balance und Statistik wirklich zurücksetzen?')) {
            stats = { games: 0, won: 0, lost: 0 };
            saveStats();
            if (typeof resetBalance === 'function') await resetBalance();
            updateStatsModal();
            updateUI();
            showToast('Zurückgesetzt.');
        }
    });
}

/* ==========================================================================
   CONTROLS
   ========================================================================== */
function setupControls() {
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentChip = parseInt(btn.dataset.value);
        });
    });
    document.getElementById('btn-clear').addEventListener('click', clearBets);
    document.getElementById('btn-undo').addEventListener('click', undoBet);
    document.getElementById('btn-spin').addEventListener('click', spinWheel);
}

/* ==========================================================================
   BETTING
   ========================================================================== */
function showToast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.style.color      = isErr ? 'var(--red)' : 'var(--green)';
    toastEl.style.borderColor = isErr ? 'rgba(248,113,113,0.25)' : 'rgba(52,211,153,0.25)';
    toastEl.style.background  = isErr ? 'var(--red-bg)' : 'var(--green-bg)';
    toastEl.classList.add('show');
    clearTimeout(state._toast);
    state._toast = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

async function placeBet(cell) {
    if (state.spinning) return;
    const amt = state.currentChip;
    if (typeof hasEnoughBalance === 'function' && !(await hasEnoughBalance(amt))) {
        showToast('Nicht genügend Guthaben!', true);
        return;
    }
    if (typeof deductFromBalance === 'function') {
        if (!(await deductFromBalance(amt))) return;
    }
    state.bets.push({ type: cell.dataset.bet, amount: amt, cell });
    state.totalBet += amt;
    renderChip(cell);
    updateUI();
}

function renderChip(cell) {
    const total = state.bets.filter(b => b.cell === cell).reduce((s, b) => s + b.amount, 0);
    const old = cell.querySelector('.chip-placed');
    if (old) old.remove();
    if (total <= 0) return;

    let label = total >= 1000 ? (total / 1000).toFixed(1) + 'k' : total;
    let cls = 'chip-color-1';
    if (total >= 500) cls = 'chip-color-500';
    else if (total >= 100) cls = 'chip-color-100';
    else if (total >= 25) cls = 'chip-color-25';
    else if (total >= 10) cls = 'chip-color-10';
    else if (total >= 5) cls = 'chip-color-5';

    const el = document.createElement('div');
    el.className = 'chip-placed ' + cls;
    el.textContent = label;
    cell.appendChild(el);
}

async function clearBets() {
    if (state.spinning || !state.bets.length) return;
    if (typeof addToBalance === 'function') await addToBalance(state.totalBet);
    state.bets = [];
    state.totalBet = 0;
    document.querySelectorAll('.chip-placed').forEach(e => e.remove());
    updateUI();
    showToast('Einsätze gelöscht');
}

async function undoBet() {
    if (state.spinning || !state.bets.length) return;
    const last = state.bets.pop();
    state.totalBet -= last.amount;
    if (typeof addToBalance === 'function') await addToBalance(last.amount);
    renderChip(last.cell);
    updateUI();
}

/* ==========================================================================
   SPIN — Canvas rotation + ball animation
   ========================================================================== */
function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

function spinWheel() {
    if (state.spinning) return;
    if (!state.bets.length) { showToast('Bitte platziere einen Einsatz!'); return; }

    state.spinning = true;
    document.getElementById('btn-spin').disabled = true;
    showToast('Nichts geht mehr!');

    stats.games++;
    stats.lost += state.totalBet;
    saveStats();

    const winIdx = Math.floor(Math.random() * SEGMENTS);
    const winNum = WHEEL_NUMBERS[winIdx];

    // Target angle: bring winning segment under top pointer
    const fullSpins = 5 * 360;
    const segTarget = -(winIdx * SEG_DEG);
    const targetAngle = state.wheelAngle + fullSpins + segTarget - (state.wheelAngle % 360);

    // Ball params
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const ballR = (canvas.width / 2) - 24;   // on the outer track
    const ballRInner = (canvas.width / 2) - 50;

    ballEl.style.display = 'block';
    displayNum.textContent = '···';
    displayNum.style.color = 'var(--text-dim)';

    const duration = 4200;
    const t0 = performance.now();
    const startAngle = state.wheelAngle;

    function frame(now) {
        let f = Math.min((now - t0) / duration, 1);
        let e = easeOutQuart(f);

        // Wheel
        const currentAngle = startAngle + (targetAngle - startAngle) * e;
        drawWheel(currentAngle);

        // Ball — spins opposite, faster, then drops in
        const ballSpins = -(targetAngle * 1.8);
        const ballAngleDeg = ballSpins * e;
        const ballAngleRad = (ballAngleDeg - 90) * Math.PI / 180;

        // Gradually move ball inward after 75%
        let r = ballR;
        if (f > 0.75) {
            const drop = (f - 0.75) / 0.25;          // 0→1
            r = ballR - (ballR - ballRInner) * drop;
        }

        const bx = cx + Math.cos(ballAngleRad) * r;
        const by = cy + Math.sin(ballAngleRad) * r;
        ballEl.style.left = bx + 'px';
        ballEl.style.top  = by + 'px';

        if (f < 1) {
            requestAnimationFrame(frame);
        } else {
            state.wheelAngle = targetAngle % 360;
            finishSpin(winNum);
        }
    }
    requestAnimationFrame(frame);
}

async function finishSpin(winNum) {
    state.spinning = false;
    document.getElementById('btn-spin').disabled = false;

    const col = getColor(winNum);
    displayNum.textContent = winNum;
    displayNum.style.color = col === 'red' ? 'var(--red)' : (col === 'green' ? 'var(--green)' : 'var(--text)');

    // Payouts
    let won = 0;
    const sums = {};
    for (const b of state.bets) sums[b.type] = (sums[b.type] || 0) + b.amount;

    for (const [type, amt] of Object.entries(sums)) {
        if (checkWin(type, winNum)) {
            won += amt + amt * getMultiplier(type);
        }
    }

    if (won > 0) {
        showToast('Gewonnen: ' + won + ' €');
        stats.won += won;
        saveStats();
        if (typeof addToBalance === 'function') await addToBalance(won);
    } else {
        showToast('Nix gewonnen!', true);
    }

    // History
    state.history.unshift(winNum);
    if (state.history.length > 12) state.history.pop();
    renderHistory();

    // Clear bets visually
    state.bets = [];
    state.totalBet = 0;
    document.querySelectorAll('.chip-placed').forEach(e => e.remove());

    // Reset center display after a pause
    setTimeout(() => {
        ballEl.style.display = 'none';
        displayNum.textContent = '?';
        displayNum.style.color = 'var(--text)';
    }, 3500);

    updateUI();
}

/* ---------- Win logic ---------- */
function checkWin(type, n) {
    if (type.startsWith('num-')) return parseInt(type.split('-')[1]) === n;
    if (n === 0) return false;
    if (type === 'red')     return RED_NUMBERS.includes(n);
    if (type === 'black')   return !RED_NUMBERS.includes(n);
    if (type === 'even')    return n % 2 === 0;
    if (type === 'odd')     return n % 2 !== 0;
    if (type === 'low')     return n >= 1 && n <= 18;
    if (type === 'high')    return n >= 19 && n <= 36;
    if (type === 'dozen-1') return n >= 1  && n <= 12;
    if (type === 'dozen-2') return n >= 13 && n <= 24;
    if (type === 'dozen-3') return n >= 25 && n <= 36;
    if (type === 'col-1')   return n % 3 === 1;
    if (type === 'col-2')   return n % 3 === 2;
    if (type === 'col-3')   return n % 3 === 0;
    return false;
}

function getMultiplier(type) {
    if (type.startsWith('num-')) return 35;
    if (type.startsWith('col-') || type.startsWith('dozen-')) return 2;
    return 1;
}

/* ---------- History ---------- */
function renderHistory() {
    histList.innerHTML = '';
    for (const n of state.history) {
        const el = document.createElement('div');
        el.className = 'hist-num ' + getColor(n);
        el.textContent = n;
        histList.appendChild(el);
    }
}

/* ---------- UI ---------- */
function updateUI() {
    document.getElementById('current-bet').textContent = state.totalBet;
    if (typeof getBalanceSync === 'function') {
        document.querySelectorAll('.balance-display').forEach(el => {
            el.textContent = Math.round(getBalanceSync());
        });
    }
}

if (typeof onBalanceChange === 'function') {
    onBalanceChange(() => updateUI());
}

init();
