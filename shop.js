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
            id: 'rolex',
            name: 'Rolex Submariner',
            icon: '⌚',
            description: 'Die Zeit läuft für dich - Ein zeitloser Klassiker am Handgelenk.'
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
            id: 'lamborghini',
            name: 'Lamborghini Aventador',
            icon: '🏎️',
            description: 'Der Traum jedes Gamblers - Schnell, laut und extrem teuer.'
        },
        {
            id: 'diamond',
            name: 'Diamant',
            icon: '💎',
            description: 'Der wertvollste Edelstein im Casino!'
        },
        {
            id: 'private_jet',
            name: 'Privatjet',
            icon: '✈️',
            description: 'Flieg wie ein König - Überspringe die Schlange am Flughafen.'
        },
        {
            id: 'thick_bmw',
            name: 'Dicker BMW',
            icon: '🚗',
            description: 'Ein luxuriöser BMW für die Straße!'
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
        }
    ];

    const ITEM_PRICES = {
        rainbow_avatar: 50000,
        golden_frame: 100000,
        sparkles: 75000,
        rolex: 15000,
        crown: 250000,
        fire: 30000,
        rocket: 40000,
        trophy: 150000,
        lamborghini: 250000,
        diamond: 500000,
        private_jet: 1500000,
        thick_bmw: 750000,
        island_ticket: 100000000,
        telekom_ceo: 765000000000
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

    const ACTIVE_ITEMS_KEY = 'casinoActiveItems';

    function getActiveItems() {
        try {
            const stored = localStorage.getItem(ACTIVE_ITEMS_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) { return {}; }
    }

    function toggleEquip(itemId) {
        const active = getActiveItems();
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return;

        // Simple categories for toggling
        let category = 'other';
        if (itemId.includes('avatar')) category = 'avatar';
        if (itemId.includes('frame')) category = 'frame';

        if (active[category] === itemId) {
            delete active[category];
        } else {
            active[category] = itemId;
        }

        localStorage.setItem(ACTIVE_ITEMS_KEY, JSON.stringify(active));
        renderInventory();
        if (typeof window.updateProfileDisplay === 'function') window.updateProfileDisplay();
    }

    function renderInventory() {
        const inventoryGrid = document.getElementById('inventory-grid');
        if (!inventoryGrid) return;

        const owned = [];
        const storedOwned = localStorage.getItem(OWNED_ITEMS_KEY);
        if (storedOwned) {
            const parsed = JSON.parse(storedOwned);
            parsed.forEach(id => {
                const item = SHOP_ITEMS.find(i => i.id === id);
                if (item) owned.push(item);
            });
        }

        if (owned.length === 0) {
            inventoryGrid.innerHTML = '<p class="empty-inventory">Dein Inventar ist noch leer. Kaufe Items im Shop!</p>';
            return;
        }

        const active = getActiveItems();
        inventoryGrid.innerHTML = '';

        owned.forEach(item => {
            const div = document.createElement('div');
            
            let category = 'other';
            if (item.id.includes('avatar')) category = 'avatar';
            if (item.id.includes('frame')) category = 'frame';
            
            const isEquipped = active[category] === item.id;
            
            div.className = `inventory-item ${isEquipped ? 'equipped' : ''}`;
            div.innerHTML = `
                <div class="item-visual">${item.icon}</div>
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <button class="equip-btn ${isEquipped ? 'active' : ''}" data-id="${item.id}">
                        ${isEquipped ? 'Ablegen' : 'Ausrüsten'}
                    </button>
                </div>
            `;
            inventoryGrid.appendChild(div);
        });

        inventoryGrid.querySelectorAll('.equip-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleEquip(btn.dataset.id));
        });
    }

    async function handlePurchase(event) {
        const btn = event.target;
        const itemId = btn.dataset.itemId;
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        const price = ITEM_PRICES[itemId];

        if (!item) return;

        try {
            const token = localStorage.getItem('casinoToken') || '';
            const res = await fetch('/api/shop/buy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ itemId, price })
            });
            const data = await res.json();

            if (!data.success) {
                showNotification(data.error || 'Fehler beim Kauf!', 'error');
                return;
            }

            if (isItemOwned(itemId)) {
                // Buy as consumable
                addToInventory(itemId, 1);
            } else {
                // First purchase
                markItemAsOwned(itemId);
                addToInventory(itemId, 1);
                renderShop();
            }

            // Update UI with returned balance
            if (typeof updateBalanceDisplay === 'function') {
                const balanceEl = document.getElementById('balance-amount');
                if (balanceEl) balanceEl.textContent = Math.round(data.newBalance).toLocaleString();
                if (typeof window.syncBalance === 'function') setTimeout(window.syncBalance, 100);
            }
            
            renderInventory();
            showNotification(`${item.icon} ${item.name} gekauft!`, 'success');
        } catch (e) {
            showNotification('Netzwerkfehler beim Kauf!', 'error');
        }
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
