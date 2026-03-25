const STOCKS = [
    { symbol: 'AAPL', price: 150.00, volatility: 0.03 },
    { symbol: 'GOOGL', price: 120.00, volatility: 0.03 },
    { symbol: 'MSFT', price: 300.00, volatility: 0.025 },
    { symbol: 'TSLA', price: 250.00, volatility: 0.07 },
    { symbol: 'AMZN', price: 130.00, volatility: 0.04 },
    { symbol: 'NVDA', price: 450.00, volatility: 0.06 },
    { symbol: 'META', price: 330.00, volatility: 0.045 },
    { symbol: 'NFLX', price: 480.00, volatility: 0.05 },
    { symbol: 'SPY', price: 400.00, volatility: 0.015 },
    { symbol: 'QQQ', price: 350.00, volatility: 0.018 },
    { symbol: 'VTI', price: 220.00, volatility: 0.012 },
    { symbol: 'VEA', price: 45.00, volatility: 0.014 }
];

let currentPhase = 'bull';

setInterval(() => {
    const isBull = Math.random() > 0.4;
    currentPhase = isBull ? 'bull' : 'bear';
    
    STOCKS.forEach(asset => {
        let trend = isBull ? 0.005 : -0.005;
        let change = (Math.random() * asset.volatility * 2) - asset.volatility + trend;
        
        if (Math.random() < 0.1) {
            change += (Math.random() > 0.5 ? 0.08 : -0.08);
        }
        
        asset.price = asset.price * (1 + change);
        if (asset.price < 5) asset.price = 5;
    });
}, 30000);

const portfolios = new Map();

function getPortfolio(userId) {
    if (!portfolios.has(userId)) {
        portfolios.set(userId, { long: {}, short: {} });
    }
    return portfolios.get(userId);
}

function calculateLiquidationPrice(entryPrice, leverage) {
    return entryPrice * (1 + (0.8 / leverage));
}

function setupStocksRoutes(app, db, authenticateToken) {
    app.get('/api/stocks/market', (req, res) => {
        res.json({ success: true, market: STOCKS, phase: currentPhase });
    });

    app.get('/api/stocks/portfolio', authenticateToken, (req, res) => {
        const pf = getPortfolio(req.user.id);
        res.json({ success: true, portfolio: pf });
    });

    app.post('/api/stocks/buy', authenticateToken, (req, res) => {
        const { symbol, quantity } = req.body;
        const asset = STOCKS.find(s => s.symbol === symbol);
        if (!asset || quantity < 1) return res.status(400).json({error: 'Invalid request'});

        const cost = asset.price * quantity;
        
        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row) return res.status(500).json({error: 'DB error'});
            if (row.balance < cost) return res.status(400).json({error: 'Insufficient balance'});

            const newBalance = Math.round(row.balance - cost);
            db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
                const pf = getPortfolio(req.user.id);
                if (!pf.long[symbol]) pf.long[symbol] = { shares: 0, totalInvested: 0 };
                pf.long[symbol].shares += quantity;
                pf.long[symbol].totalInvested += cost;

                res.json({ success: true, portfolio: pf, balance: newBalance });
            });
        });
    });

    app.post('/api/stocks/sell', authenticateToken, (req, res) => {
        const { symbol, quantity } = req.body;
        const asset = STOCKS.find(s => s.symbol === symbol);
        const pf = getPortfolio(req.user.id);
        
        if (!asset || quantity < 1 || !pf.long[symbol] || pf.long[symbol].shares < quantity) {
            return res.status(400).json({error: 'Invalid request'});
        }

        const toSell = quantity;
        const revenue = asset.price * toSell;
        const investedPerShare = pf.long[symbol].totalInvested / pf.long[symbol].shares;
        
        pf.long[symbol].shares -= toSell;
        pf.long[symbol].totalInvested -= (investedPerShare * toSell);
        if (pf.long[symbol].shares <= 0) delete pf.long[symbol];

        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row) return res.status(500).json({error: 'DB error'});
            
            const newBalance = Math.round(row.balance + revenue);
            db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
                res.json({ success: true, portfolio: pf, balance: newBalance, profit: revenue - (investedPerShare * toSell) });
            });
        });
    });

    app.post('/api/stocks/short', authenticateToken, (req, res) => {
        const { symbol, quantity, leverage } = req.body;
        const asset = STOCKS.find(s => s.symbol === symbol);
        if (!asset || quantity < 1 || leverage < 1 || leverage > 50) return res.status(400).json({error: 'Invalid request'});

        const positionValue = asset.price * quantity;
        const margin = positionValue / leverage;

        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row) return res.status(500).json({error: 'DB error'});
            if (row.balance < margin) return res.status(400).json({error: 'Insufficient balance'});

            const newBalance = Math.round(row.balance - margin);
            db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
                const pf = getPortfolio(req.user.id);
                if (!pf.short[symbol]) pf.short[symbol] = { shares: 0, entryPrice: 0, leverage: leverage, margin: 0 };
                
                // Average entry point if adding to existing short
                const existingValue = pf.short[symbol].shares * pf.short[symbol].entryPrice;
                pf.short[symbol].shares += quantity;
                pf.short[symbol].entryPrice = (existingValue + positionValue) / pf.short[symbol].shares;
                pf.short[symbol].margin += margin;

                res.json({ success: true, portfolio: pf, balance: newBalance });
            });
        });
    });

    app.post('/api/stocks/cover', authenticateToken, (req, res) => {
        const { symbol, quantity } = req.body;
        const asset = STOCKS.find(s => s.symbol === symbol);
        const pf = getPortfolio(req.user.id);
        
        if (!asset || quantity < 1 || !pf.short[symbol] || pf.short[symbol].shares < quantity) {
            return res.status(400).json({error: 'Invalid request'});
        }

        const toCover = quantity;
        const shortData = pf.short[symbol];
        
        const liquidationPrice = calculateLiquidationPrice(shortData.entryPrice, shortData.leverage);
        if (asset.price >= liquidationPrice) {
            // Liquidated! Lose margin
            pf.short[symbol].shares -= toCover;
            const lostMargin = (shortData.margin / shortData.shares) * toCover; // Simplification
            pf.short[symbol].margin -= lostMargin;
            if (pf.short[symbol].shares <= 0) delete pf.short[symbol];
            
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

        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if (err || !row) return res.status(500).json({error: 'DB error'});
            
            const newBalance = Math.max(0, Math.round(row.balance + totalReturn));
            db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
                res.json({ success: true, portfolio: pf, balance: newBalance, profit: levPnl });
            });
        });
    });
}

module.exports = setupStocksRoutes;
