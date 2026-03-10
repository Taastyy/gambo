/**
 * =====================================================
 * Casino Shop System
 *
 * A cosmetic shop for purchasing random items with casino winnings.
 *
 * Features:
 * - Browse and purchase cosmetic items
 * - Inventory management
 * - Balance integration with casino games
 * - Persistent storage
 * =====================================================
 */

(function() {
    'use strict';

    // =====================================================
    // SHOP ITEMS CONFIGURATION (Purely Cosmetic)
    // =====================================================

    const SHOP_ITEMS = [
        {
            id: 'rainbow_avatar',
            name: 'Regenbogen Avatar',
            icon: '🌈',
            description: 'Ein farbenfroher Avatar für dein Profil!'
        },
        {
            id: 'golden_frame',
            name: 'Gold Rahmen',
            icon: '🖼️',
            description: 'Ein glänzender goldener Rahmen um dein Profilbild!'
        },
        {
            id: 'sparkles',
            name: 'Sternenstaub',
            icon: '✨',
            description: 'Lass deine Nachrichten glitzern!'
        },
        {
            id: 'crown',
            name: 'Premium Krone',
            icon: '👑',
            description: 'Zeige allen, dass du ein Premium-Spieler bist!'
        },
        {
            id: 'fire',
            name: 'Feuer Emoji',
            icon: '🔥',
            description: 'Das Symbol für Glückssträhnen!'
        },
        {
            id: 'rocket',
            name: 'Rakete',
            icon: '🚀',
            description: 'Zeigt, dass du auf dem Weg nach oben bist!'
        },
        {
            id: 'trophy',
            name: 'Pokale',
            icon: '🏆',
            description: 'Sammle Pokale für deine Gewinne!'
        },
        {
            id: 'diamond',
            name: 'Diamant',
            icon: '💎',
            description: 'Der wertvollste Edelstein im Casino!'
        },
        {
            id: 'island_ticket',
            name: 'Ticket für die Insel',
            icon: '🎫',
            description: 'Ein geheimes Ticket zur exklusiven Insel!'
        },
        {
            id: 'telekom_ceo',
            name: 'Ceo von Telekom werden',
            icon: '🎫',
            description: '51% Der Telekom Stimmenanteile um Ceo zu werden'
        },
        {
            id: 'thick_bmw',
            name: 'Dicker BMW',
            icon: '🚗',
            description: 'Ein luxuriöser BMW für die Straße!'
        }
    ];

    const ITEM_PRICES = {
        rainbow_avatar: 50000,
        golden_frame: 100000,
        sparkles: 75000,
        crown: 250000,
        fire: 30000,
        rocket: 40000,
        trophy: 150000,
        diamond: 500000,
        island_ticket: 100000000,
        telekom_ceo: 765000000000,
        thick_bmw: 1500000
    };

    // =====================================================
    // STORAGE KEYS
    // =====================================================

    const INVENTORY_KEY = 'casinoShopInventory';
    const OWNED_ITEMS_KEY = 'casinoOwnedItems';

    // =====================================================
    // STATE
    // =====================================================

    let currentBalance = 0;
    let inventory = {};

    // =====================================================
    // INVENTORY FUNCTIONS
    // =====================================================

    function loadInventory() {
        try {
            const stored = localStorage.getItem(INVENTORY_KEY);
            if (stored) {
                inventory = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading inventory:', e);
            inventory = {};
        }
    }

    function saveInventory() {
        try {
            localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
        } catch (e) {
            console.error('Error saving inventory:', e);
        }
    }

    function addToInventory(itemId, quantity = 1) {
        if (!inventory[itemId]) {
            inventory[itemId] = 0;
        }
        inventory[itemId] += quantity;
        saveInventory();
    }

    function getInventoryCount(itemId) {
        return inventory[itemId] || 0;
    }

    function isItemOwned(itemId) {
        try {
            const owned = localStorage.getItem(OWNED_ITEMS_KEY);
            if (owned) {
                const ownedItems = JSON.parse(owned);
                return ownedItems.includes(itemId);
            }
        } catch (e) {
            console.error('Error checking owned items:', e);
        }
        return false;
    }

    function markItemAsOwned(itemId) {
        try {
            let owned = [];
            const stored = localStorage.getItem(OWNED_ITEMS_KEY);
            if (stored) {
                owned = JSON.parse(stored);
            }
            if (!owned.includes(itemId)) {
                owned.push(itemId);
                localStorage.setItem(OWNED_ITEMS_KEY, JSON.stringify(owned));
            }
        } catch (e) {
            console.error('Error marking item as owned:', e);
        }
    }

    // =====================================================
    // UI FUNCTIONS
    // =====================================================

    function updateBalanceDisplay() {
        const balanceEl = document.getElementById('balance-amount');
        if (balanceEl && typeof getBalanceSync === 'function') {
            currentBalance = getBalanceSync();
            balanceEl.textContent = Math.round(currentBalance).toLocaleString();
        }
    }

    function showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type} show`;

            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }
    }

    function renderShop() {
        const shopGrid = document.getElementById('shop-grid');
        if (!shopGrid) return;

        shopGrid.innerHTML = '';

        // Sort items by price (ascending)
        const sortedItems = [...SHOP_ITEMS].sort((a, b) => {
            return ITEM_PRICES[a.id] - ITEM_PRICES[b.id];
        });

        sortedItems.forEach(item => {
            const price = ITEM_PRICES[item.id];
            const owned = isItemOwned(item.id);
            const canAfford = currentBalance >= price;

            const card = document.createElement('div');
            card.className = `shop-item ${owned ? 'owned' : ''}`;
            card.innerHTML = `
                <span class="icon">${item.icon}</span>
                <h3>${item.name}</h3>
                <p class="description">${item.description}</p>
                <span class="price">💰 ${price.toLocaleString()}</span>
                <button class="buy-btn"
                        ${(!canAfford && !owned) ? 'disabled' : ''}
                        data-item-id="${item.id}">
                    ${owned ? 'Besessen' : 'Kaufen'}
                </button>
            `;

            shopGrid.appendChild(card);
        });

        // Add click handlers
        shopGrid.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', handlePurchase);
        });
    }

    function renderInventory() {
        const inventoryGrid = document.getElementById('inventory-grid');
        if (!inventoryGrid) return;

        const items = Object.entries(inventory);

        if (items.length === 0) {
            inventoryGrid.innerHTML = '<p class="empty-inventory">Dein Inventar ist noch leer. Kaufe Items im Shop!</p>';
            return;
        }

        inventoryGrid.innerHTML = '';

        items.forEach(([itemId, count]) => {
            const item = SHOP_ITEMS.find(i => i.id === itemId);
            if (item) {
                const div = document.createElement('div');
                div.className = 'inventory-item';
                div.innerHTML = `
                    <span class="icon">${item.icon}</span>
                    <h4>${item.name}</h4>
                    <span class="count">x${count}</span>
                `;
                inventoryGrid.appendChild(div);
            }
        });
    }

    function handlePurchase(event) {
        const btn = event.target;
        const itemId = btn.dataset.itemId;
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        const price = ITEM_PRICES[itemId];

        if (!item) return;

        // Check if already owned
        if (isItemOwned(itemId)) {
            // Buy as consumable if already owned
            if (typeof deductFromBalance !== 'function') {
                showNotification('Fehler: Balance-System nicht geladen!', 'error');
                return;
            }

            if (currentBalance < price) {
                showNotification('Nicht genug Geld!', 'error');
                return;
            }

            const success = deductFromBalance(price);
            if (!success) {
                showNotification('Fehler beim Abziehen des Geldes!', 'error');
                return;
            }

            addToInventory(itemId, 1);
            updateBalanceDisplay();
            renderInventory();
            showNotification(`${item.icon} ${item.name} x1 gekauft!`, 'success');
            return;
        }

        // First purchase - buy and mark as owned
        if (typeof deductFromBalance !== 'function') {
            showNotification('Fehler: Balance-System nicht geladen!', 'error');
            return;
        }

        if (currentBalance < price) {
            showNotification('Nicht genug Geld!', 'error');
            return;
        }

        const success = deductFromBalance(price);
        if (!success) {
            showNotification('Fehler beim Abziehen des Geldes!', 'error');
            return;
        }

        markItemAsOwned(itemId);
        addToInventory(itemId, 1);

        // Update UI
        updateBalanceDisplay();
        renderShop();
        renderInventory();

        showNotification(`${item.icon} ${item.name} gekauft!`, 'success');
    }

    // =====================================================
    // INITIALIZATION
    // =====================================================

    function init() {
        loadInventory();
        updateBalanceDisplay();
        renderShop();
        renderInventory();

        // Listen for balance changes
        if (typeof onBalanceChange === 'function') {
            onBalanceChange(() => {
                updateBalanceDisplay();
            });
        }

        // Sync balance periodically
        setInterval(() => {
            if (typeof syncBalance === 'function') {
                syncBalance();
            }
            updateBalanceDisplay();
        }, 1000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =====================================================
    // EXPORT FUNCTIONS
    // =====================================================

    window.shopSystem = {
        getInventory: () => inventory,
        getShopItems: () => SHOP_ITEMS,
        isItemOwned: isItemOwned
    };

})();
