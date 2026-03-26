(function() {
    'use strict';

    function getToken() {
        return localStorage.getItem('casinoToken');
    }

    async function getBalance() {
        const token = getToken();
        if (!token) return 0;
        
        try {
            const res = await fetch('/api/balance', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                updateAllDisplays(data.balance);
                return data.balance;
            } else if (res.status === 401 || res.status === 403) {
                localStorage.removeItem('casinoToken');
                if (!window.location.pathname.endsWith('index.html')) {
                    window.location.href = 'index.html';
                }
            }
        } catch (e) {
            console.error('Fetch error:', e);
        }
        return 0;
    }

    async function resetBalance() {
        const token = getToken();
        if (!token) return;
        
        try {
            const res = await fetch('/api/reset-balance', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                updateAllDisplays(1000);
                return 1000;
            }
        } catch (e) {
            console.error('Reset error:', e);
        }
    }

    function updateAllDisplays(balance) {
        if (balance === undefined || balance === null) return;
        let rounded = Math.round(balance);
        
        // 1. Target very specific ID sets (priority)
        const priorityIds = ['balance', 'balance-amount', 'stats-balance', 'user-balance', 'balance-value'];
        priorityIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName === 'INPUT') el.value = rounded;
                else el.textContent = rounded;
            }
        });

        // 2. Class updates (only safe classes)
        document.querySelectorAll('.balance-value, .balance-amount, .balance-num, .user-balance-value').forEach(el => {
            // Skip elements that already have one of the priority IDs
            if (priorityIds.includes(el.id)) return;
            if (el.tagName === 'INPUT') el.value = rounded;
            else el.textContent = rounded;
        });

        // 3. Container updates with very specific balance indicators
        document.querySelectorAll('.balance-container, .balance-display').forEach(el => {
            if (priorityIds.includes(el.id)) return;

            // Attempt to find balance child
            const nestedValue = el.querySelector('#balance, .balance-value, #balance-amount, .balance-amount, #stats-balance');
            if (nestedValue) {
                nestedValue.textContent = rounded;
                return;
            }

            // Fallback: Label check (more strict)
            let text = el.textContent;
            if (text.includes('Balance:') || text.includes('Guthaben:') || text.includes('Kontostand:')) {
                // Keep the label, update the number part
                const symbol = text.includes('€') ? '€' : (text.includes('$') ? '$' : '');
                const label = text.split(':')[0] + ':';
                el.textContent = `${label} ${symbol}${rounded}`;
            }
        });
    }

    function getBalanceSync() {
        const els = [
            document.getElementById('balance-amount'),
            document.getElementById('balance'),
            document.getElementById('stats-balance'),
            document.querySelector('.balance-value'),
            document.querySelector('.balance-amount')
        ];
        
        for (const el of els) {
            if (el && el.textContent) {
                let text = el.textContent.replace(/[€$]/g, '').replace(',', '.').trim();
                let match = text.match(/[0-9.]+/);
                if (match) {
                    let val = parseFloat(match[0]);
                    if (!isNaN(val)) return Math.round(val);
                }
            }
        }
        return 0;
    }

    window.getBalance = getBalance;
    window.resetBalance = resetBalance;
    window.getBalanceSync = getBalanceSync;
    window.syncBalance = getBalance;
    window.updateBalanceDisplay = updateAllDisplays;

    setInterval(getBalance, 5000);
    window.addEventListener('load', getBalance);
    setTimeout(getBalance, 100);

    // Immediate sync when tab becomes active
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            getBalance();
        }
    });

    // Handle game-specific balance updates if needed
    window.addEventListener('balanceUpdate', (e) => {
        if (e.detail && typeof e.detail.balance === 'number') {
            updateAllDisplays(e.detail.balance);
        }
    });
})();
