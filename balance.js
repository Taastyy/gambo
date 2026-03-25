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

    function updateAllDisplays(balance) {
        let rounded = Math.round(balance);
        const els = [
            document.getElementById('balance'),
            document.getElementById('balance-amount'),
            document.getElementById('stats-balance')
        ];
        els.forEach(el => {
            if (el) el.textContent = rounded;
        });
        document.querySelectorAll('.balance-value').forEach(el => {
            el.textContent = rounded;
        });
        document.querySelectorAll('.balance-display').forEach(el => {
            let s = el.querySelector('span');
            if(s && el.id !== 'balance-amount') s.textContent = rounded;
            else if(el.id !== 'balance-amount') el.textContent = `Balance: ${rounded}`;
        });
    }



    function getBalanceSync() {
        getBalance(); // triggers async fetch
        const el = document.getElementById('balance-amount') || document.getElementById('balance');
        return parseInt(el?.textContent || '0');
    }

    window.getBalance = getBalance;
    window.getBalanceSync = getBalanceSync;
    window.syncBalance = getBalance;
    window.updateBalanceDisplay = updateAllDisplays;

    // Periodically sync balance (every 5 seconds)
    setInterval(getBalance, 5000);

    window.addEventListener('load', getBalance);
})();
