const STOCKS = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 150.00, volatility: 0.03 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 120.00, volatility: 0.03 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: 300.00, volatility: 0.025 },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 250.00, volatility: 0.07 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 130.00, volatility: 0.04 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 450.00, volatility: 0.06 },
    { symbol: 'META', name: 'Meta Platforms', price: 330.00, volatility: 0.045 },
    { symbol: 'NFLX', name: 'Netflix Inc.', price: 480.00, volatility: 0.05 },
    { symbol: 'SPY', name: 'S&P 500', price: 400.00, volatility: 0.015 },
    { symbol: 'QQQ', name: 'Nasdaq 100', price: 350.00, volatility: 0.018 },
    { symbol: 'VTI', name: 'Total Stock Market', price: 220.00, volatility: 0.012 },
    { symbol: 'VEA', name: 'Developed Markets', price: 45.00, volatility: 0.014 }
];

let currentPhase = 'bull';

setInterval(() => {
    if (Math.random() < 0.02) {
        currentPhase = currentPhase === 'bull' ? 'bear' : 'bull';
    }
    STOCKS.forEach(asset => {
        const volatility = asset.volatility || 0.03;
        let change = (Math.random() + Math.random() + Math.random() - 1.5) * volatility;
        const phaseBias = currentPhase === 'bull' ? 0.002 : -0.002;
        change += phaseBias;
        asset.price *= (1 + change);
        if (asset.price < 1) asset.price = 1 + Math.random();
        if (asset.price > 10000) asset.price = 10000;
    });
}, 3000);

function getPortfolioFromDB(db, userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT portfolio FROM users WHERE id = ?', [userId], (err, row) => {
            if (err) return reject(err);
            try {
                const pf = row && row.portfolio ? JSON.parse(row.portfolio) : { long: {}, short: {} };
                resolve(pf);
            } catch (e) {
                resolve({ long: {}, short: {} });
            }
        });
    });
}

function savePortfolioToDB(db, userId, portfolio) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE users SET portfolio = ? WHERE id = ?', [JSON.stringify(portfolio), userId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function calculateLiquidationPrice(entryPrice, leverage) {
    return entryPrice * (1 + (0.8 / leverage));
}

function setupStocksRoutes(app, db, authenticateToken) {
    app.get('/api/stocks/market', (req, res) => {
        res.json({ success: true, market: STOCKS, phase: currentPhase });
    });

    app.get('/api/stocks/portfolio', authenticateToken, async (req, res) => {
        try {
            const pf = await getPortfolioFromDB(db, req.user.id);
            res.json({ success: true, portfolio: pf });
        } catch (e) {
            res.status(500).json({ error: 'DB error' });
        }
    });

    app.post('/api/stocks/buy', authenticateToken, async (req, res) => {
        const { symbol, quantity } = req.body;
        const asset = STOCKS.find(s => s.symbol === symbol);
        if (!asset || quantity < 1) return res.status(400).json({error: 'Invalid request'});

        const cost = asset.price * quantity;
        
        db.get('SELECT balance, portfolio FROM users WHERE id = ?', [req.user.id], async (err, row) => {
            if (err || !row) return res.status(500).json({error: 'DB error'});
            if (row.balance < cost) return res.status(400).json({error: 'Insufficient balance'});

            try {
                const pf = row.portfolio ? JSON.parse(row.portfolio) : { long: {}, short: {} };
                if (!pf.long) pf.long = {};
                if (!pf.long[symbol]) pf.long[symbol] = { shares: 0, totalInvested: 0 };
                
                pf.long[symbol].shares += quantity;
                pf.long[symbol].totalInvested += cost;

                const newBalance = Math.round(row.balance - cost);
                db.run('UPDATE users SET balance = ?, portfolio = ? WHERE id = ?', 
                    [newBalance, JSON.stringify(pf), req.user.id], 
                    function(err) {
                        if (err) return res.status(500).json({error: 'Update error'});
                        res.json({ success: true, portfolio: pf, balance: newBalance });
                    }
                );
            } catch (e) {
                res.status(500).json({error: 'Server error'});
            }
        });
    });

    app.post('/api/stocks/sell', authenticateToken, (req, res) => {
        const { symbol, quantity } = req.body;
        const asset = STOCKS.find(s => s.symbol === symbol);
        
        db.get('SELECT balance, portfolio FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row) return res.status(500).json({error: 'DB error'});
            
            try {
                const pf = row.portfolio ? JSON.parse(row.portfolio) : { long: {}, short: {} };
                if (!pf.long) pf.long = {};
                
                if (!asset || quantity < 1 || !pf.long[symbol] || pf.long[symbol].shares < quantity) {
                    return res.status(400).json({error: 'Ungültige Verkaufsanfrage (Nicht genug Aktien?)'});
                }

                const revenue = asset.price * quantity;
                const investedPerShare = pf.long[symbol].totalInvested / pf.long[symbol].shares;
                const profit = revenue - (investedPerShare * quantity);

                pf.long[symbol].shares -= quantity;
                pf.long[symbol].totalInvested -= (investedPerShare * quantity);
                if (pf.long[symbol].shares <= 0) delete pf.long[symbol];

                const newBalance = Math.round(row.balance + revenue);
                db.run('UPDATE users SET balance = ?, portfolio = ? WHERE id = ?', 
                    [newBalance, JSON.stringify(pf), req.user.id], 
                    function(err) {
                        if (err) return res.status(500).json({error: 'Update error'});
                        res.json({ success: true, portfolio: pf, balance: newBalance, profit });
                    }
                );
            } catch (e) {
                res.status(500).json({error: 'Server error'});
            }
        });
    });

    app.post('/api/stocks/short', authenticateToken, (req, res) => {
        const { symbol, quantity, leverage } = req.body;
        const asset = STOCKS.find(s => s.symbol === symbol);
        if (!asset || quantity < 1 || leverage < 1 || leverage > 50) return res.status(400).json({error: 'Invalid request'});

        const positionValue = asset.price * quantity;
        const margin = positionValue / leverage;

        db.get('SELECT balance, portfolio FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row) return res.status(500).json({error: 'DB error'});
            if (row.balance < margin) return res.status(400).json({error: 'Insufficient balance'});

            try {
                const pf = row.portfolio ? JSON.parse(row.portfolio) : { long: {}, short: {} };
                if (!pf.short) pf.short = {};
                if (!pf.short[symbol]) pf.short[symbol] = { shares: 0, entryPrice: 0, leverage: leverage, margin: 0 };
                
                const existingValue = pf.short[symbol].shares * pf.short[symbol].entryPrice;
                pf.short[symbol].shares += quantity;
                pf.short[symbol].entryPrice = (existingValue + positionValue) / pf.short[symbol].shares;
                pf.short[symbol].margin += margin;

                const newBalance = Math.round(row.balance - margin);
                db.run('UPDATE users SET balance = ?, portfolio = ? WHERE id = ?', 
                    [newBalance, JSON.stringify(pf), req.user.id], 
                    function(err) {
                        if (err) return res.status(500).json({error: 'Update error'});
                        res.json({ success: true, portfolio: pf, balance: newBalance });
                    }
                );
            } catch (e) {
                res.status(500).json({error: 'Server error'});
            }
        });
    });

    app.post('/api/stocks/cover', authenticateToken, (req, res) => {
        const { symbol, quantity } = req.body;
        const asset = STOCKS.find(s => s.symbol === symbol);
        
        db.get('SELECT balance, portfolio FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row) return res.status(500).json({error: 'DB error'});
            
            try {
                const pf = row.portfolio ? JSON.parse(row.portfolio) : { long: {}, short: {} };
                if (!pf.short || !pf.short[symbol] || pf.short[symbol].shares < quantity) {
                    return res.status(400).json({error: 'Ungültige Cover-Anfrage'});
                }

                const shortData = pf.short[symbol];
                const toCover = quantity;
                const liquidationPrice = calculateLiquidationPrice(shortData.entryPrice, shortData.leverage);

                if (asset.price >= liquidationPrice) {
                    pf.short[symbol].shares -= toCover;
                    if (pf.short[symbol].shares <= 0) delete pf.short[symbol];
                    db.run('UPDATE users SET portfolio = ? WHERE id = ?', [JSON.stringify(pf), req.user.id]);
                    return res.json({ success: true, portfolio: pf, liquidated: true });
                }

                const marginPerShare = shortData.margin / shortData.shares;
                const returnedMargin = marginPerShare * toCover;
                const rawPnl = (shortData.entryPrice - asset.price) * toCover;
                const levPnl = rawPnl * shortData.leverage;
                const totalReturn = returnedMargin + levPnl;
                
                pf.short[symbol].shares -= toCover;
                pf.short[symbol].margin -= returnedMargin;
                if (pf.short[symbol].shares <= 0) delete pf.short[symbol];

                const newBalance = Math.max(0, Math.round(row.balance + totalReturn));
                db.run('UPDATE users SET balance = ?, portfolio = ? WHERE id = ?', 
                    [newBalance, JSON.stringify(pf), req.user.id], 
                    function(err) {
                        if (err) return res.status(500).json({error: 'Update error'});
                        res.json({ success: true, portfolio: pf, balance: newBalance, profit: levPnl });
                    }
                );
            } catch (e) {
                res.status(500).json({error: 'Server error'});
            }
        });
    });
}

module.exports = setupStocksRoutes;
