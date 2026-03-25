const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const setupBlackjackRoutes = require('./blackjack');
const setupStocksRoutes = require('./stocks');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'super-secret-casino-key-123';

// Initialize SQLite DB
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database connection error:', err);
    else console.log('Connected to SQLite database.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        balance INTEGER DEFAULT 1000
    )`);
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password_hash, balance) VALUES (?, ?, ?)', [username, hashedPassword, 1000], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ success: true, message: 'User registered successfully' });
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(400).json({ error: 'Invalid username or password' });
        
        const validPassword = await bcrypt.compare(password, row.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid username or password' });
        
        const token = jwt.sign({ id: row.id, username: row.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, balance: row.balance });
    });
});

// --- BALANCE ROUTES ---

app.get('/api/balance', authenticateToken, (req, res) => {
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'User not found' });
        res.json({ balance: row.balance });
    });
});

app.post('/api/reset-balance', authenticateToken, (req, res) => {
    db.run('UPDATE users SET balance = 1000 WHERE id = ?', [req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, balance: 1000 });
    });
});


// --- ROULETTE ROUTES ---
const WHEEL_NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_NUMBERS   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

function checkRouletteWin(type, n) {
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

function getRouletteMultiplier(type) {
    if (type.startsWith('num-')) return 35;
    if (type.startsWith('col-') || type.startsWith('dozen-')) return 2;
    return 1;
}

app.post('/api/roulette/play', authenticateToken, (req, res) => {
    const { bets } = req.body;
    if (!bets || !Array.isArray(bets) || bets.length === 0) return res.status(400).json({ error: 'No bets' });
    
    let totalBet = 0;
    for (let b of bets) totalBet += b.amount;
    
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row) return res.status(500).json({ error: 'DB Error' });
        if (row.balance < totalBet) return res.status(400).json({ error: 'Insufficient balance' });
        
        const winNum = WHEEL_NUMBERS[Math.floor(Math.random() * WHEEL_NUMBERS.length)];
        let won = 0;
        const sums = {};
        for (const b of bets) sums[b.type] = (sums[b.type] || 0) + b.amount;

        for (const [type, amt] of Object.entries(sums)) {
            if (checkRouletteWin(type, winNum)) {
                won += amt + amt * getRouletteMultiplier(type);
            }
        }
        
        const newBalance = Math.round(row.balance - totalBet + won);
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], function(err) {
            res.json({ success: true, winningNumber: winNum, won, newBalance });
        });
    });
});

// --- COINFLIP ROUTES ---
app.post('/api/coinflip/play', authenticateToken, (req, res) => {
    const { bet, side } = req.body;
    if (typeof bet !== 'number' || bet <= 0) return res.status(400).json({error: 'Invalid bet'});
    if (side !== 'heads' && side !== 'tails') return res.status(400).json({error: 'Invalid side'});
    
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB Error'});
        if(row.balance < bet) return res.status(400).json({error: 'Insufficient balance'});
        
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const isWin = (result === side);
        const newBalance = Math.round(row.balance - bet + (isWin ? bet * 2 : 0));
        
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], function() {
            res.json({ success: true, result, isWin, wonAmount: isWin ? bet * 2 : 0, newBalance });
        });
    });
});

// --- DICE ROUTES ---
app.post('/api/dice/play', authenticateToken, (req, res) => {
    const { bet, target, condition } = req.body; // condition is 'over' or 'under'
    if (typeof bet !== 'number' || bet <= 0) return res.status(400).json({error: 'Invalid bet'});
    if (typeof target !== 'number' || target < 1 || target > 99) return res.status(400).json({error: 'Invalid target'});
    
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB Error'});
        if(row.balance < bet) return res.status(400).json({error: 'Insufficient balance'});
        
        const roll = Math.floor(Math.random() * 101); // 0 to 100
        let isWin = false;
        let multiplier = 0;
        
        if (condition === 'under' && roll < target) {
            isWin = true;
            multiplier = 99 / target;
        } else if (condition === 'over' && roll > target) {
            isWin = true;
            multiplier = 99 / (100 - target);
        }
        
        const wonAmount = isWin ? (bet * multiplier) : 0;
        const newBalance = Math.round(row.balance - bet + wonAmount);
        
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], function() {
            res.json({ success: true, roll, isWin, wonAmount, newBalance });
        });
    });
});

// --- BANDIT ROUTES ---
const BANDIT_SYMBOLS = [
    { emoji: '🍒', name: 'cherry', value: 5 },
    { emoji: '🍋', name: 'lemon', value: 10 },
    { emoji: '🍊', name: 'orange', value: 15 },
    { emoji: '🍇', name: 'grapes', value: 25 },
    { emoji: '⭐', name: 'star', value: 50 },
    { emoji: '🔔', name: 'bell', value: 100 },
    { emoji: '💎', name: 'diamond', value: 200 },
    { emoji: '7️⃣', name: 'seven', value: 500 }
];

function getBanditRandomSymbol() {
    const weights = [30, 25, 20, 15, 10, 8, 5, 2];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) return BANDIT_SYMBOLS[i];
    }
    return BANDIT_SYMBOLS[0];
}

function getBanditWinningSymbol() {
    const roll = Math.random();
    if (roll < 0.02) return BANDIT_SYMBOLS.find(s => s.name === 'seven');
    else if (roll < 0.05) return BANDIT_SYMBOLS.find(s => s.name === 'diamond');
    else if (roll < 0.12) return BANDIT_SYMBOLS.find(s => s.name === 'bell');
    else if (roll < 0.25) return BANDIT_SYMBOLS.find(s => s.name === 'star');
    else if (roll < 0.45) return BANDIT_SYMBOLS.find(s => s.name === 'grapes');
    else return BANDIT_SYMBOLS[Math.floor(Math.random() * 4)];
}

app.post('/api/bandit/play', authenticateToken, (req, res) => {
    const { bet } = req.body;
    if (typeof bet !== 'number' || bet <= 0) return res.status(400).json({error: 'Invalid bet'});
    
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        if(row.balance < bet) return res.status(400).json({error: 'Insufficient balance'});
        
        const winChance = 0.015;
        const willWin = Math.random() < winChance;
        const symbols = [];
        
        if (willWin) {
            const winSymbol = getBanditWinningSymbol();
            for (let i=0; i<5; i++) symbols.push(winSymbol);
        } else {
            for (let i=0; i<5; i++) symbols.push(getBanditRandomSymbol());
            const counts = {};
            symbols.forEach(s => counts[s.emoji] = (counts[s.emoji] || 0) + 1);
            if (Math.max(...Object.values(counts)) >= 5) {
                const changeIndex = Math.floor(Math.random() * 5);
                let newSymbol = getBanditRandomSymbol();
                while(newSymbol.emoji === symbols[changeIndex].emoji) newSymbol = getBanditRandomSymbol();
                symbols[changeIndex] = newSymbol;
            }
        }
        
        const counts = {};
        symbols.forEach(s => counts[s.emoji] = (counts[s.emoji] || 0) + 1);
        const maxCount = Math.max(...Object.values(counts));
        let multiplier = 0;
        let isJackpot = false;
        let win = false;
        let winningIndices = [];
        
        if (maxCount >= 3) {
            win = true;
            const winningSymbol = symbols.find(s => counts[s.emoji] === maxCount);
            multiplier = winningSymbol.value;
            isJackpot = winningSymbol.name === 'seven';
            if (maxCount === 3) multiplier = Math.floor(multiplier * 0.2);
            else if (maxCount === 4) multiplier = Math.floor(multiplier * 0.4);
            winningIndices = symbols.map((s, i) => s.emoji === winningSymbol.emoji ? i : -1).filter(i => i !== -1);
        }
        
        const wonAmount = win ? bet * multiplier : 0;
        const newBalance = Math.round(row.balance - bet + wonAmount);
        
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            res.json({ success: true, symbols, win, isJackpot, multiplier, wonAmount, winningIndices, newBalance });
        });
    });
});

// --- MINES ROUTES ---
const activeMinesGames = new Map();
const MINES_TOTAL_TILES = 25;

function getMinesMultiplier(minesCount, revealedCount) {
    const totalSafe = MINES_TOTAL_TILES - minesCount;
    let currentMult = 1.0;
    for (let r = 1; r <= revealedCount; r++) {
        const remainingSafe = totalSafe - (r - 1);
        const remainingTotal = MINES_TOTAL_TILES - (r - 1);
        const prob = remainingSafe / remainingTotal;
        currentMult = currentMult * (1 / prob) * 0.99; 
    }
    return Math.round(currentMult * 100) / 100;
}

app.post('/api/mines/start', authenticateToken, (req, res) => {
    const { bet, minesCount } = req.body;
    if (typeof bet !== 'number' || bet <= 0 || typeof minesCount !== 'number' || minesCount < 1 || minesCount > 24) return res.status(400).json({error: 'Invalid input'});
    
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        if(row.balance < bet) return res.status(400).json({error: 'Insufficient balance'});
        
        const newBalance = Math.round(row.balance - bet);
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            const mineIndices = [];
            while(mineIndices.length < minesCount) {
                let r = Math.floor(Math.random() * MINES_TOTAL_TILES);
                if(!mineIndices.includes(r)) mineIndices.push(r);
            }
            
            activeMinesGames.set(req.user.id, {
                bet, minesCount, mineIndices, revealedTiles: []
            });
            
            res.json({ success: true, newBalance });
        });
    });
});

app.post('/api/mines/reveal', authenticateToken, (req, res) => {
    const { index } = req.body;
    const game = activeMinesGames.get(req.user.id);
    if (!game) return res.status(400).json({error: 'No active game'});
    if (index < 0 || index >= MINES_TOTAL_TILES || game.revealedTiles.includes(index)) return res.status(400).json({error: 'Invalid index'});
    
    if (game.mineIndices.includes(index)) {
        // BOOM
        activeMinesGames.delete(req.user.id);
        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
            res.json({ success: true, gameover: true, win: false, mineIndices: game.mineIndices, newBalance: row.balance });
        });
    } else {
        // Safe
        game.revealedTiles.push(index);
        const multiplier = getMinesMultiplier(game.minesCount, game.revealedTiles.length);
        const wonAmount = Math.floor(game.bet * multiplier);
        
        if (game.revealedTiles.length === (MINES_TOTAL_TILES - game.minesCount)) {
            // Auto-cashout
            activeMinesGames.delete(req.user.id);
            db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
                const newBalance = Math.round(row.balance + wonAmount);
                db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
                   res.json({ success: true, gameover: true, win: true, wonAmount, multiplier, mineIndices: game.mineIndices, newBalance }); 
                });
            });
        } else {
            db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
                res.json({ success: true, gameover: false, multiplier, potentialWin: wonAmount, newBalance: row.balance });
            });
        }
    }
});

app.post('/api/mines/cashout', authenticateToken, (req, res) => {
    const game = activeMinesGames.get(req.user.id);
    if (!game || game.revealedTiles.length === 0) return res.status(400).json({error: 'Cannot cashout'});
    
    const multiplier = getMinesMultiplier(game.minesCount, game.revealedTiles.length);
    const wonAmount = Math.floor(game.bet * multiplier);
    activeMinesGames.delete(req.user.id);
    
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        const newBalance = Math.round(row.balance + wonAmount);
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            res.json({ success: true, wonAmount, multiplier, mineIndices: game.mineIndices, newBalance });
        });
    });
});

// --- CRASH ROUTES ---
app.post('/api/crash/play', authenticateToken, (req, res) => {
    const { bet, autoCashout } = req.body;
    if (typeof bet !== 'number' || bet <= 0) return res.status(400).json({error: 'Invalid bet'});
    if (typeof autoCashout !== 'number' || autoCashout < 1.01) return res.status(400).json({error: 'Invalid autoCashout'});
    
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        if(row.balance < bet) return res.status(400).json({error: 'Insufficient balance'});
        
        const r = Math.random();
        let crashPoint = 1 + (-Math.log(1 - r) * 2);
        crashPoint = Math.min(crashPoint, 50);
        crashPoint = Math.max(1.01, crashPoint);
        
        const isWin = crashPoint >= autoCashout;
        const wonAmount = isWin ? Math.floor(bet * autoCashout) : 0;
        const newBalance = Math.round(row.balance - bet + wonAmount);
        
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            res.json({ success: true, crashPoint, isWin, wonAmount, newBalance });
        });
    });
});

// --- PLINKO ROUTES ---
const PLINKO_MULT = {
    8: {
        low: [3.0, 1.2, 0.6, 0.4, 0.4, 0.6, 1.2, 3.0],
        medium: [6.0, 1.8, 0.7, 0.3, 0.3, 0.7, 1.8, 6.0],
        high: [16, 2.5, 0.5, 0.2, 0.2, 0.5, 2.5, 16]
    },
    12: {
        low: [4.0, 1.5, 0.9, 0.6, 0.4, 0.3, 0.3, 0.4, 0.6, 0.9, 1.5, 4.0],
        medium: [9.0, 3.0, 1.3, 0.7, 0.3, 0.2, 0.2, 0.3, 0.7, 1.3, 3.0, 9.0],
        high: [30, 5.0, 1.8, 0.5, 0.2, 0.1, 0.1, 0.2, 0.5, 1.8, 5.0, 30]
    },
    16: {
        low: [5.0, 1.8, 1.1, 0.8, 0.5, 0.4, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5, 0.8, 1.1, 1.8, 5.0],
        medium: [15, 4.0, 1.5, 0.8, 0.4, 0.3, 0.2, 0.1, 0.1, 0.2, 0.3, 0.4, 0.8, 1.5, 4.0, 15],
        high: [50, 9.0, 2.5, 0.7, 0.3, 0.2, 0.1, 0.0, 0.0, 0.1, 0.2, 0.3, 0.7, 2.5, 9.0, 50]
    }
};

function getPlinkoOutcome(rows, risk) {
    let position = 0;
    for (let i = 0; i < rows; i++) {
        if (Math.random() < 0.5) position++;
    }
    return position;
}

app.post('/api/plinko/play', authenticateToken, (req, res) => {
    const { bet, rows, risk } = req.body;
    if (typeof bet !== 'number' || bet <= 0) return res.status(400).json({error: 'Invalid bet'});
    if (![8, 12, 16].includes(rows) || !['low', 'medium', 'high'].includes(risk)) return res.status(400).json({error: 'Invalid settings'});

    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        if(row.balance < bet) return res.status(400).json({error: 'Insufficient balance'});

        const targetIndex = getPlinkoOutcome(rows, risk);
        const multiplier = PLINKO_MULT[rows][risk][targetIndex];
        const wonAmount = Math.floor(bet * multiplier);
        
        const newBalance = Math.round(row.balance - bet + wonAmount);

        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            res.json({ success: true, targetIndex, multiplier, wonAmount, newBalance });
        });
    });
});

app.post('/api/football/play', authenticateToken, (req, res) => {
    const { amount, totalOdds } = req.body;
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({error: 'Invalid amount'});
    if (typeof totalOdds !== 'number' || totalOdds < 1.01) return res.status(400).json({error: 'Invalid odds'});

    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        if(row.balance < amount) return res.status(400).json({error: 'Insufficient balance'});

        // General mathematically enforced odds resolver 
        const winProb = (1 / totalOdds) * 0.94; // 94% RTP
        const isWin = Math.random() < winProb;
        const wonAmount = isWin ? Math.floor(amount * totalOdds) : 0;
        
        const newBalance = Math.round(row.balance - amount + wonAmount);

        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            res.json({ success: true, isWin, wonAmount, newBalance });
        });
    });
});

app.post('/api/horse/play', authenticateToken, (req, res) => {
    const { amount, odds } = req.body;
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({error: 'Invalid amount'});
    if (typeof odds !== 'number' || odds < 1.01) return res.status(400).json({error: 'Invalid odds'});

    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        if(row.balance < amount) return res.status(400).json({error: 'Insufficient balance'});

        // General mathematically enforced odds resolver 
        const winProb = (1 / odds) * 0.94; // 94% RTP
        const isWin = Math.random() < winProb;
        const wonAmount = isWin ? Math.floor(amount * odds) : 0;
        
        const newBalance = Math.round(row.balance - amount + wonAmount);

        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            res.json({ success: true, isWin, wonAmount, newBalance });
        });
    });
});

const activeRoadGames = new Map();

app.post('/api/road/start', authenticateToken, (req, res) => {
    let { amount, stepsCount } = req.body;
    amount = parseFloat(amount);
    stepsCount = parseInt(stepsCount) || 10;
    
    if (isNaN(amount) || amount < 10) return res.status(400).json({error: 'Invalid amount'});
    if (activeRoadGames.has(req.user.id)) return res.status(400).json({error: 'Game already in progress'});

    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        if(row.balance < amount) return res.status(400).json({error: 'Insufficient balance'});

        const newBalance = Math.round(row.balance - amount);

        // Generate crash point
        let crashPoint = stepsCount;
        if (Math.random() < 0.05) {
            crashPoint = stepsCount + 1;
        } else {
            const weights = [];
            for (let i = 1; i <= stepsCount; i++) weights.push(i * i);
            const totalWeight = weights.reduce((a,b) => a+b, 0);
            const random = Math.random() * totalWeight;
            let cumulative = 0;
            for (let i = 0; i < weights.length; i++) {
                cumulative += weights[i];
                if (random < cumulative) {
                    crashPoint = i + 1;
                    break;
                }
            }
        }

        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            activeRoadGames.set(req.user.id, {
                amount,
                stepsCount,
                crashPoint,
                currentStep: 0,
                multiplier: 1.0
            });
            res.json({ success: true, newBalance });
        });
    });
});

app.post('/api/road/step', authenticateToken, (req, res) => {
    const game = activeRoadGames.get(req.user.id);
    if (!game) return res.status(400).json({error: 'No active game'});

    game.currentStep++;
    
    if (game.currentStep >= game.crashPoint) {
        activeRoadGames.delete(req.user.id);
        return res.json({ status: 'crash', crashPoint: game.crashPoint });
    }

    game.multiplier = Math.round((1.0 + (0.05 * game.currentStep)) * 100) / 100;

    res.json({ status: 'safe', currentStep: game.currentStep, multiplier: game.multiplier });
});

app.post('/api/road/cashout', authenticateToken, (req, res) => {
    const game = activeRoadGames.get(req.user.id);
    if (!game) return res.status(400).json({error: 'No active game'});
    if (game.currentStep === 0) return res.status(400).json({error: 'Cannot cashout at step 0'});

    const wonAmount = Math.floor(game.amount * game.multiplier);
    activeRoadGames.delete(req.user.id);

    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        
        const newBalance = Math.round(row.balance + wonAmount);
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            res.json({ status: 'cashed_out', wonAmount, newBalance });
        });
    });
});

const LOTTO_MULTIPLIERS = {
    '6+1': 14000000, '6': 1500000, '5+1': 1000000, '5': 100000,
    '4+1': 10000, '4': 1000, '3+1': 100, '3': 10
};

app.post('/api/lotto/play', authenticateToken, (req, res) => {
    let { amount, selectedNumbers, selectedSuperNumber } = req.body;
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) return res.status(400).json({error: 'Invalid amount'});
    if (!Array.isArray(selectedNumbers) || selectedNumbers.length !== 6) return res.status(400).json({error: 'Invalid numbers'});
    
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        if(row.balance < amount) return res.status(400).json({error: 'Insufficient balance'});

        // Generate winning numbers securely
        const winningNumbers = [];
        while (winningNumbers.length < 6) {
            const num = Math.floor(Math.random() * 49) + 1;
            if (!winningNumbers.includes(num)) winningNumbers.push(num);
        }
        winningNumbers.sort((a, b) => a - b);
        const winningSuper = Math.floor(Math.random() * 10) + 1;

        const mainMatches = selectedNumbers.filter(n => winningNumbers.includes(n)).length;
        const superMatch = selectedSuperNumber === winningSuper;

        let prizeMultiplier = 0;
        if (mainMatches === 6 && superMatch) prizeMultiplier = LOTTO_MULTIPLIERS['6+1'];
        else if (mainMatches === 6) prizeMultiplier = LOTTO_MULTIPLIERS['6'];
        else if (mainMatches === 5 && superMatch) prizeMultiplier = LOTTO_MULTIPLIERS['5+1'];
        else if (mainMatches === 5) prizeMultiplier = LOTTO_MULTIPLIERS['5'];
        else if (mainMatches === 4 && superMatch) prizeMultiplier = LOTTO_MULTIPLIERS['4+1'];
        else if (mainMatches === 4) prizeMultiplier = LOTTO_MULTIPLIERS['4'];
        else if (mainMatches === 3 && superMatch) prizeMultiplier = LOTTO_MULTIPLIERS['3+1'];
        else if (mainMatches === 3) prizeMultiplier = LOTTO_MULTIPLIERS['3'];

        const wonAmount = Math.floor(amount * prizeMultiplier);
        const newBalance = Math.round(row.balance - amount + wonAmount);

        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            res.json({ success: true, winningNumbers, winningSuper, wonAmount, mainMatches, superMatch, newBalance });
        });
    });
});

app.post('/api/shop/buy', authenticateToken, (req, res) => {
    const { itemId, price } = req.body;
    if (!itemId || typeof price !== 'number' || price < 0) return res.status(400).json({error: 'Invalid request'});
    
    db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if(err || !row) return res.status(500).json({error: 'DB error'});
        if(row.balance < price) return res.status(400).json({error: 'Insufficient balance'});
        
        const newBalance = Math.round(row.balance - price);
        db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
            res.json({ success: true, newBalance });
        });
    });
});

setupBlackjackRoutes(app, db, authenticateToken);
setupStocksRoutes(app, db, authenticateToken);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Casino backend running on port ${PORT}`));
