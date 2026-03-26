const express = require('express');
const router = express.Router();

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

const activeMatches = new Map();

function createMatch(home, away) {
    const diff = home.strength - away.strength;
    let pWin = 0.45 + (diff / 100);
    let pDraw = 0.25;
    let pLoss = 0.30 - (diff / 100);
    
    const margin = 1.05;
    const oddsHome = parseFloat((1 / pWin * margin).toFixed(2));
    const oddsDraw = parseFloat((1 / pDraw * margin).toFixed(2));
    const oddsAway = parseFloat((1 / pLoss * margin).toFixed(2));

    const id = Math.random().toString(36).substr(2, 9);
    const match = {
        id,
        home,
        away,
        odds: { '1': oddsHome, 'X': oddsDraw, '2': oddsAway },
        timestamp: Date.now()
    };
    activeMatches.set(id, match);
    return match;
}

function setupFootballRoutes(app, db, authenticateToken) {
    // Get matches
    app.get('/api/football/matches', authenticateToken, (req, res) => {
        if (activeMatches.size === 0) {
            const shuffled = [...TEAMS].sort(() => 0.5 - Math.random());
            for (let i = 0; i < shuffled.length; i += 2) {
                if (shuffled[i] && shuffled[i+1]) {
                    createMatch(shuffled[i], shuffled[i+1]);
                }
            }
        }
        res.json({ success: true, matches: Array.from(activeMatches.values()) });
    });

    // Play/Bet securely
    app.post('/api/football/play', authenticateToken, (req, res) => {
        const { amount, bets } = req.body;
        if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({error: 'Invalid amount'});
        if (!Array.isArray(bets) || bets.length === 0) return res.status(400).json({error: 'Invalid bets'});

        let totalOdds = 1.0;
        for (const b of bets) {
            const match = activeMatches.get(b.matchId);
            if (!match || !match.odds[b.pick]) return res.status(400).json({error: 'Ungültige Match-ID oder Wette!'});
            totalOdds *= match.odds[b.pick];
        }

        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if(err || !row) return res.status(500).json({error: 'DB error'});
            if(row.balance < amount) return res.status(400).json({error: 'Nicht genügend Guthaben!'});

            const winProb = (1 / totalOdds) * 0.94; // 94% RTP
            const isWin = Math.random() < winProb;
            const wonAmount = isWin ? parseFloat((amount * totalOdds).toFixed(2)) : 0;
            
            const newBalance = Math.round(row.balance - amount + wonAmount);

            db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
                res.json({ success: true, isWin, wonAmount, newBalance, totalOdds });
            });
        });
    });
}

module.exports = { setupFootballRoutes, activeMatches };
