/**
 * =====================================================
 * Casino Balance Manager
 * 
 * A unified, reliable balance system for all casino games.
 * Uses localStorage for persistence with event-based updates.
 * 
 * Features:
 * - Simple localStorage-based storage
 * - Event-driven balance updates (Pub/Sub pattern)
 * - Automatic synchronization across all game pages
 * - Works with file:// protocol
 * - Fast and reliable
 * 
 * Required balance display elements:
 * - balance
 * - balance-display
 * - stats-balance
 * 
 * Usage:
 * - getBalance() - async get current balance
 * - getBalanceSync() - sync cached balance (faster)
 * - addToBalance(amount) - add to balance
 * - deductFromBalance(amount) - deduct from balance (returns success)
 * - setBalance(amount) - set specific balance
 * - onBalanceChange(callback) - listen for changes
 * =====================================================
 */

(function() {
    'use strict';

    // =====================================================
    // CONSTANTS
    // =====================================================

    const DEFAULT_BALANCE = 1000;
    const STORAGE_KEY = 'casinoBalance';
    const CACHE_KEY = 'casinoBalanceCache';

    // =====================================================
    // STATE
    // =====================================================

    let cachedBalance = DEFAULT_BALANCE;
    let balanceListeners = [];
    let isInitialized = false;

    // =====================================================
    // STORAGE FUNCTIONS
    // =====================================================

    /**
     * Gets balance from localStorage
     */
    function getBalanceFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored !== null) {
                const data = JSON.parse(stored);
                return typeof data.balance === 'number' ? Math.max(0, data.balance) : DEFAULT_BALANCE;
            }
        } catch (e) {
            console.error('Error reading balance from storage:', e);
        }
        return DEFAULT_BALANCE;
    }

    /**
     * Saves balance to localStorage
     */
    function saveBalanceToStorage(amount) {
        try {
            const data = {
                balance: Math.max(0, amount),
                updatedAt: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            
            // Also update cache
            cachedBalance = Math.max(0, amount);
            return true;
        } catch (e) {
            console.error('Error saving balance to storage:', e);
            return false;
        }
    }

    /**
     * Initializes the cache from storage
     */
    function initializeCache() {
        try {
            const stored = localStorage.getItem(CACHE_KEY);
            if (stored !== null) {
                const data = JSON.parse(stored);
                cachedBalance = typeof data.balance === 'number' ? Math.max(0, data.balance) : DEFAULT_BALANCE;
            } else {
                cachedBalance = getBalanceFromStorage();
            }
        } catch (e) {
            cachedBalance = DEFAULT_BALANCE;
        }
    }

    // =====================================================
    // PUBLIC API FUNCTIONS
    // =====================================================

    /**
     * Gets the current balance asynchronously
     * @returns {Promise<number>}
     */
    async function getBalance() {
        const balance = getBalanceFromStorage();
        cachedBalance = balance;
        updateAllDisplays();
        return balance;
    }

    /**
     * Gets the cached balance (synchronous, may be slightly stale)
     * This is faster and should be used for UI updates
     * @returns {number}
     */
    function getBalanceSync() {
        if (!isInitialized) {
            initializeCache();
            isInitialized = true;
        }
        return cachedBalance;
    }

    let updateQueue = Promise.resolve();

    /**
     * Internal function to execute balance updates sequentially
     */
    async function queueUpdate(updateFn) {
        updateQueue = updateQueue.then(async () => {
            const currentBalance = getBalanceFromStorage();
            const result = await updateFn(currentBalance);
            if (result !== undefined) {
                saveBalanceToStorage(result);
                cachedBalance = result;
                updateAllDisplays();
                notifyListeners(result);
            }
        }).catch(err => {
            console.error('Balance update failed:', err);
        });
        return updateQueue;
    }

    /**
     * Adds an amount to the player's balance
     * @param {number} amount
     * @returns {Promise<number>} The new balance
     */
    async function addToBalance(amount) {
        let newBalance;
        await queueUpdate((current) => {
            newBalance = current + amount;
            console.log(`Added ${amount}. New balance: ${newBalance}`);
            return newBalance;
        });
        return newBalance;
    }

    /**
     * Deducts an amount from the player's balance
     * @param {number} amount
     * @returns {Promise<boolean>} True if successful, false if insufficient balance
     */
    async function deductFromBalance(amount) {
        let success = false;
        await queueUpdate((current) => {
            if (current >= amount) {
                const newBalance = current - amount;
                success = true;
                console.log(`Deducted ${amount}. New balance: ${newBalance}`);
                return newBalance;
            }
            console.warn(`Insufficient balance: ${current} < ${amount}`);
            return undefined; // No update
        });
        return success;
    }

    /**
     * Sets the balance to a specific amount
     * @param {number} amount
     * @returns {Promise<number>} The new balance
     */
    async function setBalance(amount) {
        const newBalance = Math.max(0, amount);
        
        if (saveBalanceToStorage(newBalance)) {
            cachedBalance = newBalance;
            updateAllDisplays();
            notifyListeners(newBalance);
            console.log(`Balance set to: ${newBalance}`);
            return newBalance;
        }
        
        return cachedBalance;
    }

    /**
     * Checks if the player has enough balance for a bet
     * @param {number} amount
     * @returns {Promise<boolean>}
     */
    async function hasEnoughBalance(amount) {
        const balance = getBalanceFromStorage();
        return balance >= amount;
    }

    /**
     * Resets the balance to default value
     * @returns {Promise<number>}
     */
    async function resetBalance() {
        return await setBalance(DEFAULT_BALANCE);
    }

    // =====================================================
    // EVENT SYSTEM (Pub/Sub)
    // =====================================================

    /**
     * Registers a callback to be called when balance changes
     * @param {Function} callback - Function receiving (newBalance, oldBalance)
     * @returns {Function} Unsubscribe function
     */
    function onBalanceChange(callback) {
        if (typeof callback === 'function') {
            balanceListeners.push(callback);
            
            // Return unsubscribe function
            return function unsubscribe() {
                const index = balanceListeners.indexOf(callback);
                if (index > -1) {
                    balanceListeners.splice(index, 1);
                }
            };
        }
        return function() {};
    }

    /**
     * Notifies all listeners of a balance change
     */
    function notifyListeners(newBalance) {
        const oldBalance = cachedBalance;
        balanceListeners.forEach(callback => {
            try {
                callback(newBalance, oldBalance);
            } catch (e) {
                console.error('Error in balance listener:', e);
            }
        });
    }

    // =====================================================
    // DISPLAY UPDATES
    // =====================================================

    /**
     * Updates all balance display elements on the page
     */
    function updateAllDisplays() {
        const roundedBalance = Math.round(cachedBalance);
        
        // Update balance element
        const balanceEl = document.getElementById('balance');
        if (balanceEl) {
            balanceEl.textContent = roundedBalance;
        }
        
        // Update balance-display element
        const balanceDisplayEl = document.getElementById('balance-display');
        if (balanceDisplayEl) {
            balanceDisplayEl.textContent = `Balance: ${roundedBalance}`;
        }
        
        // Update stats-balance element
        const statsBalanceEl = document.getElementById('stats-balance');
        if (statsBalanceEl) {
            statsBalanceEl.textContent = roundedBalance;
        }
        
        // Update all elements with balance-value class
        document.querySelectorAll('.balance-value').forEach(el => {
            el.textContent = roundedBalance;
        });
        
        // Update all elements with balance-display class
        document.querySelectorAll('.balance-display').forEach(el => {
            el.textContent = `Balance: ${roundedBalance}`;
        });
    }

    /**
     * Syncs balance with storage and updates displays
     */
    async function syncBalance() {
        const balance = await getBalance();
        cachedBalance = balance;
        updateAllDisplays();
        return balance;
    }

    /**
     * Forces an immediate UI update with cached balance
     */
    function refreshDisplay() {
        updateAllDisplays();
    }

    // =====================================================
    // STORAGE EVENT LISTENER (Cross-tab sync)
    // =====================================================

    /**
     * Listens for storage changes from other tabs/windows
     */
    function setupStorageListener() {
        window.addEventListener('storage', function(e) {
            if (e.key === STORAGE_KEY && e.newValue) {
                try {
                    const data = JSON.parse(e.newValue);
                    if (typeof data.balance === 'number') {
                        cachedBalance = Math.max(0, data.balance);
                        updateAllDisplays();
                        console.log('Balance updated from another tab:', cachedBalance);
                    }
                } catch (err) {
                    console.error('Error parsing storage event:', err);
                }
            }
        });
    }

    // =====================================================
    // EXPORT TO WINDOW
    // =====================================================

    // Core functions
    window.getBalance = getBalance;
    window.getBalanceSync = getBalanceSync;
    window.addToBalance = addToBalance;
    window.deductFromBalance = deductFromBalance;
    window.setBalance = setBalance;
    window.hasEnoughBalance = hasEnoughBalance;
    window.resetBalance = resetBalance;
    
    // Sync and display functions
    window.syncBalance = syncBalance;
    window.refreshBalanceDisplay = refreshDisplay;
    window.updateBalanceDisplay = updateAllDisplays;
    
    // Event system
    window.onBalanceChange = onBalanceChange;

    // =====================================================
    // INITIALIZATION
    // =====================================================

    /**
     * Initializes the balance system
     */
    function initialize() {
        initializeCache();
        setupStorageListener();
        isInitialized = true;
        
        // Initial display update
        setTimeout(updateAllDisplays, 10);
        
        // Listen for DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(updateAllDisplays, 50);
            });
        } else {
            setTimeout(updateAllDisplays, 50);
        }
        
        console.log('Balance Manager initialized. Default balance:', DEFAULT_BALANCE);
    }

    // Start initialization
    initialize();

    // =====================================================
    // DEBUG FUNCTIONS
    // =====================================================

    /**
     * Debug function to log current balance state
     */
    window.debugBalance = function() {
        getBalance().then((balance) => {
            console.log('=== BALANCE DEBUG ===');
            console.log('Current balance:', balance);
            console.log('Cached balance:', cachedBalance);
            console.log('Default balance:', DEFAULT_BALANCE);
            console.log('Storage key:', STORAGE_KEY);
            console.log('Listeners count:', balanceListeners.length);
            console.log('Is initialized:', isInitialized);
            console.log('=====================');
        });
    };

    /**
     * Debug function to clear all balance data
     */
    window.clearBalanceData = function() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(CACHE_KEY);
            cachedBalance = DEFAULT_BALANCE;
            updateAllDisplays();
            console.log('Balance data cleared');
        } catch (e) {
            console.error('Error clearing balance data:', e);
        }
    };

    console.log('Casino Balance Manager loaded successfully');

})();
