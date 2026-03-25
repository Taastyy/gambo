/**
 * =====================================================
 * Index/Menu JavaScript
 * =====================================================
 */

(function() {
    'use strict';

    function checkAuth() {
        const token = localStorage.getItem('casinoToken');
        if (token) {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('main-games-grid').style.display = 'grid';
            document.getElementById('user-controls').style.display = 'flex';
            syncBalanceOnLoad();
        } else {
            document.getElementById('auth-section').style.display = 'block';
            document.getElementById('main-games-grid').style.display = 'none';
            document.getElementById('user-controls').style.display = 'none';
        }
    }

    /**
     * Initialize the menu page
     */
    function init() {
        checkAuth();
        
        // Setup reset button
        const resetBtn = document.getElementById('reset-balance-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async function() {
                if (confirm('Möchtest du deine Balance wirklich auf 1000 zurücksetzen?')) {
                    if (typeof window.resetBalance === 'function') {
                        await window.resetBalance();
                        alert('Balance wurde auf 1000 zurückgesetzt!');
                    }
                }
            });
        }
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                localStorage.removeItem('casinoToken');
                checkAuth();
            });
        }

        // Auth Forms
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('login-user').value;
            const p = document.getElementById('login-pass').value;
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: u, password: p})
            });
            const data = await res.json();
            if (data.token) {
                localStorage.setItem('casinoToken', data.token);
                document.getElementById('login-error').textContent = '';
                checkAuth();
            } else {
                document.getElementById('login-error').textContent = data.error || 'Fehler beim Login';
            }
        });

        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('reg-user').value;
            const p = document.getElementById('reg-pass').value;
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: u, password: p})
            });
            const data = await res.json();
            const msgEl = document.getElementById('reg-msg');
            msgEl.textContent = data.success ? 'Erfolgreich! Bitte einloggen.' : (data.error || 'Fehler');
            msgEl.style.color = data.success ? 'green' : 'red';
        });
    }

    /**
     * Sync balance when page loads
     */
    function syncBalanceOnLoad() {
        if (typeof window.getBalance === 'function') {
            window.getBalance();
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
