/**
 * ==========================================================================
 * Blackjack Game JavaScript
 * 
 * A fully functional Blackjack game with all classic
 * rules and features. This game offers:
 * - Complete Blackjack rules with dealer AI
 * - Betting system with double down option
 * - Hit and stand functions
 * - Score tracking and game history
 * - Animated cards
 * - Responsive design
 * - Perfect strategy helper
 * 
 * @author Blackjack Game
 * @version 1.0.0
 * @date 2026
 * ==========================================================================
 */


// ==========================================================================
// GLOBAL VARIABLES AND CONSTANTS
// ==========================================================================

/**
 * Card symbols for display
 */
const SUITS = {
    HEARTS: '♥',
    DIAMONDS: '♦',
    SPADES: '♠',
    CLUBS: '♣'
};

/**
 * Card values with their numeric values
 */
const VALUES = {
    'A': 11,  // Ace will be calculated as 1 or 11 later
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    'J': 10,  // Jack
    'Q': 10,  // Queen
    'K': 10   // King
};

/**
 * Number of decks to use
 */
const DECK_COUNT = 6; // 6 decks is standard in most casinos;

/**
 * Game state constants
 */
const GAME_STATE = {
    WAITING: 'waiting',       // Waiting for game start
    PLAYER_TURN: 'player',    // Player's turn
    DEALER_TURN: 'dealer',    // Dealer's turn
    GAME_OVER: 'game_over'    // Game ended
};

/**
 * Message types for game display
 */
const MESSAGE_TYPES = {
    WIN: 'win',
    LOSE: 'lose',
    PUSH: 'push',
    BLACKJACK: 'blackjack',
    BUST: 'bust'
};

// ==========================================================================
// GAME STATE
// ==========================================================================

let gameState = {
    deck: [],                     // Current card deck
    playerHands: [],              // Array of player hands (for split)
    dealerHand: [],               // Dealer's cards
    currentBet: 100,              // Current bet
    splitBets: [],                // Bets for split hands
    currentHandIndex: 0,          // Current hand index for split
    gamesPlayed: 0,               // Number of games played
    wins: 0,                      // Number of wins
    losses: 0,                    // Number of losses
    pushes: 0,                    // Number of pushes
    blackjacks: 0,                // Number of blackjacks
    playerBusts: 0,               // Number of player busts
    dealerBusts: 0,               // Number of dealer busts
    doubles: 0,                   // Number of doubles
    splits: 0,                    // Number of splits
    highestWin: 0,                // Highest win amount
    totalWagered: 0,              // Total amount wagered
    currentStreak: 0,             // Current win streak
    bestStreak: 0,                // Best win streak
    strategyHelperEnabled: true,  // Enable/disable strategy helper
    state: GAME_STATE.WAITING,    // Current game state
    insuranceOffered: false,      // Insurance has been offered
    insuranceTaken: false,        // Player took insurance
    surrendered: false,           // Player surrendered
    canDoubleAfterSplit: true,    // Allow double after split
    maxSplits: 4,                 // Maximum number of splits
    deckCount: DECK_COUNT         // Number of decks in shoe
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================

// These elements are initialized when the DOM is loaded
let dealerCardsEl, playerCardsEl, dealerScoreEl, playerScoreEl;
let gameMessageEl, currentBetEl, playerBalanceEl;
let gamesCountEl, winsCountEl, lossesCountEl, pushesCountEl;
let historyListEl;
let dealBtn, hitBtn, standBtn, doubleBtn, splitBtn;
let strategyHelperEl, strategyToggleEl;


// ==========================================================================
// INITIALIZATION
// ==========================================================================

/**
 * Initializes the game when the DOM is fully loaded.
 * Binds all event listeners and references DOM elements.
 */
async function initializeGame() {
    initializeElements();
    initializeEventListeners();
    initializeStatsModal();
    await loadStats(); // Load stats from localStorage
    syncBalance(); // Sync balance display with IndexedDB
    updateUI();
    showMessage('Welcome! Place your bet and click "Deal Cards"', '');
}

document.addEventListener('DOMContentLoaded', function() {
    initializeGame();
});

/**
 * References all required DOM elements for easy access.
 */
function initializeElements() {
    dealerCardsEl = document.getElementById('dealer-cards');
    playerCardsEl = document.getElementById('player-cards');
    dealerScoreEl = document.getElementById('dealer-score');
    playerScoreEl = document.getElementById('player-score');
    gameMessageEl = document.getElementById('game-message');
    currentBetEl = document.getElementById('current-bet');
    playerBalanceEl = document.getElementById('balance-display');
    gamesCountEl = document.getElementById('games-count');
    winsCountEl = document.getElementById('wins-count');
    lossesCountEl = document.getElementById('losses-count');
    pushesCountEl = document.getElementById('pushes-count');
    historyListEl = document.getElementById('history-list');
    strategyHelperEl = document.getElementById('strategy-helper');
    strategyToggleEl = document.getElementById('strategy-toggle');
    
    dealBtn = document.getElementById('deal-btn');
    hitBtn = document.getElementById('hit-btn');
    standBtn = document.getElementById('stand-btn');
    doubleBtn = document.getElementById('double-btn');
    splitBtn = document.getElementById('split-btn');
}

/**
 * Initializes all event listeners for the buttons.
 */
function initializeEventListeners() {
    // Keyboard shortcuts for quick play
    document.addEventListener('keydown', function(e) {
        if (gameState.state === GAME_STATE.PLAYER_TURN) {
            switch(e.key.toLowerCase()) {
                case 'h':
                    hitCard();
                    break;
                case 's':
                    standGame();
                    break;
                case 'd':
                    if (!doubleBtn.disabled) {
                        doubleBet();
                    }
                    break;
                case 'p':
                    if (!splitBtn.disabled) {
                        splitHand();
                    }
                    break;
            }
        }
    });
    
    // Strategy helper toggle
    if (strategyToggleEl) {
        strategyToggleEl.addEventListener('change', function() {
            gameState.strategyHelperEnabled = this.checked;
            updateStrategyHelper();
        });
    }
}


// ==========================================================================
// CARD DECK FUNCTIONS
// ==========================================================================

/**
 * Creates a new shuffled deck of 52 cards.
 * The deck contains 4 sets of Ace through King.
 * 
 * @returns {Array} An array of 52 card objects
 */
function createDeck() {
    const suits = Object.keys(SUITS);
    const values = Object.keys(VALUES);
    const deck = [];
    
    for (const suit of suits) {
        for (const value of values) {
            deck.push({
                suit: SUITS[suit],
                value: value,
                numericValue: VALUES[value],
                color: (suit === 'HEARTS' || suit === 'DIAMONDS') ? 'red' : 'black'
            });
        }
    }
    
    return deck;
}

/**
 * Creates a shoe of multiple decks.
 * 
 * @param {number} numDecks - Number of decks to include
 * @returns {Array} Shuffled array of cards from all decks
 */
function createShoe(numDecks) {
    let shoe = [];
    
    for (let i = 0; i < numDecks; i++) {
        shoe = shoe.concat(createDeck());
    }
    
    return shuffleDeck(shoe);
}

/**
 * Shuffles a card deck using the Fisher-Yates algorithm.
 * This ensures a random and fair distribution.
 * 
 * @param {Array} deck - The deck to shuffle
 * @returns {Array} The shuffled deck
 */
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

/**
 * Draws a card from the deck.
 * If the deck is empty, a new one is created.
 * 
 * @returns {Object} The drawn card as an object
 */
function drawCard() {
    if (gameState.deck.length === 0) {
        gameState.deck = createDeck();
    }
    return gameState.deck.pop();
}


// ==========================================================================
// SCORE CALCULATION
// ==========================================================================

/**
 * Calculates the score of a hand considering aces.
 * An ace can count as 1 or 11, whichever is more favorable.
 * 
 * @param {Array} hand - Array of card objects
 * @returns {Object} Score and ace count {score, aceCount}
 */
function calculateHandValue(hand) {
    let score = 0;
    let aceCount = 0;
    
    for (const card of hand) {
        score += card.numericValue;
        if (card.value === 'A') {
            aceCount++;
        }
    }
    
    // Reduce aces from 11 to 1 if score is over 21
    while (score > 21 && aceCount > 0) {
        score -= 10;
        aceCount--;
    }
    
    return { score, aceCount };
}

/**
 * Checks if a hand is a blackjack (Ace + 10/Face on first turn).
 * 
 * @param {Array} hand - The hand to check
 * @returns {boolean} True if the hand is a blackjack
 */
function isBlackjack(hand) {
    if (hand.length !== 2) return false;
    
    const hasAce = hand.some(card => card.value === 'A');
    const hasTen = hand.some(card => ['10', 'J', 'Q', 'K'].includes(card.value));
    
    return hasAce && hasTen;
}

/**
 * Checks if a split is possible.
 * Split is possible if the player has two cards of equal value.
 * 
 * @returns {boolean} True if split is possible
 */
function canSplit() {
    if (gameState.state !== GAME_STATE.PLAYER_TURN) return false;
    if (gameState.playerHands.length > 1) return false; // No re-split in this version
    
    const hand = gameState.playerHands[0];
    if (hand.length !== 2) return false;
    
    // Check if both cards have the same value
    const firstValue = hand[0].value;
    const secondValue = hand[1].value;
    
    // Aces can always be split
    if (firstValue === 'A' && secondValue === 'A') return true;
    
    // Same values (2-10, J, Q, K)
    return firstValue === secondValue;
}

/**
 * Returns the dealer score for display.
 * Shows only the first card during the game.
 * 
 * @returns {string} Formatted score or empty string
 */
function getDealerScoreDisplay() {
    if (gameState.dealerHand.length === 0) return '';
    
    // If game hasn't ended yet (dealer turn not reached)
    // Show only the value of the first (visible) card
    if (gameState.state === GAME_STATE.PLAYER_TURN) {
        const firstCard = gameState.dealerHand[0];
        // Ace shows as 11, but we show "A" or the actual value
        if (firstCard.value === 'A') {
            return '(A)';
        }
        return `(${firstCard.numericValue})`;
    }
    
    // If dealer turn or game ended, show full score
    const { score } = calculateHandValue(gameState.dealerHand);
    return `(${score})`;
}

/**
 * Returns the formatted score for display.
 * 
 * @param {Array} hand - The hand whose score to display
 * @returns {string} Formatted score or empty string
 */
function getHandScore(hand) {
    if (hand.length === 0) return '';
    const { score } = calculateHandValue(hand);
    return `(${score})`;
}

/**
 * Creates a DOM element for a card.
 * 
 * @param {Object} card - The card object
 * @param {boolean} isHidden - Whether the card should be hidden
 * @returns {HTMLElement} The card DOM element
 */
function createCardElement(card, isHidden = false) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.color}${isHidden ? ' hidden' : ''}`;
    
    if (isHidden) {
        return cardEl;
    }
    
    // Top left corner
    const topCorner = document.createElement('div');
    topCorner.className = 'card-corner';
    topCorner.innerHTML = `<span class="card-value">${card.value}</span><span class="card-suit">${card.suit}</span>`;
    cardEl.appendChild(topCorner);
    
    // Center of card
    const center = document.createElement('div');
    center.className = 'card-center';
    center.textContent = card.suit;
    cardEl.appendChild(center);
    
    // Bottom right corner
    const bottomCorner = document.createElement('div');
    bottomCorner.className = 'card-corner bottom';
    bottomCorner.innerHTML = `<span class="card-value">${card.value}</span><span class="card-suit">${card.suit}</span>`;
    cardEl.appendChild(bottomCorner);
    
    return cardEl;
}

/**
 * Renders all cards on the game table.
 */
function renderCards() {
    // Dealer cards
    dealerCardsEl.innerHTML = '';
    gameState.dealerHand.forEach((card, index) => {
        const isHidden = index === 1 && gameState.state === GAME_STATE.PLAYER_TURN;
        dealerCardsEl.appendChild(createCardElement(card, isHidden));
    });
    
    // Player cards (all hands on split)
    playerCardsEl.innerHTML = '';
    
    gameState.playerHands.forEach((hand, handIndex) => {
        const handContainer = document.createElement('div');
        handContainer.className = 'player-hand';
        
        // Hand label with index
        const handLabel = document.createElement('div');
        handLabel.className = 'hand-label';
        if (gameState.playerHands.length > 1) {
            handLabel.textContent = `Hand ${handIndex + 1}`;
            if (handIndex === gameState.currentHandIndex) {
                handLabel.classList.add('active');
            }
        }
        handContainer.appendChild(handLabel);
        
        // Cards of this hand
        hand.forEach(card => {
            handContainer.appendChild(createCardElement(card));
        });
        
        playerCardsEl.appendChild(handContainer);
    });
    
    // Update scores
    dealerScoreEl.textContent = getDealerScoreDisplay();
    
    // Show score of current hand
    if (gameState.playerHands.length > 0) {
        const currentHand = gameState.playerHands[gameState.currentHandIndex];
        playerScoreEl.textContent = getHandScore(currentHand);
    } else {
        playerScoreEl.textContent = '';
    }
}


// ==========================================================================
// UI UPDATES
// ==========================================================================

/**
 * Updates the entire user interface based on the game state.
 */
function updateUI() {
    // Bet and balance
    updateBetDisplay();
    
    // Statistics
    gamesCountEl.textContent = gameState.gamesPlayed;
    winsCountEl.textContent = gameState.wins;
    lossesCountEl.textContent = gameState.losses;
    pushesCountEl.textContent = gameState.pushes;
    
    // Button states based on game state
    updateButtonStates();
    
    // Update strategy helper
    updateStrategyHelper();
}

/**
 * Updates button states based on the current game state.
 */
function updateButtonStates() {
    const canPlay = gameState.state === GAME_STATE.PLAYER_TURN;
    const canDeal = gameState.state === GAME_STATE.WAITING || gameState.state === GAME_STATE.GAME_OVER;
    
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    const currentBalance = getBalanceSync();
    
    // Can only double if current hand has 2 cards and enough balance
    const canDouble = canPlay && 
                      currentHand && 
                      currentHand.length === 2 && 
                      currentBalance >= gameState.currentBet;
    
    // Check if we can double after split
    const isSplitHand = gameState.playerHands.length > 1;
    const canDoubleOnSplit = gameState.canDoubleAfterSplit || !isSplitHand;
    
    // Can only split if conditions met
    const canSplitAction = canPlay && 
                           gameState.playerHands.length < gameState.maxSplits && 
                           currentBalance >= gameState.currentBet &&
                           canSplit();
    
    // Insurance: only available when dealer shows Ace and player hasn't acted
    const dealerUpCard = gameState.dealerHand[0];
    const canTakeInsurance = canPlay && 
                             dealerUpCard && 
                             dealerUpCard.value === 'A' && 
                             !gameState.insuranceTaken &&
                             currentBalance >= gameState.currentBet / 2;
    
    // Surrender: only available on first two cards of first hand, before any other action
    const canSurrender = canPlay && 
                         gameState.playerHands.length === 1 && 
                         currentHand && 
                         currentHand.length === 2 &&
                         !gameState.surrendered &&
                         !gameState.insuranceTaken;
    
    dealBtn.disabled = !canDeal;
    hitBtn.disabled = !canPlay;
    standBtn.disabled = !canPlay;
    doubleBtn.disabled = !canDouble || !canDoubleOnSplit;
    splitBtn.disabled = !canSplitAction;
    
    // Insurance and Surrender buttons - show/hide based on state
    const insuranceBtn = document.getElementById('insurance-btn');
    const surrenderBtn = document.getElementById('surrender-btn');
    
    if (insuranceBtn) {
        if (canPlay && !gameState.insuranceTaken && dealerUpCard && dealerUpCard.value === 'A') {
            insuranceBtn.style.display = 'inline-block';
            insuranceBtn.disabled = currentBalance < gameState.currentBet / 2;
        } else {
            insuranceBtn.style.display = 'none';
        }
    }
    
    if (surrenderBtn) {
        if (canSurrender) {
            surrenderBtn.style.display = 'inline-block';
            surrenderBtn.disabled = false;
        } else {
            surrenderBtn.style.display = 'none';
            surrenderBtn.disabled = true;
        }
    }
}

/**
 * Shows a message on the game table.
 * 
 * @param {string} message - The message to display
 * @param {string} type - The message type (win, lose, push, blackjack)
 */
function showMessage(message, type) {
    gameMessageEl.textContent = message;
    gameMessageEl.className = `game-message ${type}`;
}


// ==========================================================================
// STRATEGY HELPER
// ==========================================================================

/**
 * Basic Blackjack Strategy Chart
 * Returns the recommended action based on player's hand and dealer's up card
 * 
 * @param {number} playerScore - Player's current score
 * @param {string} playerValue1 - First card value
 * @param {string} playerValue2 - Second card value
 * @param {number} dealerUpCard - Dealer's up card value (1-11)
 * @returns {string} Recommended action: 'hit', 'stand', 'double', or 'split'
 */
function getBasicStrategy(playerScore, playerValue1, playerValue2, dealerUpCard) {
    const isPair = playerValue1 === playerValue2;
    const isSoft = playerScore <= 11 && (playerValue1 === 'A' || playerValue2 === 'A');
    
    // Always handle 21
    if (playerScore >= 21) return 'stand';
    
    // Handle pairs
    if (isPair) {
        // Pair of Aces - always split
        if (playerValue1 === 'A') return 'split';
        
        // Pair of 8s - always split
        if (playerValue1 === '8') return 'split';
        
        // Pair of 9s - split unless dealer has 7, 10, or Ace
        if (playerValue1 === '9') {
            if ([7, 10, 11].includes(dealerUpCard)) return 'stand';
            return 'split';
        }
        
        // Pair of 7s - split if dealer has 2-7
        if (playerValue1 === '7') {
            if (dealerUpCard >= 2 && dealerUpCard <= 7) return 'split';
            return 'hit';
        }
        
        // Pair of 6s - split if dealer has 2-6
        if (playerValue1 === '6') {
            if (dealerUpCard >= 2 && dealerUpCard <= 6) return 'split';
            return 'hit';
        }
        
        // Pair of 4s - split if dealer has 5 or 6
        if (playerValue1 === '4') {
            if (dealerUpCard === 5 || dealerUpCard === 6) return 'split';
            return 'hit';
        }
        
        // Pair of 2s or 3s - split if dealer has 2-7
        if (playerValue1 === '2' || playerValue1 === '3') {
            if (dealerUpCard >= 2 && dealerUpCard <= 7) return 'split';
            return 'hit';
        }
        
        // Pair of 10s, Js, Qs, Ks - always stand
        if (['10', 'J', 'Q', 'K'].includes(playerValue1)) return 'stand';
    }
    
    // Handle soft hands (contains ace counted as 11)
    if (isSoft) {
        const softScore = playerScore;
        
        // Soft 20 or 21 - always stand
        if (softScore >= 20) return 'stand';
        
        // Soft 19 - stand against dealer 6, otherwise hit
        if (softScore === 19) {
            if (dealerUpCard === 6) return 'stand';
            return 'hit';
        }
        
        // Soft 18 - stand against dealer 2-8, hit against 9, 10, Ace
        if (softScore === 18) {
            if (dealerUpCard >= 2 && dealerUpCard <= 8) return 'stand';
            return 'hit';
        }
        
        // Soft 17 - double against dealer 3-6, otherwise hit
        if (softScore === 17) {
            if (dealerUpCard >= 3 && dealerUpCard <= 6) return 'double';
            return 'hit';
        }
        
        // Soft 15-16 - double against dealer 4-6, otherwise hit
        if (softScore === 15 || softScore === 16) {
            if (dealerUpCard >= 4 && dealerUpCard <= 6) return 'double';
            return 'hit';
        }
        
        // Soft 13-14 - double against dealer 5-6, otherwise hit
        if (softScore === 13 || softScore === 14) {
            if (dealerUpCard >= 5 && dealerUpCard <= 6) return 'double';
            return 'hit';
        }
    }
    
    // Hard totals
    // Hard 17+ - always stand
    if (playerScore >= 17) return 'stand';
    
    // Hard 16 - stand against dealer 2-6, hit against 7+
    if (playerScore === 16) {
        if (dealerUpCard >= 2 && dealerUpCard <= 6) return 'stand';
        return 'hit';
    }
    
    // Hard 15 - stand against dealer 2-6, hit against 7+
    if (playerScore === 15) {
        if (dealerUpCard >= 2 && dealerUpCard <= 6) return 'stand';
        return 'hit';
    }
    
    // Hard 14 - stand against dealer 2-6, hit against 7+
    if (playerScore === 14) {
        if (dealerUpCard >= 2 && dealerUpCard <= 6) return 'stand';
        return 'hit';
    }
    
    // Hard 13 - stand against dealer 2-6, hit against 7+
    if (playerScore === 13) {
        if (dealerUpCard >= 2 && dealerUpCard <= 6) return 'stand';
        return 'hit';
    }
    
    // Hard 12 - stand against dealer 4-6, hit otherwise
    if (playerScore === 12) {
        if (dealerUpCard >= 4 && dealerUpCard <= 6) return 'stand';
        return 'hit';
    }
    
    // Hard 11 - always double (if possible)
    if (playerScore === 11) return 'double';
    
    // Hard 10 - double against dealer 2-9
    if (playerScore === 10) {
        if (dealerUpCard >= 2 && dealerUpCard <= 9) return 'double';
        return 'hit';
    }
    
    // Hard 9 - double against dealer 3-6
    if (playerScore === 9) {
        if (dealerUpCard >= 3 && dealerUpCard <= 6) return 'double';
        return 'hit';
    }
    
    // Hard 8 or less - always hit
    return 'hit';
}

/**
 * Updates the strategy helper display
 */
function updateStrategyHelper() {
    if (!strategyHelperEl) return;
    
    if (!gameState.strategyHelperEnabled || gameState.state !== GAME_STATE.PLAYER_TURN) {
        strategyHelperEl.innerHTML = '';
        strategyHelperEl.className = 'strategy-helper';
        return;
    }
    
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    if (!currentHand || currentHand.length === 0) {
        strategyHelperEl.innerHTML = '';
        return;
    }
    
    const dealerUpCard = gameState.dealerHand[0];
    if (!dealerUpCard) {
        strategyHelperEl.innerHTML = '';
        return;
    }
    
    const { score } = calculateHandValue(currentHand);
    const dealerValue = dealerUpCard.value === 'A' ? 11 : dealerUpCard.numericValue;
    
    const action = getBasicStrategy(score, currentHand[0].value, currentHand[1].value, dealerValue);
    
    let actionText = '';
    let actionClass = '';
    
    switch (action) {
        case 'hit':
            actionText = 'HIT';
            actionClass = 'action-hit';
            break;
        case 'stand':
            actionText = 'STAND';
            actionClass = 'action-stand';
            break;
        case 'double':
            actionText = 'DOUBLE';
            actionClass = 'action-double';
            break;
        case 'split':
            actionText = 'SPLIT';
            actionClass = 'action-split';
            break;
    }
    
    strategyHelperEl.innerHTML = `<span class="${actionClass}">Strategy: ${actionText}</span>`;
    strategyHelperEl.className = 'strategy-helper active';
}


// ==========================================================================
// GAME ACTIONS
// ==========================================================================

/**
 * Sets the bet to a specific amount.
 * 
 * @param {number} amount - The amount to set the bet to
 */
function setBet(amount) {
    if (gameState.state !== GAME_STATE.WAITING && gameState.state !== GAME_STATE.GAME_OVER) return;
    
    const validAmount = Math.max(1, amount);
    
    gameState.currentBet = validAmount;
    updateBetDisplay();
    
    // Animate the bet change
    const betAmountEl = document.getElementById('current-bet');
    betAmountEl.style.transform = 'scale(1.2)';
    setTimeout(() => {
        betAmountEl.style.transform = 'scale(1)';
    }, 150);
}

/**
 * Sets a custom bet from the input field.
 * 
 * @param {string} value - The value from the input field
 */
function setCustomBet(value) {
    const amount = parseInt(value) || 1;
    setBet(amount);
    
    // Update input to reflect validated value
    const inputEl = document.getElementById('custom-bet-input');
    inputEl.value = gameState.currentBet;
}

/**
 * Sets the bet to half of the player's balance (rounded down to nearest 10).
 */
function halfBet() {
    if (gameState.state !== GAME_STATE.WAITING && gameState.state !== GAME_STATE.GAME_OVER) return;
    
    const halfBalance = Math.floor(getBalanceSync() / 2);
    setBet(Math.max(1, halfBalance));
}

/**
 * Doubles the current bet.
 */
function doubleCurrentBet() {
    if (gameState.state !== GAME_STATE.WAITING && gameState.state !== GAME_STATE.GAME_OVER) return;
    
    const doubledBet = gameState.currentBet * 2;
    setBet(doubledBet);
}

/**
 * Sets the bet to the player's entire balance (or max allowed).
 */
function setAllIn() {
    if (gameState.state !== GAME_STATE.WAITING && gameState.state !== GAME_STATE.GAME_OVER) return;
    
    setBet(getBalanceSync());
}

/**
 * Updates the bet display and input field.
 */
function updateBetDisplay() {
    const betAmountEl = document.getElementById('current-bet');
    const inputEl = document.getElementById('custom-bet-input');
    const balanceEl = document.getElementById('balance-display');
    
    betAmountEl.textContent = gameState.currentBet;
    
    if (inputEl) {
        inputEl.value = gameState.currentBet;
    }
    
    if (balanceEl) {
        balanceEl.textContent = `Balance: ${getBalanceSync()}`;
    }
}

/**
 * Changes the current bet by the specified amount.
 * 
 * @param {number} amount - The amount to change the bet by
 */
function changeBet(amount) {
    if (gameState.state !== GAME_STATE.WAITING && gameState.state !== GAME_STATE.GAME_OVER) return;
    
    const newBet = gameState.currentBet + amount;
    if (newBet >= 1) {
        gameState.currentBet = newBet;
        updateBetDisplay();
        
        // Update input field
        const inputEl = document.getElementById('custom-bet-input');
        if (inputEl) {
            inputEl.value = gameState.currentBet;
        }
    }
}

/**
 * Starts a new game and deals the cards.
 */
async function dealGame() {
    // If game is already in progress or over, reset first
    if (gameState.state === GAME_STATE.PLAYER_TURN || 
        gameState.state === GAME_STATE.DEALER_TURN || 
        gameState.state === GAME_STATE.GAME_OVER) {
        resetGame();
    }
    
    // Force game state to WAITING to ensure deal button is enabled
    gameState.state = GAME_STATE.WAITING;
    
    // Force enable deal button
    if (dealBtn) {
        dealBtn.disabled = false;
    }
    
    if (getBalanceSync() < gameState.currentBet) {
        showMessage('Not enough balance! Lower your bet or restart.', 'lose');
        return;
    }
    
    // Reset split variables
    gameState.splitBets = [];
    gameState.currentHandIndex = 0;
    
    // Reset insurance and surrender
    gameState.insuranceOffered = false;
    gameState.insuranceTaken = false;
    gameState.surrendered = false;
    
    // Deduct bet from balance
    deductFromBalance(gameState.currentBet);
    gameState.totalWagered += gameState.currentBet;
    
    // Create shoe with multiple decks
    gameState.deck = createShoe(gameState.deckCount);
    
    // Deal cards
    gameState.playerHands = [[drawCard(), drawCard()]];
    gameState.dealerHand = [drawCard(), drawCard()];
    
    // Set game state
    gameState.state = GAME_STATE.PLAYER_TURN;
    gameState.gamesPlayed++;
    
    // Reset win streak for new game
    gameState.currentStreak = 0;
    
    // Check for blackjack
    if (isBlackjack(gameState.playerHands[0])) {
        handleBlackjack();
    } else {
        // Check if dealer has blackjack (show insurance option first)
        const dealerUpCard = gameState.dealerHand[0];
        
        // Show message about insurance BEFORE setting insuranceOffered
        if (dealerUpCard.value === 'A') {
            showMessage('Dealer shows Ace! Insurance available.', '');
        } else {
            showMessage('Your turn! Hit (H) or Stand (S)?', '');
        }
        
        // Update UI to show buttons
        updateUI();
        renderCards();
        
        // Set insurance offered AFTER UI update (so button can show)
        if (dealerUpCard.value === 'A') {
            gameState.insuranceOffered = true;
            // Force update again to show button
            updateButtonStates();
        }
    }
}

/**
 * Handles the blackjack case for the player.
 */
function handleBlackjack() {
    const dealerHasBlackjack = isBlackjack(gameState.dealerHand);
    
    // First, handle insurance if taken
    if (gameState.insuranceTaken) {
        if (dealerHasBlackjack) {
            // Insurance pays 2:1, main bet pushes
            const insuranceWin = gameState.currentBet; // 2:1 on half bet = full bet back
            addToBalance(insuranceWin);
            addToBalance(gameState.currentBet); // Push - get bet back
            gameState.pushes++;
            gameState.currentStreak = 0;
            showMessage('Both have Blackjack! Insurance wins! Push!', 'push');
            addToHistory('Push + Insurance', 'push');
        } else {
            // Insurance loses, but blackjack wins
            const winAmount = Math.floor(gameState.currentBet * 2.5);
            addToBalance(winAmount);
            gameState.wins++;
            gameState.blackjacks++;
            gameState.currentStreak++;
            if (gameState.currentStreak > gameState.bestStreak) {
                gameState.bestStreak = gameState.currentStreak;
            }
            if (winAmount > gameState.highestWin) {
                gameState.highestWin = winAmount;
            }
            showMessage('BLACKJACK! Insurance lost. You win 3:2!', 'blackjack');
            addToHistory(`Win +${winAmount}`, 'win');
        }
    } else {
        if (dealerHasBlackjack) {
            // Both have blackjack - push
            addToBalance(gameState.currentBet);
            gameState.pushes++;
            gameState.currentStreak = 0;
            showMessage('Both have Blackjack! Push!', 'push');
            addToHistory('Push - Both Blackjack', 'push');
        } else {
            // Player wins with blackjack (3:2 payout)
            const winAmount = Math.floor(gameState.currentBet * 2.5);
            addToBalance(winAmount);
            gameState.wins++;
            gameState.blackjacks++;
            gameState.currentStreak++;
            if (gameState.currentStreak > gameState.bestStreak) {
                gameState.bestStreak = gameState.currentStreak;
            }
            if (winAmount > gameState.highestWin) {
                gameState.highestWin = winAmount;
            }
            showMessage('BLACKJACK! You win 3:2!', 'blackjack');
            addToHistory(`Win +${winAmount}`, 'win');
        }
    }
    
    gameState.state = GAME_STATE.GAME_OVER;
    saveStats(); // Save stats
    updateUI();
    renderCards();
}

/**
 * Player takes insurance against dealer blackjack.
 */
async function takeInsurance() {
    if (gameState.state !== GAME_STATE.PLAYER_TURN) return;
    if (gameState.insuranceOffered && !gameState.insuranceTaken) {
        const insuranceCost = gameState.currentBet / 2;
        
        if (getBalanceSync() < insuranceCost) {
            showMessage('Not enough balance for insurance!', 'lose');
            return;
        }
        
        // Deduct insurance cost
        deductFromBalance(insuranceCost);
        gameState.insuranceTaken = true;
        
        showMessage('Insurance taken!', '');
        updateUI();
        
        // Check if dealer has blackjack
        if (isBlackjack(gameState.dealerHand)) {
            // Reveal hole card and handle result
            renderCards();
            setTimeout(() => {
                handleBlackjack();
            }, 500);
        } else {
            // Continue game
            showMessage('Dealer does not have Blackjack. Your turn!', '');
        }
    }
}

/**
 * Player surrenders and loses half their bet.
 */
function surrenderGame() {
    if (gameState.state !== GAME_STATE.PLAYER_TURN) return;
    
    // Can only surrender on first hand with 2 cards
    if (gameState.playerHands.length !== 1) return;
    
    const hand = gameState.playerHands[0];
    if (hand.length !== 2) return;
    
    if (gameState.surrendered) return;
    
    // Surrender - lose half the bet
    const surrenderAmount = gameState.currentBet / 2;
    addToBalance(surrenderAmount);
    
    gameState.surrendered = true;
    gameState.losses++;
    gameState.currentStreak = 0;
    
    showMessage('Surrendered! Half bet returned.', 'lose');
    addToHistory(`Surrender -${surrenderAmount}`, 'lose');
    
    gameState.state = GAME_STATE.GAME_OVER;
    saveStats();
    updateUI();
}

/**
 * Allows the player to draw another card.
 */
function hitCard() {
    if (gameState.state !== GAME_STATE.PLAYER_TURN) return;
    
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    const card = drawCard();
    currentHand.push(card);
    renderCards();
    
    const { score } = calculateHandValue(currentHand);
    
    if (score > 21) {
        // Player busted
        gameState.playerBusts++;
        gameState.currentStreak = 0;
        finishCurrentHand();
    } else if (score === 21) {
        // Auto stand at 21
        standGame();
    } else {
        showMessage(`Score: ${score}. Hit (H) or Stand (S)?`, '');
        updateUI(); // Refresh strategy helper
    }
}

/**
 * Finishes the current hand and moves to the next.
 */
function finishCurrentHand() {
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    const { score } = calculateHandValue(currentHand);
    
    if (score > 21) {
        showMessage(`Hand ${gameState.currentHandIndex + 1}: Bust!`, 'bust');
    }
    
    // Move to next hand
    gameState.currentHandIndex++;
    
    if (gameState.currentHandIndex >= gameState.playerHands.length) {
        // All hands played
        if (score > 21) {
            // Player busted - game over immediately
            gameState.state = GAME_STATE.GAME_OVER;
            gameState.losses++;
            saveStats();
            updateUI();
            updateButtonStates();
            renderCards();
            showMessage('Bust! You lose!', 'lose');
        } else {
            // No bust - dealer takes turn
            gameState.state = GAME_STATE.DEALER_TURN;
            updateButtonStates();
            renderCards();
            dealerPlay();
        }
    } else {
        // Play next hand
        updateButtonStates();
        renderCards();
        updateUI(); // Refresh strategy helper
        const nextHand = gameState.playerHands[gameState.currentHandIndex];
        const nextScore = calculateHandValue(nextHand).score;
        showMessage(`Hand ${gameState.currentHandIndex + 1}: Score ${nextScore}. Hit (H) or Stand (S)?`, '');
    }
}

/**
 * Player stands and moves to next hand or dealer takes turn.
 */
function standGame() {
    if (gameState.state !== GAME_STATE.PLAYER_TURN) return;
    
    // If there are more hands, move to next hand
    if (gameState.currentHandIndex < gameState.playerHands.length - 1) {
        gameState.currentHandIndex++;
        updateButtonStates();
        renderCards();
        updateUI(); // Refresh strategy helper
        const nextHand = gameState.playerHands[gameState.currentHandIndex];
        const nextScore = calculateHandValue(nextHand).score;
        showMessage(`Hand ${gameState.currentHandIndex + 1}: Score ${nextScore}. Hit (H) or Stand (S)?`, '');
    } else {
        // All hands played - dealer takes turn
        gameState.state = GAME_STATE.DEALER_TURN;
        updateButtonStates();
        renderCards();
        dealerPlay();
    }
}

/**
 * Has the dealer play.
 * Dealer must stand on 17 or higher.
 */
function dealerPlay() {
    const dealerTurn = () => {
        const { score } = calculateHandValue(gameState.dealerHand);
        
        if (score < 17) {
            // Dealer draws a card
            setTimeout(() => {
                gameState.dealerHand.push(drawCard());
                renderCards();
                dealerTurn();
            }, 800);
        } else {
            // Dealer has 17 or more - game ended
            determineWinner();
        }
    };
    
    setTimeout(dealerTurn, 500);
}

/**
 * Determines the winner for all player hands.
 */
function determineWinner() {
    const dealerScore = calculateHandValue(gameState.dealerHand).score;
    let totalWinnings = 0;
    let handsWon = 0;
    let handsLost = 0;
    let handsPush = 0;
    
    // Dealer bust tracking
    if (dealerScore > 21) {
        gameState.dealerBusts++;
    }
    
    // Compare each player hand against dealer
    gameState.playerHands.forEach((hand, index) => {
        const playerScore = calculateHandValue(hand).score;
        const bet = gameState.splitBets[index] || gameState.currentBet;
        
        if (dealerScore > 21) {
            // Dealer busted - player wins
            addToBalance(bet * 2);
            gameState.wins++;
            totalWinnings += bet;
            handsWon++;
        } else if (playerScore > dealerScore) {
            // Player has higher score
            addToBalance(bet * 2);
            gameState.wins++;
            totalWinnings += bet;
            handsWon++;
        } else if (dealerScore > playerScore) {
            // Dealer has higher score
            gameState.losses++;
            handsLost++;
        } else {
            // Push
            addToBalance(bet);
            gameState.pushes++;
            handsPush++;
        }
    });
    
    // Update win streak
    if (handsWon > 0) {
        gameState.currentStreak++;
        if (gameState.currentStreak > gameState.bestStreak) {
            gameState.bestStreak = gameState.currentStreak;
        }
    } else if (handsLost > 0) {
        gameState.currentStreak = 0;
    }
    
    // Track highest win
    if (totalWinnings > gameState.highestWin) {
        gameState.highestWin = totalWinnings;
    }
    
    // Message based on result
    if (handsWon === gameState.playerHands.length && handsWon > 0) {
        showMessage(`You win all ${handsWon} hands!`, 'win');
        addToHistory(`Win +${totalWinnings}`, 'win');
    } else if (handsLost === gameState.playerHands.length && handsLost > 0) {
        showMessage('You lose all hands!', 'lose');
        addToHistory(`Loss -${gameState.currentBet}`, 'lose');
    } else {
        showMessage(`Result: ${handsWon} win, ${handsLost} loss, ${handsPush} push`, '');
    }
    
    gameState.state = GAME_STATE.GAME_OVER;
    saveStats(); // Save stats
    updateUI();
    updateButtonStates();
}

/**
 * Doubles the bet and draws exactly one more card.
 */
async function doubleBet() {
    if (gameState.state !== GAME_STATE.PLAYER_TURN) return;
    
    if (getBalanceSync() < gameState.currentBet) return;
    
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    if (currentHand.length !== 2) return;
    
    // Double the bet
    deductFromBalance(gameState.currentBet);
    gameState.currentBet *= 2;
    gameState.totalWagered += gameState.currentBet / 2;
    gameState.doubles++;
    
    // Update split bets if split
    if (gameState.splitBets.length > 0) {
        gameState.splitBets[gameState.currentHandIndex] = gameState.currentBet;
    }
    
    // Draw one card
    const card = drawCard();
    currentHand.push(card);
    
    // Show and calculate result
    renderCards();
    updateUI();
    
    const { score } = calculateHandValue(currentHand);
    
    if (score > 21) {
        // Busted - move to next hand
        gameState.playerBusts++;
        gameState.currentStreak = 0;
        finishCurrentHand();
    } else {
        // Auto move to next hand
        standGame();
    }
}

/**
 * Splits the current hand into two separate hands.
 * Split is possible when both cards have the same value.
 * Supports re-splitting up to maxSplits times.
 */
async function splitHand() {
    if (gameState.state !== GAME_STATE.PLAYER_TURN) return;
    if (gameState.playerHands.length >= gameState.maxSplits) return;
    
    if (getBalanceSync() < gameState.currentBet) return;
    
    const currentHand = gameState.playerHands[gameState.currentHandIndex];
    if (currentHand.length !== 2) return;
    
    // Check if split is possible
    const firstValue = currentHand[0].value;
    const secondValue = currentHand[1].value;
    
    // For aces or same values
    if (firstValue !== secondValue && firstValue !== 'A') return;
    
    // Track splits
    gameState.splits++;
    
    // Deduct second bet from balance
    deductFromBalance(gameState.currentBet);
    gameState.totalWagered += gameState.currentBet;
    
    // Create split bets array
    const newSplitBets = [...gameState.splitBets];
    if (gameState.currentHandIndex >= newSplitBets.length) {
        // Add new bet for this hand
        newSplitBets[gameState.currentHandIndex] = gameState.currentBet;
    }
    newSplitBets.push(gameState.currentBet);
    gameState.splitBets = newSplitBets;
    
    // Create two new hands
    const hand1 = [currentHand[0], drawCard()];
    const hand2 = [currentHand[1], drawCard()];
    
    // Insert new hand after current hand
    const newHands = [...gameState.playerHands];
    newHands.splice(gameState.currentHandIndex + 1, 0, hand2);
    newHands[gameState.currentHandIndex] = hand1;
    
    gameState.playerHands = newHands;
    
    // Update UI
    updateUI();
    renderCards();
    
    const firstHand = gameState.playerHands[gameState.currentHandIndex];
    const { score } = calculateHandValue(firstHand);
    showMessage(`Hand ${gameState.currentHandIndex + 1}: Score ${score}. Hit (H) or Stand (S)?`, '');
}

/**
 * Resets the game and clears the hands.
 */
function resetGame() {
    gameState.playerHands = [];
    gameState.dealerHand = [];
    gameState.splitBets = [];
    gameState.currentHandIndex = 0;
    gameState.state = GAME_STATE.WAITING;
    gameState.insuranceOffered = false;
    gameState.insuranceTaken = false;
    gameState.surrendered = false;
    
    renderCards();
    updateUI();
    
    // Hide insurance and surrender buttons
    const insuranceBtn = document.getElementById('insurance-btn');
    const surrenderBtn = document.getElementById('surrender-btn');
    if (insuranceBtn) insuranceBtn.style.display = 'none';
    if (surrenderBtn) surrenderBtn.style.display = 'none';
    
    showMessage('New game! Place your bet.', '');
}

/**
 * Player surrenders and loses half their bet.
 */
function surrenderGame() {
    if (gameState.state !== GAME_STATE.PLAYER_TURN) return;
    
    // Can only surrender on first hand with 2 cards
    if (gameState.playerHands.length !== 1) return;
    
    const hand = gameState.playerHands[0];
    if (hand.length !== 2) return;
    
    if (gameState.surrendered) return;
    
    // Surrender - lose half the bet
    const surrenderAmount = gameState.currentBet / 2;
    addToBalance(surrenderAmount);
    
    gameState.surrendered = true;
    gameState.losses++;
    gameState.currentStreak = 0;
    
    showMessage('Surrendered! Half bet returned.', 'lose');
    addToHistory(`Surrender -${surrenderAmount}`, 'lose');
    
    gameState.state = GAME_STATE.GAME_OVER;
    saveStats();
    updateUI();
}


/**
 * Adds an entry to the game history.
 * 
 * @param {string} text - The text to display
 * @param {string} type - The type (win, lose, push)
 */
function addToHistory(text, type) {
    const li = document.createElement('li');
    li.className = type;
    li.textContent = text;
    
    historyListEl.insertBefore(li, historyListEl.firstChild);
    
    // Keep maximum 10 entries
    while (historyListEl.children.length > 10) {
        historyListEl.removeChild(historyListEl.lastChild);
    }
}


// ==========================================================================
// LOCAL STORAGE FUNCTIONS
// ==========================================================================

/**
 * Saves game statistics to localStorage.
 */
function saveStats() {
    const stats = {
        gamesPlayed: gameState.gamesPlayed,
        wins: gameState.wins,
        losses: gameState.losses,
        pushes: gameState.pushes,
        blackjacks: gameState.blackjacks,
        playerBusts: gameState.playerBusts,
        dealerBusts: gameState.dealerBusts,
        doubles: gameState.doubles,
        splits: gameState.splits,
        highestWin: gameState.highestWin,
        totalWagered: gameState.totalWagered,
        currentStreak: gameState.currentStreak,
        bestStreak: gameState.bestStreak,
        currentBet: gameState.currentBet,
        strategyHelperEnabled: gameState.strategyHelperEnabled
    };
    localStorage.setItem('blackjackStats', JSON.stringify(stats));
}

/**
 * Loads game statistics from localStorage.
 * 
 * @returns {Object} The loaded statistics or defaults
 */
async function loadStats() {
    const savedStats = localStorage.getItem('blackjackStats');
    if (savedStats) {
        try {
            const stats = JSON.parse(savedStats);
            gameState.gamesPlayed = stats.gamesPlayed || 0;
            gameState.wins = stats.wins || 0;
            gameState.losses = stats.losses || 0;
            gameState.pushes = stats.pushes || 0;
            gameState.blackjacks = stats.blackjacks || 0;
            gameState.playerBusts = stats.playerBusts || 0;
            gameState.dealerBusts = stats.dealerBusts || 0;
            gameState.doubles = stats.doubles || 0;
            gameState.splits = stats.splits || 0;
            gameState.highestWin = stats.highestWin || 0;
            gameState.totalWagered = stats.totalWagered || 0;
            gameState.currentStreak = stats.currentStreak || 0;
            gameState.bestStreak = stats.bestStreak || 0;
            gameState.currentBet = stats.currentBet || 100;
            gameState.strategyHelperEnabled = stats.strategyHelperEnabled !== undefined ? stats.strategyHelperEnabled : true;
            
            // Update strategy toggle
            if (strategyToggleEl) {
                strategyToggleEl.checked = gameState.strategyHelperEnabled;
            }
            
            // Update bet display
            updateBetDisplay();
        } catch (e) {
            console.error('Error loading stats:', e);
        }
    }
    return await getStatsDisplay();
}

/**
 * Returns formatted stats for display.
 * 
 * @returns {Object} Object with formatted stats
 */
async function getStatsDisplay() {
    const totalGames = gameState.wins + gameState.losses + gameState.pushes;
    const winRate = totalGames > 0 ? ((gameState.wins / totalGames) * 100).toFixed(1) : 0;
    const currentBalance = await getBalance();
    const profit = currentBalance - 1000;
    
    return {
        gamesPlayed: gameState.gamesPlayed,
        wins: gameState.wins,
        losses: gameState.losses,
        pushes: gameState.pushes,
        blackjacks: gameState.blackjacks,
        playerBusts: gameState.playerBusts,
        dealerBusts: gameState.dealerBusts,
        doubles: gameState.doubles,
        splits: gameState.splits,
        highestWin: gameState.highestWin,
        totalWagered: gameState.totalWagered,
        currentStreak: gameState.currentStreak,
        bestStreak: gameState.bestStreak,
        winRate: winRate,
        profit: profit,
        balance: currentBalance
    };
}

/**
 * Resets all statistics.
 */
function resetStats() {
    gameState.gamesPlayed = 0;
    gameState.wins = 0;
    gameState.losses = 0;
    gameState.pushes = 0;
    gameState.blackjacks = 0;
    gameState.playerBusts = 0;
    gameState.dealerBusts = 0;
    gameState.doubles = 0;
    gameState.splits = 0;
    gameState.highestWin = 0;
    gameState.totalWagered = 0;
    gameState.currentStreak = 0;
    gameState.bestStreak = 0;
    resetBalance(); // Reset shared balance
    gameState.currentBet = 100;
    saveStats();
    updateUI();
    updateStatsModal();
    showMessage('Statistics reset!', '');
}


// ==========================================================================
// STATS MODAL FUNCTIONS
// ==========================================================================

let statsModal, statsModalOverlay, statsModalContent;

/**
 * Shows the stats modal.
 */
function showStatsModal() {
    updateStatsModal();
    statsModalOverlay.style.display = 'flex';
    statsModal.style.display = 'block';
}

/**
 * Closes the stats modal.
 */
function closeStatsModal() {
    statsModalOverlay.style.display = 'none';
    statsModal.style.display = 'none';
}

/**
 * Updates the stats in the modal.
 */
async function updateStatsModal() {
    const stats = await getStatsDisplay();
    
    // First sync balance to ensure it's up to date
    syncBalance();
    
    document.getElementById('stats-total-games').textContent = stats.gamesPlayed;
    document.getElementById('stats-wins').textContent = stats.wins;
    document.getElementById('stats-losses').textContent = stats.losses;
    document.getElementById('stats-pushes').textContent = stats.pushes;
    document.getElementById('stats-blackjacks').textContent = stats.blackjacks;
    document.getElementById('stats-player-busts').textContent = stats.playerBusts;
    document.getElementById('stats-dealer-busts').textContent = stats.dealerBusts;
    document.getElementById('stats-doubles').textContent = stats.doubles;
    document.getElementById('stats-splits').textContent = stats.splits;
    document.getElementById('stats-highest-win').textContent = stats.highestWin;
    document.getElementById('stats-total-wagered').textContent = stats.totalWagered;
    document.getElementById('stats-current-streak').textContent = stats.currentStreak;
    document.getElementById('stats-best-streak').textContent = stats.bestStreak;
    document.getElementById('stats-winrate').textContent = `${stats.winRate}%`;
    document.getElementById('stats-profit').textContent = stats.profit >= 0 ? `+${stats.profit}` : stats.profit;
    document.getElementById('stats-profit').className = stats.profit >= 0 ? 'stat-value positive' : 'stat-value negative';
    document.getElementById('stats-balance').textContent = Math.round(stats.balance);
}

/**
 * Initializes the stats modal.
 */
function initializeStatsModal() {
    statsModal = document.getElementById('stats-modal');
    statsModalOverlay = document.getElementById('stats-modal-overlay');
    
    // Event listeners for closing
    document.getElementById('close-stats-modal').addEventListener('click', closeStatsModal);
    document.getElementById('reset-stats-btn').addEventListener('click', resetStats);
    
    // Click outside modal closes it
    statsModalOverlay.addEventListener('click', function(e) {
        if (e.target === statsModalOverlay) {
            closeStatsModal();
        }
    });
    
    // Escape key closes modal
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && statsModal.style.display === 'block') {
            closeStatsModal();
        }
    });
}


// ==========================================================================
// EXPORT FOR GLOBAL USE
// ==========================================================================

// All main functions are globally available for HTML onclick attributes
window.changeBet = changeBet;
window.setBet = setBet;
window.setCustomBet = setCustomBet;
window.halfBet = halfBet;
window.doubleCurrentBet = doubleCurrentBet;
window.setAllIn = setAllIn;
window.dealGame = dealGame;
window.hitCard = hitCard;
window.standGame = standGame;
window.doubleBet = doubleBet;
window.splitHand = splitHand;
window.resetGame = resetGame;
window.showStatsModal = showStatsModal;
window.closeStatsModal = closeStatsModal;
window.resetStats = resetStats;
window.takeInsurance = takeInsurance;
window.surrenderGame = surrenderGame;
