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
        
        // 1. Direct ID updates (highest priority)
        const priorityIds = ['balance', 'balance-amount', 'stats-balance', 'user-balance', 'balance-value'];
        priorityIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName === 'INPUT') el.value = rounded;
                else el.textContent = rounded;
            }
        });

        // 2. Class updates (only if they don't have one of the priority IDs themselves)
        document.querySelectorAll('.balance-value, .balance-amount, .balance-num, .stat-val').forEach(el => {
            if (priorityIds.includes(el.id)) return;
            if (el.tagName === 'INPUT') el.value = rounded;
            else el.textContent = rounded;
        });

        // 3. Container updates (preserving structure)
        document.querySelectorAll('.balance, .balance-display, .wallet-amount, .balance-container, .score-item').forEach(el => {
            // Avoid containers that are themselves a priority item
            if (priorityIds.includes(el.id)) return;

            // Check if there's a specific nested element meant for the value
            const nestedValue = el.querySelector('#balance, .balance-value, #balance-amount, .balance-amount, #stats-balance, .stat-val, .score-value');
            if (nestedValue) {
                nestedValue.textContent = rounded;
                return;
            }

            // Fallback: Label preservation
            let text = el.textContent;
            if (text.includes('Balance:') || text.includes('Balance :')) {
                el.textContent = `Balance: ${rounded}`;
            } else if (text.includes('Guthaben:') || text.includes('Guthaben :')) {
                el.textContent = `Guthaben: ${rounded}`;
            } else if (text.includes('Kontostand:') || text.includes('Kontostand :')) {
                el.textContent = `Kontostand: ${rounded}`;
            } else if (text.includes('€') || text.includes('$')) {
                const symbol = text.includes('€') ? '€' : '$';
                // Only replace if the element doesn't have many children (to avoid breaking complex layouts)
                if (el.children.length <= 1) {
                    el.textContent = `${symbol}${rounded}`;
                }
            } else if (el.classList.contains('balance-display') || el.classList.contains('balance')) {
                // Last resort for designated balance elements
                if (el.children.length === 0) el.textContent = rounded;
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
})();
