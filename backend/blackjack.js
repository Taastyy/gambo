// Blackjack game logic for the backend

const SUITS = ['♥', '♦', '♠', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function getNumericValue(value) {
    if (value === 'A') return 11;
    if (['J', 'Q', 'K'].includes(value)) return 10;
    return parseInt(value);
}

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value, numericValue: getNumericValue(value), color: (suit === '♥' || suit === '♦') ? 'red' : 'black' });
        }
    }
    return deck;
}

function createShoe(numDecks = 6) {
    const shoe = [];
    for(let i=0; i<numDecks; i++) {
        shoe.push(...createDeck());
    }
    for (let i = shoe.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
    }
    return shoe;
}

function calculateHandValue(hand) {
    let score = 0;
    let aceCount = 0;
    for (const card of hand) {
        score += card.numericValue;
        if (card.value === 'A') aceCount++;
    }
    while (score > 21 && aceCount > 0) {
        score -= 10;
        aceCount--;
    }
    return score;
}

function isBlackjack(hand) {
    return hand.length === 2 && calculateHandValue(hand) === 21;
}

const activeGames = new Map();

function setupBlackjackRoutes(app, db, authenticateToken) {
    app.post('/api/blackjack/start', authenticateToken, (req, res) => {
        let { bet } = req.body;
        bet = parseFloat(bet);
        if (isNaN(bet) || bet <= 0) return res.status(400).json({error: 'Invalid bet'});
        
        db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
            if(err || !row) return res.status(500).json({error: 'DB error'});
            if(row.balance < bet) return res.status(400).json({error: 'Insufficient balance'});

            const shoe = createShoe();
            const playerHand = [shoe.pop(), shoe.pop()];
            const dealerHand = [shoe.pop(), shoe.pop()];

            const newBalance = Math.round(row.balance - bet);

            db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
                const game = {
                    bet,
                    bets: [bet], // Array for split hands
                    shoe,
                    playerHands: [playerHand],
                    dealerHand,
                    currentHandIndex: 0,
                    insuranceTaken: false,
                    insuranceBet: 0,
                    state: 'player_turn',
                    payouts: 0
                };
                
                // Fast path: blackjack check
                if (isBlackjack(playerHand)) {
                    if (dealerHand[0].value !== 'A' && dealerHand[0].numericValue !== 10) {
                        // Player wins 3:2 immediately
                        game.state = 'game_over';
                        game.payouts = bet * 2.5;
                        db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [game.payouts, req.user.id], () => {
                            res.json({ success: true, gameState: getPublicState(game, true), balance: newBalance + game.payouts });
                        });
                        return;
                    }
                }

                activeGames.set(req.user.id, game);
                res.json({ success: true, gameState: getPublicState(game, false), balance: newBalance });
            });
        });
    });

    // Helper to get public state
    function getPublicState(game, showDealerDeck = false) {
        return {
            playerHands: game.playerHands,
            dealerHand: showDealerDeck || game.state === 'dealer_turn' || game.state === 'game_over' 
                ? game.dealerHand 
                : [game.dealerHand[0], { hidden: true }],
            currentHandIndex: game.currentHandIndex,
            state: game.state,
            payouts: game.payouts,
            bets: game.bets
        };
    }

    // Process Dealer Turn
    function processDealerTurn(game, userId, db, res) {
        game.state = 'dealer_turn';
        let dealerScore = calculateHandValue(game.dealerHand);
        
        // Dealer hits on soft 17 (or stands on 17) -> standard rules usually stand on all 17s
        while (dealerScore < 17) {
            game.dealerHand.push(game.shoe.pop());
            dealerScore = calculateHandValue(game.dealerHand);
        }

        const dealerBust = dealerScore > 21;
        const dealerBj = isBlackjack(game.dealerHand);
        let totalPayout = 0;

        // resolve insurance
        if (game.insuranceTaken && dealerBj) {
            totalPayout += game.insuranceBet * 3; // 2:1 payout means you get 3x your insurance bet back
        }

        game.playerHands.forEach((hand, idx) => {
            const bet = game.bets[idx];
            const score = calculateHandValue(hand);
            const handBj = isBlackjack(hand);

            if (score > 21) {
                // bust, lost
            } else if (handBj && !dealerBj) {
                totalPayout += bet * 2.5; // 3:2 payout
            } else if (!handBj && dealerBj) {
                // dealer blackjack, player lost
            } else if (handBj && dealerBj) {
                totalPayout += bet; // push
            } else if (dealerBust) {
                totalPayout += bet * 2;
            } else if (score > dealerScore) {
                totalPayout += bet * 2;
            } else if (score === dealerScore) {
                totalPayout += bet; // push
            }
        });

        game.payouts = totalPayout;
        game.state = 'game_over';
        activeGames.delete(userId);

        db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
            if (err || !row) return res.status(500).json({error: 'DB error'});
            const newBalance = Math.round(row.balance + totalPayout);
            db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId], () => {
                res.json({ success: true, gameState: getPublicState(game, true), balance: newBalance });
            });
        });
    }

    app.post('/api/blackjack/action', authenticateToken, (req, res) => {
        const game = activeGames.get(req.user.id);
        if (!game || game.state !== 'player_turn') return res.status(400).json({error: 'No active game'});

        const { action } = req.body;
        const currentHand = game.playerHands[game.currentHandIndex];

        if (action === 'insurance') {
            if (game.dealerHand[0].value !== 'A' || game.playerHands[0].length !== 2 || game.currentHandIndex !== 0) {
                return res.status(400).json({error: 'Insurance not allowed'});
            }
            const insuranceCost = game.bets[0] / 2;
            db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
                if (row.balance < insuranceCost) return res.status(400).json({error: 'Insufficient balance'});
                db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [insuranceCost, req.user.id], () => {
                    game.insuranceTaken = true;
                    game.insuranceBet = insuranceCost;
                    if (isBlackjack(game.dealerHand)) {
                        processDealerTurn(game, req.user.id, db, res);
                    } else {
                        res.json({ success: true, gameState: getPublicState(game), balance: row.balance - insuranceCost });
                    }
                });
            });
            return;
        }

        if (action === 'hit') {
            currentHand.push(game.shoe.pop());
            if (calculateHandValue(currentHand) >= 21) {
                // Auto stand/bust
                game.currentHandIndex++;
                if (game.currentHandIndex >= game.playerHands.length) {
                    processDealerTurn(game, req.user.id, db, res);
                    return;
                }
            }
            return res.json({ success: true, gameState: getPublicState(game) });
        }

        if (action === 'stand') {
            game.currentHandIndex++;
            if (game.currentHandIndex >= game.playerHands.length) {
                processDealerTurn(game, req.user.id, db, res);
                return;
            }
            return res.json({ success: true, gameState: getPublicState(game) });
        }

        if (action === 'double') {
            if (currentHand.length !== 2) return res.status(400).json({error: 'Double not allowed'});
            const bet = game.bets[game.currentHandIndex];
            db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
                if (row.balance < bet) return res.status(400).json({error: 'Insufficient balance'});
                db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [bet, req.user.id], () => {
                    game.bets[game.currentHandIndex] *= 2;
                    currentHand.push(game.shoe.pop());
                    game.currentHandIndex++;
                    if (game.currentHandIndex >= game.playerHands.length) {
                        processDealerTurn(game, req.user.id, db, res);
                    } else {
                        res.json({ success: true, gameState: getPublicState(game), balance: row.balance - bet });
                    }
                });
            });
            return;
        }

        if (action === 'split') {
            if (currentHand.length !== 2) return res.status(400).json({error: 'Cannot split'});
            // Simple split rule logic
            const bet = game.bets[game.currentHandIndex];
            db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
                if (row.balance < bet) return res.status(400).json({error: 'Insufficient balance'});
                db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [bet, req.user.id], () => {
                    const card2 = currentHand.pop();
                    const newHand = [card2, game.shoe.pop()];
                    currentHand.push(game.shoe.pop());
                    
                    game.playerHands.splice(game.currentHandIndex + 1, 0, newHand);
                    game.bets.splice(game.currentHandIndex + 1, 0, bet);
                    
                    res.json({ success: true, gameState: getPublicState(game), balance: row.balance - bet });
                });
            });
            return;
        }

        if (action === 'surrender') {
            if (currentHand.length !== 2 || game.playerHands.length !== 1) return res.status(400).json({error: 'Surrender not allowed'});
            const surrenderReturn = game.bets[0] / 2;
            game.state = 'game_over';
            game.payouts = surrenderReturn;
            activeGames.delete(req.user.id);
            db.get('SELECT balance FROM users WHERE id = ?', [req.user.id], (err, row) => {
                const newBalance = Math.round(row.balance + surrenderReturn);
                db.run('UPDATE users SET balance = ? WHERE id = ?', [newBalance, req.user.id], () => {
                    res.json({ success: true, gameState: getPublicState(game, true), balance: newBalance });
                });
            });
            return;
        }

        res.status(400).json({error: 'Unknown action'});
    });
}

module.exports = setupBlackjackRoutes;
