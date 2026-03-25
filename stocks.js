// ==========================================================================
// STOCKS SIMULATOR - Stock Trading Game Logic
// ==========================================================================

// Stock data
const STOCKS = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 150.00, basePrice: 150.00, history: [150.00], volatility: 0.03 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 120.00, basePrice: 120.00, history: [120.00], volatility: 0.03 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: 300.00, basePrice: 300.00, history: [300.00], volatility: 0.025 },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 250.00, basePrice: 250.00, history: [250.00], volatility: 0.07 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 130.00, basePrice: 130.00, history: [130.00], volatility: 0.04 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 450.00, basePrice: 450.00, history: [450.00], volatility: 0.06 },
    { symbol: 'META', name: 'Meta Platforms', price: 330.00, basePrice: 330.00, history: [330.00], volatility: 0.045 },
    { symbol: 'NFLX', name: 'Netflix Inc.', price: 480.00, basePrice: 480.00, history: [480.00], volatility: 0.05 }
];

// ETF data
const ETFS = [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', price: 400.00, basePrice: 400.00, history: [400.00], volatility: 0.015 },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 350.00, basePrice: 350.00, history: [350.00], volatility: 0.018 },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', price: 220.00, basePrice: 220.00, history: [220.00], volatility: 0.012 },
    { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', price: 45.00, basePrice: 45.00, history: [45.00], volatility: 0.014 }
];

// News Events
const NEWS_EVENTS = [
    { symbol: 'AAPL', text: '📱 Apple stellt revolutionäres neues iPhone vor!', impact: +0.08 },
    { symbol: 'AAPL', text: '⚠️ Apple verliert wichtigen Patentstreit.', impact: -0.07 },
    { symbol: 'TSLA', text: '🚀 Tesla liefert Rekordanzahl an Fahrzeugen aus!', impact: +0.10 },
    { symbol: 'TSLA', text: '🔥 Tesla-CEO sorgt erneut für Kontroversen.', impact: -0.09 },
    { symbol: 'NVDA', text: '🤖 NVIDIA: KI-Chip-Nachfrage explodiert!', impact: +0.12 },
    { symbol: 'NVDA', text: '📉 NVDA: Exportbeschränkungen belasten Ausblick.', impact: -0.08 },
    { symbol: 'GOOGL', text: '🔍 Google gewinnt KI-Wettrennen laut Analysten.', impact: +0.07 },
    { symbol: 'GOOGL', text: '⚖️ EU leitet Kartellverfahren gegen Google ein.', impact: -0.06 },
    { symbol: 'MSFT', text: '☁️ Microsoft Azure meldet Rekordwachstum.', impact: +0.06 },
    { symbol: 'META', text: '👓 Meta Reality Headset übertrifft Erwartungen.', impact: +0.08 },
    { symbol: 'META', text: '📵 Meta kämpft mit massivem Nutzerrückgang.', impact: -0.07 },
    { symbol: 'AMZN', text: '📦 Amazon Prime Day bricht alle Verkaufsrekorde.', impact: +0.06 },
    { symbol: 'NFLX', text: '🎬 Netflix gewinnt 15 Mio neue Abonnenten in Q3.', impact: +0.09 },
    { symbol: 'NFLX', text: '📺 Netflix verliert Streaming-Rechte an Konkurrenz.', impact: -0.07 },
    { symbol: 'SPY', text: '📊 Fed senkt Zinsen – Markt reagiert positiv!', impact: +0.04 },
    { symbol: 'SPY', text: '🏦 Rezessionsangst: Anleger flüchten aus Aktien.', impact: -0.05 },
    { symbol: 'QQQ', text: '💻 Tech-Sektor boomt – QQQ auf Allzeithoch.', impact: +0.05 },
    { symbol: 'VTI', text: '🇺🇸 US-Wirtschaft wächst stärker als erwartet.', impact: +0.03 },
];

// Game state
let portfolio = {};
let shortPortfolio = {};

let totalProfit = 0;
let countdown = 30;
let countdownInterval;
let skipInterval;
let selectedAssetForBuy = null;
let selectedAssetForSell = null;
let lastNewsTime = 0;

// Market phase state
let currentMarketPhase = 'bull';
let marketPhaseCountdown = 0;

// Statistics
let stats = {
    transactions: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalInvested: 0,
    highestProfit: 0,
    totalProfit: 0
};

// Transaction history
let transactionHistory = [];

// DOM Elements
let stocksGridStocks, stocksGridEtfs, portfolioContainer, historyList, countdownEl, marketIndicator;

// Initialize game
document.addEventListener('DOMContentLoaded', function () {
    initializeElements();
    loadGameData();
    renderStocks();
    renderPortfolio();
    renderShortPortfolio();
    startCountdown();
    updateUI();
});

// Initialize DOM elements
function initializeElements() {
    stocksGridStocks = document.getElementById('stocks-grid-stocks');
    stocksGridEtfs = document.getElementById('stocks-grid-etfs');
    portfolioContainer = document.getElementById('portfolio-container');
    historyList = document.getElementById('history-list');
    countdownEl = document.getElementById('countdown');
    marketIndicator = document.getElementById('market-indicator');

    // Tab switching logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });

    document.getElementById('close-stats-modal').addEventListener('click', closeStatsModal);
    document.getElementById('stats-modal-overlay').addEventListener('click', function (e) {
        if (e.target === this) closeStatsModal();
    });
    document.getElementById('reset-stats-btn').addEventListener('click', resetStats);

    setupModalListeners('buy');
    setupModalListeners('sell');
    setupModalListeners('short');
    setupModalListeners('cover');

    // Skip button
    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', skipCountdown);
        skipBtn.addEventListener('mousedown', startSkipping);
        skipBtn.addEventListener('mouseup', stopSkipping);
        skipBtn.addEventListener('mouseleave', stopSkipping);
        skipBtn.addEventListener('touchstart', function (e) { e.preventDefault(); startSkipping(); });
        skipBtn.addEventListener('touchend', stopSkipping);
    }
}

function setupModalListeners(type) {
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

    document.getElementById(`close-${type}-modal`)?.addEventListener('click', () => window[`close${capitalize(type)}Modal`]());
    document.getElementById(`${type}-modal-overlay`)?.addEventListener('click', function (e) {
        if (e.target === this) window[`close${capitalize(type)}Modal`]();
    });
    document.getElementById(`cancel-${type}-btn`)?.addEventListener('click', () => window[`close${capitalize(type)}Modal`]());
    document.getElementById(`confirm-${type}-btn`)?.addEventListener('click', () => window[`confirm${capitalize(type)}`]());

    const qtyInput = document.getElementById(`${type}-quantity`);
    if (qtyInput) {
        qtyInput.addEventListener('input', () => {
            if (type === 'buy') updateTotalCost();
            if (type === 'sell') updateTotalRevenue();
            if (type === 'short') updateShortRevenue();
            if (type === 'cover') updateCoverCost();
        });
        qtyInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') window[`confirm${capitalize(type)}`]();
        });
    }

    const maxBtn = document.getElementById(`${type}-max-btn`);
    if (maxBtn) {
        maxBtn.addEventListener('click', function () {
            const maxShares = parseInt(document.getElementById(`${type}-max-shares`).textContent) || 0;
            qtyInput.value = maxShares;
            if (type === 'buy') updateTotalCost();
            if (type === 'sell') updateTotalRevenue();
            if (type === 'short') updateShortRevenue();
            if (type === 'cover') updateCoverCost();
        });
    }

    if (type === 'short') {
        const leverageSlider = document.getElementById('short-leverage-slider');
        const leverageInput = document.getElementById('short-leverage');
        if (leverageSlider && leverageInput) {
            leverageSlider.addEventListener('input', function () {
                leverageInput.value = this.value;
                updateShortRevenue();
                updateLeverageRiskIndicator(parseInt(this.value));
            });
            leverageInput.addEventListener('input', function () {
                let val = Math.max(1, Math.min(50, parseInt(this.value) || 1));
                this.value = val;
                leverageSlider.value = val;
                updateShortRevenue();
                updateLeverageRiskIndicator(val);
            });
        }
    }
}

function loadGameData() {
    const savedPortfolio = localStorage.getItem('stocksPortfolio');
    if (savedPortfolio) portfolio = JSON.parse(savedPortfolio);

    const savedStats = localStorage.getItem('stocksStats');
    if (savedStats) {
        stats = JSON.parse(savedStats);
        totalProfit = stats.totalProfit;
    }

    const savedStocks = localStorage.getItem('stocksData');
    if (savedStocks) {
        JSON.parse(savedStocks).forEach(saved => {
            const stock = STOCKS.find(s => s.symbol === saved.symbol);
            if (stock) { stock.price = saved.price; stock.history = saved.history; }
        });
    }

    const savedEtfs = localStorage.getItem('etfsData');
    if (savedEtfs) {
        JSON.parse(savedEtfs).forEach(saved => {
            const etf = ETFS.find(e => e.symbol === saved.symbol);
            if (etf) { etf.price = saved.price; etf.history = saved.history; }
        });
    }

    const savedHistory = localStorage.getItem('transactionHistory');
    if (savedHistory) {
        transactionHistory = JSON.parse(savedHistory);
        if (historyList) {
            historyList.innerHTML = '';
            transactionHistory.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item ' + item.type;
                historyItem.innerHTML = item.html;
                historyList.appendChild(historyItem);
            });
        }
    }

    const savedMarketPhase = localStorage.getItem('marketPhase');
    if (savedMarketPhase) {
        const marketData = JSON.parse(savedMarketPhase);
        currentMarketPhase = marketData.phase;
        marketPhaseCountdown = marketData.countdown;
    }

    const savedShortPortfolio = localStorage.getItem('shortPortfolio');
    if (savedShortPortfolio) shortPortfolio = JSON.parse(savedShortPortfolio);
}

function saveGameData() {
    localStorage.setItem('stocksPortfolio', JSON.stringify(portfolio));
    localStorage.setItem('stocksStats', JSON.stringify(stats));
    localStorage.setItem('stocksData', JSON.stringify(STOCKS));
    localStorage.setItem('etfsData', JSON.stringify(ETFS));
    localStorage.setItem('transactionHistory', JSON.stringify(transactionHistory));
    localStorage.setItem('marketPhase', JSON.stringify({ phase: currentMarketPhase, countdown: marketPhaseCountdown }));
    localStorage.setItem('shortPortfolio', JSON.stringify(shortPortfolio));
}

function renderStocks() {
    if (!stocksGridStocks || !stocksGridEtfs) return;
    stocksGridStocks.innerHTML = '';
    stocksGridEtfs.innerHTML = '';

    STOCKS.forEach(stock => renderAssetCard(stock, 'stock', stocksGridStocks));
    ETFS.forEach(etf => renderAssetCard(etf, 'etf', stocksGridEtfs));

    document.querySelectorAll('.buy-btn').forEach(btn => btn.addEventListener('click', function () { buyStock(this.getAttribute('data-symbol')); }));
    document.querySelectorAll('.sell-btn').forEach(btn => btn.addEventListener('click', function () { sellStock(this.getAttribute('data-symbol')); }));
    document.querySelectorAll('.short-btn').forEach(btn => btn.addEventListener('click', function () { openShortModal(this.getAttribute('data-symbol')); }));
}

function renderAssetCard(asset, type, targetContainer) {
    const card = document.createElement('div');
    card.className = type === 'etf' ? 'stock-card etf-card' : 'stock-card stock-card-interactive';
    const priceChange = calculatePriceChange(asset);
    const changeClass = priceChange >= 0 ? 'positive' : 'negative';
    const changeSymbol = priceChange >= 0 ? '▲ +' : '▼ ';
    const typeLabel = type === 'etf' ? '🏦 ETF' : '📈 Aktie';

    let actionButtons = `
        <button class="stock-btn buy-btn" data-symbol="${asset.symbol}"><span class="btn-icon">🛒</span>BUY</button>
        <button class="stock-btn sell-btn" data-symbol="${asset.symbol}"><span class="btn-icon">📤</span>SELL</button>`;

    if (type === 'stock') {
        actionButtons += `<button class="stock-btn short-btn" data-symbol="${asset.symbol}"><span class="btn-icon">⬇</span>SHORT</button>`;
    }

    card.innerHTML = `
        <div class="stock-header">
            <div class="stock-name">
                <span class="symbol">${asset.symbol}</span>
                <span class="asset-type">${typeLabel}</span>
                <span class="stock-full-name">${asset.name}</span>
            </div>
            <div class="stock-price">$${asset.price.toFixed(2)}</div>
        </div>
        <div class="stock-change ${changeClass}">${changeSymbol}${priceChange.toFixed(2)}%</div>
        <div class="stock-chart">${generateChartSVG(asset.history, priceChange >= 0 ? '#10b981' : '#f43f5e')}</div>
        <div class="stock-actions">${actionButtons}</div>`;

    targetContainer.appendChild(card);
}

function calculatePriceChange(stock) {
    if (stock.history.length < 2) return 0;
    return ((stock.price - stock.history[stock.history.length - 2]) / stock.history[stock.history.length - 2]) * 100;
}

function generateChartSVG(history, color = '#6366f1') {
    if (history.length < 2) return '';
    const chartHistory = history.slice(-60);
    const minPrice = Math.min(...chartHistory);
    const maxPrice = Math.max(...chartHistory);
    const priceRange = maxPrice - minPrice;

    if (priceRange === 0) return `<svg width="100%" height="100%" viewBox="0 0 100 60"><line x1="0" y1="30" x2="100" y2="30" stroke="${color}" stroke-width="2"/></svg>`;

    let pathData = '';
    chartHistory.forEach((price, index) => {
        const x = (index / (chartHistory.length - 1)) * 100;
        const y = 60 - ((price - minPrice) / priceRange) * 60;
        pathData += (index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });

    return `<svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
                        <stop offset="100%" stop-color="${color}" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
                <path d="${pathData} L 100 60 L 0 60 Z" fill="url(#glow)"/>
                <path d="${pathData}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
}

function renderPortfolio() {
    if (!portfolioContainer) return;
    if (Object.keys(portfolio).length === 0) {
        portfolioContainer.innerHTML = '<div class="empty-portfolio">📦 Portfolio ist leer</div>';
        return;
    }

    portfolioContainer.innerHTML = '';
    Object.entries(portfolio).forEach(([symbol, data]) => {
        const asset = STOCKS.find(s => s.symbol === symbol) || ETFS.find(e => e.symbol === symbol);
        if (!asset) return;

        const currentValue = data.shares * asset.price;
        const invested = data.totalInvested;
        const unrealizedPnL = currentValue - invested;
        const unrealizedPct = invested > 0 ? (unrealizedPnL / invested) * 100 : 0;
        const pnlClass = unrealizedPnL >= 0 ? 'pnl-positive' : 'pnl-negative';
        const pnlSign = unrealizedPnL >= 0 ? '+' : '';
        const avgBuyPrice = data.totalInvested / data.shares;

        const item = document.createElement('div');
        item.className = 'portfolio-item';
        item.innerHTML = `
            <div class="portfolio-item-header">
                <div class="portfolio-left">
                    <span class="portfolio-stock">${symbol}</span>
                    <span class="portfolio-type-badge">${asset.volatility ? 'LONG' : 'LONG'}</span>
                </div>
                <div class="portfolio-right">
                    <div class="portfolio-current-value">$${currentValue.toFixed(2)}</div>
                    <div class="portfolio-pnl ${pnlClass}">${pnlSign}$${Math.abs(unrealizedPnL).toFixed(2)} (${pnlSign}${unrealizedPct.toFixed(2)}%)</div>
                </div>
            </div>
            <div class="portfolio-item-details">
                <div class="portfolio-detail-item"><span class="detail-label">STÜCK</span><span class="detail-value">${data.shares}</span></div>
                <div class="portfolio-detail-item"><span class="detail-label">Ø KAUF</span><span class="detail-value">$${avgBuyPrice.toFixed(2)}</span></div>
                <div class="portfolio-detail-item"><span class="detail-label">AKTIE</span><span class="detail-value">$${asset.price.toFixed(2)}</span></div>
            </div>
            <div class="portfolio-item-actions">
                <button class="portfolio-sell-partial-btn" data-symbol="${symbol}">📉 PARTIAL SELL</button>
                <button class="portfolio-sell-all-btn" data-symbol="${symbol}">🔴 SELL ALL</button>
            </div>`;
        portfolioContainer.appendChild(item);
    });

    document.querySelectorAll('.portfolio-sell-partial-btn').forEach(b => b.addEventListener('click', () => sellStock(b.getAttribute('data-symbol'))));
    document.querySelectorAll('.portfolio-sell-all-btn').forEach(b => b.addEventListener('click', () => {
        sellStock(b.getAttribute('data-symbol'));
        setTimeout(() => {
            const q = document.getElementById('sell-quantity');
            if (q) { q.value = q.max; confirmSell(); }
        }, 50);
    }));
}

async function buyStock(symbol) {
    const asset = STOCKS.find(s => s.symbol === symbol) || ETFS.find(e => e.symbol === symbol);
    if (!asset) return;
    selectedAssetForBuy = asset;

    document.getElementById('buy-asset-name').textContent = `${asset.symbol} - ${asset.name}`;
    document.getElementById('buy-asset-price').textContent = `$${asset.price.toFixed(2)}`;

    const bal = typeof getBalanceSync === 'function' ? getBalanceSync() : balance;
    const maxShares = Math.floor(bal / asset.price);
    document.getElementById('buy-max-shares').textContent = maxShares;

    const qty = document.getElementById('buy-quantity');
    qty.value = 1;
    qty.max = maxShares;
    updateTotalCost();

    document.getElementById('buy-modal-overlay').style.display = 'flex';
    document.getElementById('buy-modal').style.display = 'block';
    qty.focus();
}

function updateTotalCost() {
    if (selectedAssetForBuy) {
        document.getElementById('buy-total-cost').textContent = `$${(parseInt(document.getElementById('buy-quantity').value) * selectedAssetForBuy.price || 0).toFixed(2)}`;
    }
}

async function confirmBuy() {
    const qty = parseInt(document.getElementById('buy-quantity').value) || 1;
    if (!selectedAssetForBuy || qty < 1) return closeBuyModal();

    try {
        const token = localStorage.getItem('casinoToken') || '';
        const res = await fetch('/api/stocks/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ symbol: selectedAssetForBuy.symbol, quantity: qty })
        });
        const data = await res.json();
        if (!data.success) { showMessage(data.error || 'Fehler', 'error'); closeBuyModal(); return; }

        portfolio = data.portfolio.long || {};
        shortPortfolio = data.portfolio.short || {};
        stats.transactions++;
        stats.totalInvested += qty * selectedAssetForBuy.price;
        addTransaction('buy', selectedAssetForBuy.symbol, qty, qty * selectedAssetForBuy.price);
        updateBalanceDisplay(data.balance);
        saveGameData(); updateUI(); renderStocks(); renderPortfolio();
        showMessage(`${qty} ${selectedAssetForBuy.symbol} gekauft!`, 'success');
    } catch(e) { showMessage('Netzwerkfehler', 'error'); }
    closeBuyModal();
}

function closeBuyModal() {
    document.getElementById('buy-modal-overlay').style.display = 'none';
    document.getElementById('buy-modal').style.display = 'none';
    selectedAssetForBuy = null;
}

function sellStock(symbol) {
    const asset = STOCKS.find(s => s.symbol === symbol) || ETFS.find(e => e.symbol === symbol);
    if (!asset || !portfolio[symbol] || portfolio[symbol].shares <= 0) return;
    selectedAssetForSell = asset;

    document.getElementById('sell-asset-name').textContent = `${asset.symbol} - ${asset.name}`;
    document.getElementById('sell-asset-price').textContent = `$${asset.price.toFixed(2)}`;
    document.getElementById('sell-max-shares').textContent = portfolio[symbol].shares;

    const qty = document.getElementById('sell-quantity');
    qty.value = 1;
    qty.max = portfolio[symbol].shares;
    updateTotalRevenue();

    document.getElementById('sell-modal-overlay').style.display = 'flex';
    document.getElementById('sell-modal').style.display = 'block';
    qty.focus();
}

function updateTotalRevenue() {
    if (selectedAssetForSell) {
        document.getElementById('sell-total-revenue').textContent = `$${(parseInt(document.getElementById('sell-quantity').value) * selectedAssetForSell.price || 0).toFixed(2)}`;
    }
}

async function confirmSell() {
    const qty = parseInt(document.getElementById('sell-quantity').value) || 1;
    if (!selectedAssetForSell || qty < 1) return closeSellModal();

    const sym = selectedAssetForSell.symbol;
    const toSell = Math.min(qty, (portfolio[sym] && portfolio[sym].shares) || 0);
    if (toSell < 1) { closeSellModal(); return; }

    try {
        const token = localStorage.getItem('casinoToken') || '';
        const res = await fetch('/api/stocks/sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ symbol: sym, quantity: toSell })
        });
        const data = await res.json();
        if (!data.success) { showMessage(data.error || 'Fehler', 'error'); closeSellModal(); return; }

        portfolio = data.portfolio.long || {};
        shortPortfolio = data.portfolio.short || {};
        const profit = data.profit || 0;
        totalProfit += profit; stats.totalProfit += profit;
        if (profit > 0) stats.winningTrades++; else stats.losingTrades++;
        if (profit > stats.highestProfit) stats.highestProfit = profit;
        addTransaction('sell', sym, toSell, toSell * selectedAssetForSell.price);
        updateBalanceDisplay(data.balance);
        saveGameData(); updateUI(); renderStocks(); renderPortfolio();
        showMessage(`${toSell} ${sym} verkauft! ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`, profit >= 0 ? 'success' : 'error');
    } catch(e) { showMessage('Netzwerkfehler', 'error'); }
    closeSellModal();
}

function closeSellModal() {
    document.getElementById('sell-modal-overlay').style.display = 'none';
    document.getElementById('sell-modal').style.display = 'none';
    selectedAssetForSell = null;
}

// Render short portfolio
function renderShortPortfolio() {
    const container = document.getElementById('short-portfolio-container');
    if (!container) return;
    if (Object.keys(shortPortfolio).length === 0) {
        container.innerHTML = '<div class="empty-portfolio">📦 Keine Shorts aktiv</div>';
        return;
    }

    container.innerHTML = '';
    Object.entries(shortPortfolio).forEach(([symbol, data]) => {
        const asset = STOCKS.find(s => s.symbol === symbol);
        if (!asset) return;

        const lev = data.leverage || 1;
        const currentCost = data.shares * asset.price;
        const rawPnl = (data.entryPrice - asset.price) * data.shares;
        const levPnl = rawPnl * lev;
        const margin = data.margin;
        const pnlPct = margin > 0 ? (levPnl / margin) * 100 : 0;
        const liq = data.liquidationPrice || calculateLiquidationPrice(data.entryPrice, lev);
        const isLiq = asset.price >= liq;

        const item = document.createElement('div');
        item.className = 'portfolio-item short-item' + (isLiq ? ' liquidated' : '');
        item.innerHTML = `
            <div class="portfolio-item-header">
                <div class="portfolio-left">
                    <span class="portfolio-stock">${symbol}</span>
                    <span class="portfolio-type-badge short-badge">SHORT</span>
                    <span class="leverage-badge">${lev}x</span>
                </div>
                <div class="portfolio-right">
                    <div class="portfolio-current-value" style="color:${levPnl >= 0 ? 'var(--win-green)' : 'var(--lose-red)'}">
                        ${levPnl >= 0 ? '+' : ''}$${levPnl.toFixed(2)}
                    </div>
                    <div class="portfolio-pnl" style="color:${pnlPct >= 0 ? 'var(--win-green)' : 'var(--lose-red)'}">
                        ${pnlPct >= 0 ? '▲' : '▼'} ${Math.abs(pnlPct).toFixed(2)}%
                    </div>
                </div>
            </div>
            <div class="portfolio-item-details">
                <div class="portfolio-detail-item"><span class="detail-label">STÜCK</span><span class="detail-value">${data.shares}</span></div>
                <div class="portfolio-detail-item"><span class="detail-label">ENTRY</span><span class="detail-value">$${data.entryPrice.toFixed(2)}</span></div>
                <div class="portfolio-detail-item"><span class="detail-label">LIQ.</span><span class="detail-value" style="color:#f43f5e">$${liq.toFixed(2)}</span></div>
            </div>
            ${isLiq ? '<div class="liq-warning">⚠ LIQUIDIERT</div>' : ''}
            <div class="portfolio-item-actions">
                <button class="portfolio-cover-btn" data-symbol="${symbol}" ${isLiq ? 'disabled' : ''}>🔄 COVER PART</button>
                <button class="portfolio-cover-all-btn" data-symbol="${symbol}" ${isLiq ? 'disabled' : ''}>🔴 COVER ALL ($${currentCost.toFixed(2)})</button>
            </div>`;
        container.appendChild(item);
    });

    document.querySelectorAll('.portfolio-cover-btn').forEach(b => b.addEventListener('click', () => openCoverModal(b.getAttribute('data-symbol'))));
    document.querySelectorAll('.portfolio-cover-all-btn').forEach(b => b.addEventListener('click', () => {
        openCoverModal(b.getAttribute('data-symbol'));
        setTimeout(() => {
            const q = document.getElementById('cover-quantity');
            if (q) { q.value = q.max; updateCoverCost(); confirmCover(); }
        }, 50);
    }));
}

function openShortModal(symbol) {
    const asset = STOCKS.find(s => s.symbol === symbol);
    if (!asset) return;
    selectedAssetForShort = asset;

    document.getElementById('short-asset-name').textContent = `${asset.symbol} - ${asset.name}`;
    document.getElementById('short-asset-price').textContent = `$${asset.price.toFixed(2)}`;
    document.getElementById('short-quantity').value = 1;

    updateShortRevenue();

    document.getElementById('short-modal-overlay').style.display = 'flex';
    document.getElementById('short-modal').style.display = 'block';
    document.getElementById('short-quantity').focus();
}

function calculateLiquidationPrice(entry, lev) { return entry * (1 + (0.8 / lev)); }

function updateLeverageRiskIndicator(lev) {
    const ind = document.getElementById('leverage-risk-indicator');
    if (ind) ind.textContent = lev <= 2 ? 'Risiko: Niedrig' : lev <= 5 ? 'Risiko: Mittel' : lev <= 10 ? 'Risiko: Hoch' : 'Risiko: EXTREM';
}

function updateShortRevenue() {
    if (!selectedAssetForShort) return;
    const q = parseInt(document.getElementById('short-quantity').value) || 0;
    const lev = parseInt(document.getElementById('short-leverage').value) || 1;
    const posVal = q * selectedAssetForShort.price;
    const margin = posVal / lev;

    const maxShares = Math.floor(((typeof getBalanceSync === 'function' ? getBalanceSync() : balance) * lev) / selectedAssetForShort.price);
    document.getElementById('short-max-shares').textContent = maxShares;
    document.getElementById('short-quantity').max = maxShares;

    if (document.getElementById('short-total-revenue')) document.getElementById('short-total-revenue').textContent = `$${posVal.toFixed(2)}`;
    if (document.getElementById('short-margin-required')) document.getElementById('short-margin-required').textContent = `$${margin.toFixed(2)}`;
    if (document.getElementById('short-liquidation-price')) document.getElementById('short-liquidation-price').textContent = `$${calculateLiquidationPrice(selectedAssetForShort.price, lev).toFixed(2)}`;
}

async function confirmShort() {
    const q = parseInt(document.getElementById('short-quantity').value) || 1;
    const lev = parseInt(document.getElementById('short-leverage').value) || 1;
    if (!selectedAssetForShort || q < 1) return closeShortModal();

    try {
        const token = localStorage.getItem('casinoToken') || '';
        const res = await fetch('/api/stocks/short', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ symbol: selectedAssetForShort.symbol, quantity: q, leverage: lev })
        });
        const data = await res.json();
        if (!data.success) { showMessage(data.error || 'Fehler', 'error'); closeShortModal(); return; }

        portfolio = data.portfolio.long || {};
        shortPortfolio = data.portfolio.short || {};
        stats.transactions++;
        addTransaction('short', selectedAssetForShort.symbol, q, q * selectedAssetForShort.price, 0, lev);
        updateBalanceDisplay(data.balance);
        saveGameData(); updateUI(); renderStocks(); renderShortPortfolio();
        showMessage(`${q} ${selectedAssetForShort.symbol} SHORT (${lev}x)`, 'success');
    } catch(e) { showMessage('Netzwerkfehler', 'error'); }
    closeShortModal();
}

function closeShortModal() {
    document.getElementById('short-modal-overlay').style.display = 'none';
    document.getElementById('short-modal').style.display = 'none';
    selectedAssetForShort = null;
}

function openCoverModal(symbol) {
    const asset = STOCKS.find(s => s.symbol === symbol);
    if (!asset || !shortPortfolio[symbol]) return;
    selectedAssetForCover = asset;

    document.getElementById('cover-asset-name').textContent = `${asset.symbol}`;
    document.getElementById('cover-position-shares').textContent = shortPortfolio[symbol].shares;
    document.getElementById('cover-entry-price').textContent = `$${shortPortfolio[symbol].entryPrice.toFixed(2)}`;
    document.getElementById('cover-max-shares').textContent = shortPortfolio[symbol].shares;
    document.getElementById('cover-quantity').value = 1;
    document.getElementById('cover-quantity').max = shortPortfolio[symbol].shares;
    updateCoverCost();

    document.getElementById('cover-modal-overlay').style.display = 'flex';
    document.getElementById('cover-modal').style.display = 'block';
}

function updateCoverCost() {
    if (!selectedAssetForCover) return;
    const q = parseInt(document.getElementById('cover-quantity').value) || 0;
    const sym = selectedAssetForCover.symbol;
    const cost = q * selectedAssetForCover.price;
    if (document.getElementById('cover-cost-value')) document.getElementById('cover-cost-value').textContent = `$${cost.toFixed(2)}`;

    if (shortPortfolio[sym] && document.getElementById('cover-pnl-value')) {
        const lev = shortPortfolio[sym].leverage;
        const levPnl = (shortPortfolio[sym].entryPrice - selectedAssetForCover.price) * q * lev;
        document.getElementById('cover-pnl-value').textContent = `${levPnl >= 0 ? '+' : ''}$${levPnl.toFixed(2)} (${lev}x)`;
        document.getElementById('cover-pnl-value').style.color = levPnl >= 0 ? 'var(--win-green)' : 'var(--lose-red)';
    }
}

async function confirmCover() {
    const q = parseInt(document.getElementById('cover-quantity').value) || 1;
    if (!selectedAssetForCover || q < 1) return closeCoverModal();

    const sym = selectedAssetForCover.symbol;
    if (!shortPortfolio[sym]) { closeCoverModal(); return; }
    const toCover = Math.min(q, shortPortfolio[sym].shares);

    try {
        const token = localStorage.getItem('casinoToken') || '';
        const res = await fetch('/api/stocks/cover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ symbol: sym, quantity: toCover })
        });
        const data = await res.json();
        if (!data.success) { showMessage(data.error || 'Fehler', 'error'); closeCoverModal(); return; }

        portfolio = data.portfolio.long || {};
        shortPortfolio = data.portfolio.short || {};
        const profit = data.profit || 0;
        totalProfit += profit; stats.totalProfit += profit;
        if (profit > 0) stats.winningTrades++; else stats.losingTrades++;
        if (profit > stats.highestProfit) stats.highestProfit = profit;
        addTransaction('cover', sym, toCover, toCover * selectedAssetForCover.price, profit);
        if (data.balance !== undefined) updateBalanceDisplay(data.balance);
        saveGameData(); updateUI(); renderStocks(); renderShortPortfolio();
        showMessage(`Covered ${toCover} ${sym}! ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`, profit >= 0 ? 'success' : 'error');
    } catch(e) { showMessage('Netzwerkfehler', 'error'); }
    closeCoverModal();
}

function closeCoverModal() {
    document.getElementById('cover-modal-overlay').style.display = 'none';
    document.getElementById('cover-modal').style.display = 'none';
    selectedAssetForCover = null;
}

async function updateStockPrices() {
    // Fetch prices from server (source of truth)
    try {
        const res = await fetch('/api/stocks/market');
        const data = await res.json();
        if (data.success && data.market) {
            data.market.forEach(serverAsset => {
                const local = STOCKS.find(s => s.symbol === serverAsset.symbol) || ETFS.find(e => e.symbol === serverAsset.symbol);
                if (local) {
                    local.history.push(serverAsset.price);
                    if (local.history.length > 100) local.history.shift();
                    local.price = serverAsset.price;
                }
            });
        }
    } catch(e) { /* offline fallback: keep local prices */ }

    const allAssets = [...STOCKS, ...ETFS];
    const avgChange = allAssets.reduce((sum, a) => sum + calculatePriceChange(a), 0) / allAssets.length;

    if (avgChange > 0.5) { marketIndicator.textContent = 'BULL'; marketIndicator.style.color = 'var(--win-green)'; }
    else if (avgChange < -0.5) { marketIndicator.textContent = 'BEAR'; marketIndicator.style.color = 'var(--lose-red)'; }
    else { marketIndicator.textContent = 'SIDEWAYS'; marketIndicator.style.color = 'var(--primary-gold)'; }

    // Check liquidations client-side for display only (server is source of truth)
    Object.entries(shortPortfolio).forEach(([sym, data]) => {
        const asset = STOCKS.find(s => s.symbol === sym);
        if (asset && data.entryPrice && data.leverage) {
            const liq = calculateLiquidationPrice(data.entryPrice, data.leverage);
            if (asset.price >= liq) {
                showMessage(`⚠ ${sym} LIQUIDIERT!`, 'error');
            }
        }
    });

    // Also sync portfolio from server
    try {
        const token = localStorage.getItem('casinoToken') || '';
        const pfRes = await fetch('/api/stocks/portfolio', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const pfData = await pfRes.json();
        if (pfData.success) {
            portfolio = pfData.portfolio.long || {};
            shortPortfolio = pfData.portfolio.short || {};
        }
    } catch(e) { /* keep local */ }

    saveGameData(); renderStocks(); renderPortfolio(); renderShortPortfolio(); updateUI();
}

function updateBalanceDisplay(newBalance) {
    const balEl = document.getElementById('balance');
    if (balEl) balEl.textContent = Math.round(newBalance).toLocaleString();
    if (typeof window.syncBalance === 'function') setTimeout(window.syncBalance, 100);
}

function showNewsToast(text, sym, imp) {
    let container = document.getElementById('news-toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'news-toast-container'; document.body.appendChild(container); }

    const toast = document.createElement('div');
    toast.className = `news-toast ${imp > 0 ? 'toast-positive' : 'toast-negative'}`;
    toast.innerHTML = `<span class="toast-symbol">${sym}</span><span class="toast-text">${text}</span><span class="toast-impact">${imp > 0 ? '▲' : '▼'} ${(Math.abs(imp * 100)).toFixed(0)}%</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => { toast.classList.remove('toast-visible'); setTimeout(() => toast.remove(), 500); }, 4000);
}

function startCountdown() {
    countdownInterval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        const b = document.getElementById('countdown-bar');
        if (b) b.style.width = `${(countdown / 30) * 100}%`;

        if (countdown <= 10) countdownEl.style.color = 'var(--lose-red)';
        else countdownEl.style.color = 'var(--text-secondary)';

        if (countdown <= 0) {
            updateStockPrices();
            countdown = 30;
            if (b) b.style.width = '100%';
        }
    }, 1000);
}

function skipCountdown() { countdown = 0; updateStockPrices(); countdown = 30; countdownEl.textContent = 30; if (document.getElementById('countdown-bar')) document.getElementById('countdown-bar').style.width = '100%'; }
function startSkipping() { if (!skipInterval) skipInterval = setInterval(skipCountdown, 100); }
function stopSkipping() { clearInterval(skipInterval); skipInterval = null; }

function addTransaction(type, sym, shares, amt, profit = 0, lev = 1) {
    if (!historyList) return;
    const item = document.createElement('div');
    item.className = `history-item ${type}`;
    const tLabel = type === 'buy' ? 'Kauf' : type === 'sell' ? 'Verkauf' : type === 'short' ? 'Short' : type === 'cover' ? 'Cover' : '⚠ LIQ';
    const sign = (type === 'buy' || type === 'liquidation') ? '-' : '+';

    item.innerHTML = `
        <div class="history-details">
            <div class="history-stock">${sym}</div>
            <div class="history-info">${tLabel} ${shares} Stk. ${lev > 1 ? `(${lev}x)` : ''}</div>
        </div>
        <div class="history-amount">${sign}$${amt.toFixed(2)}</div>
    `;
    historyList.insertBefore(item, historyList.firstChild);
    transactionHistory.unshift({ type, symbol: sym, shares, amount: amt, profit, leverage: lev, html: item.innerHTML });
    if (transactionHistory.length > 20) transactionHistory.pop();
}

function updateUI() {
    let portVal = 0, unrl = 0;
    Object.entries(portfolio).forEach(([sym, data]) => {
        const a = STOCKS.find(s => s.symbol === sym) || ETFS.find(e => e.symbol === sym);
        if (a) { portVal += data.shares * a.price; unrl += (data.shares * a.price) - data.totalInvested; }
    });
    const pv = document.getElementById('portfolio-value'); if (pv) pv.textContent = `$` + portVal.toFixed(2);
    const tp = document.getElementById('total-profit'); if (tp) { tp.textContent = `${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`; tp.style.color = totalProfit >= 0 ? 'var(--win-green)' : 'var(--lose-red)'; }
    const ur = document.getElementById('unrealized-profit'); if (ur) { ur.textContent = `${unrl >= 0 ? '+' : ''}$${unrl.toFixed(2)}`; ur.style.color = unrl >= 0 ? 'var(--win-green)' : 'var(--lose-red)'; }
    if (typeof syncBalance === 'function') syncBalance();
}

function showMessage(msg, type) {
    const el = document.getElementById('game-message');
    if (!el) return;
    el.textContent = msg; el.className = `game-message ${type} show`;
    setTimeout(() => { if (el.textContent === msg) el.className = 'game-message'; }, 3000);
}

function showStatsModal() {
    document.getElementById('stats-transactions').textContent = stats.transactions;
    document.getElementById('stats-winning-trades').textContent = stats.winningTrades;
    document.getElementById('stats-losing-trades').textContent = stats.losingTrades;
    document.getElementById('stats-total-invested').textContent = '$' + stats.totalInvested.toFixed(2);
    document.getElementById('stats-highest-profit').textContent = '$' + stats.highestProfit.toFixed(2);
    document.getElementById('stats-total-profit').textContent = (stats.totalProfit >= 0 ? '+' : '') + '$' + stats.totalProfit.toFixed(2);
    if (typeof getBalanceSync === 'function') document.getElementById('stats-balance').textContent = '$' + getBalanceSync().toFixed(2);
    document.getElementById('stats-modal-overlay').style.display = 'flex';
    document.getElementById('stats-modal').style.display = 'block';
}

function closeStatsModal() { document.getElementById('stats-modal-overlay').style.display = 'none'; document.getElementById('stats-modal').style.display = 'none'; }
function resetStats() {
    stats = { transactions: 0, winningTrades: 0, losingTrades: 0, totalInvested: 0, highestProfit: 0, totalProfit: 0 };
    portfolio = {}; shortPortfolio = {}; totalProfit = 0; transactionHistory = [];
    if (historyList) historyList.innerHTML = '';
    saveGameData(); updateUI(); renderPortfolio(); renderStocks(); renderShortPortfolio();
    showMessage('Stats Reset!', 'success');
}
function resetGame() { if (typeof resetBalance === 'function') resetBalance().then(resetStats); else resetStats(); }

// Sync market prices from server
async function syncMarketFromServer() {
    try {
        const res = await fetch('/api/stocks/market');
        const data = await res.json();
        if (data.success && data.market) {
            data.market.forEach(serverAsset => {
                const combined = [...STOCKS, ...ETFS];
                const localAsset = combined.find(s => s.symbol === serverAsset.symbol);
                if (localAsset) {
                    localAsset.price = serverAsset.price;
                    if (!localAsset.history) localAsset.history = [];
                    localAsset.history.push(serverAsset.price);
                    if (localAsset.history.length > 20) localAsset.history.shift();
                }
            });
            renderStocks();
            updateUI();
        }
    } catch (e) { console.error('Market sync error:', e); }
}

setInterval(syncMarketFromServer, 30000);
setTimeout(syncMarketFromServer, 1000);

// Expose functions to window
Object.assign(window, { buyStock, sellStock, showStatsModal, resetGame, updateTotalCost, updateTotalRevenue, confirmSell, openShortModal, confirmShort, closeShortModal, updateShortRevenue, updateLeverageRiskIndicator, calculateLiquidationPrice, openCoverModal, confirmCover, closeCoverModal, updateCoverCost, renderShortPortfolio, closeBuyModal, closeSellModal, confirmBuy, syncMarketFromServer });
