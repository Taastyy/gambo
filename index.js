/**
 * =====================================================
 * Index/Menu JavaScript
 * =====================================================
 */

(function() {
    'use strict';

    /**
     * Initialize the menu page
     */
    function init() {
        // Sync balance when page loads
        syncBalanceOnLoad();
        
        // Setup reset button
        const resetBtn = document.getElementById('reset-balance-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (confirm('Möchtest du deine Balance wirklich auf 1000 zurücksetzen?')) {
                    localStorage.setItem('casinoBalance', JSON.stringify({
                        balance: 1000,
                        updatedAt: Date.now()
                    }));
                    syncBalanceOnLoad();
                    var balanceEl = document.getElementById('balance-amount');
                    if (balanceEl) {
                        balanceEl.textContent = '1000';
                    }
                    alert('Balance wurde auf 1000 zurückgesetzt!');
                }
            });
        }
    }

    /**
     * Sync balance when page loads
     */
    function syncBalanceOnLoad() {
        setTimeout(function() {
            if (typeof syncBalance === 'function') {
                syncBalance();
            }
            if (typeof getBalanceSync === 'function') {
                var balance = getBalanceSync();
                var balanceEl = document.getElementById('balance-amount');
                if (balanceEl) {
                    balanceEl.textContent = Math.round(balance).toLocaleString();
                }
            }
        }, 100);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
