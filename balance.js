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
                updateAllDisplays(data.balance);
                return data.balance;
            }
        } catch (e) {
            console.error('Reset error:', e);
        }
    }

    function updateAllDisplays(balance) {
        let rounded = Math.round(balance);
        
        // Comprehensive list of IDs used across all game pages
        const ids = ['balance', 'balance-amount', 'stats-balance', 'balance-display', 'user-balance'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (id === 'balance-display' || id === 'user-balance') {
                    el.textContent = `Balance: ${rounded}`;
                } else {
                    el.textContent = rounded;
                }
            }
        });

        // Handle classes
        document.querySelectorAll('.balance-value, .balance-amount, .balance').forEach(el => {
            if (el.tagName === 'INPUT') {
                el.value = rounded;
            } else {
                // If it contains "Balance:", keep the prefix
                if (el.textContent.includes('Balance:')) {
                    el.textContent = `Balance: ${rounded}`;
                } else {
                    el.textContent = rounded;
                }
            }
        });

        // Handle the specific .balance-display class structure
        document.querySelectorAll('.balance-display').forEach(el => {
            const spanValue = el.querySelector('span span') || el.querySelector('span');
            if (spanValue && el.id !== 'balance-amount') {
                spanValue.textContent = rounded;
            } else if (el.id !== 'balance-amount') {
                el.textContent = `Balance: ${rounded}`;
            }
        });
    }

    function getBalanceSync() {
        getBalance(); // triggers async fetch
        const el = document.getElementById('balance-amount') || document.getElementById('balance') || document.getElementById('balance-display');
        if (el) {
            const val = el.textContent.replace(/[^0-9]/g, '');
            return parseInt(val || '0');
        }
        return 0;
    }

    window.getBalance = getBalance;
    window.resetBalance = resetBalance;
    window.getBalanceSync = getBalanceSync;
    window.syncBalance = getBalance;
    window.updateBalanceDisplay = updateAllDisplays;

    // Periodically sync balance (every 5 seconds)
    setInterval(getBalance, 5000);

    window.addEventListener('load', getBalance);
})();
