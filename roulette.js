/**
 * ==========================================================================
 * Roulette Game JavaScript - Revamped Version
 * 
 * A fully functional European Roulette game with all classic
 * betting options and features. This game offers:
 * - European Roulette (single zero)
 * - All classic bet types: Straight, Split, Street, Corner, Line, Dozen, Column
 * - Even money bets: Red/Black, Even/Odd, Low/High
 * - Canvas-based wheel rendering with smooth animations
 * - Balance and statistics tracking
 * - Game history
 * - Responsive design
 * 
 * @author Roulette Game
 * @version 2.0.0
 * @date 2026
 * ==========================================================================
 */

// ==========================================================================
// GLOBAL VARIABLES AND CONSTANTS
// ==========================================================================

/**
 * Roulette numbers in the order they appear on the wheel
 * European roulette sequence
 */
const ROULETTE_WHEEL = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

/**
 * Red numbers on the roulette wheel
 */
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

/**
 * Black numbers on the roulette wheel
 */
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

/**
 * Payout ratios for different bet types
 */
const PAYOUTS = {
    straight: 35,      // 1 number
    split: 17,         // 2 numbers
    street: 11,        // 3 numbers
    corner: 8,         // 4 numbers
    line: 5,           // 6 numbers
    dozen: 2,          // 12 numbers
    column: 2,         // 12 numbers
    red: 1,            // 18 numbers
    black: 1,          // 18 numbers
    even: 1,           // 18 numbers
    odd: 1,            // 18 numbers
    low: 1,            // 1-18
    high: 1            // 19-36
};

/**
 * Game state constants
 */
const GAME_STATE = {
    WAITING: 'waiting',       // Waiting for bets
    SPINNING: 'spinning',     // Wheel is spinning
    GAME_OVER: 'game_over'    // Game ended
};

// ==========================================================================
// GAME STATE
// ==========================================================================

let gameState = {
    currentBet: 100,              // Current bet amount for new bets
    currentBets: {},              // Current placed bets { type: amount }
    lastBets: {},                 // Last placed bets for repetition
    winningNumber: null,          // The winning number
    state: GAME_STATE.WAITING,    // Current game state
    isSpinning: false,            // Whether wheel is spinning
    
    // Statistics
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    highestWin: 0,
    totalWinnings: 0,
    totalLosses: 0,
    
    // Wheel state
    wheelRotation: 0,
    ballRotation: 0
};

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================

let balanceEl, currentBetEl, totalBetEl, winningNumberEl;
let gameMessageEl, spinBtn, historyListEl;
let statsModal, statsModalOverlay;
let wheelCanvas, wheelCtx, rouletteBall;

// ==========================================================================
// INITIALIZATION
// ==========================================================================

/**
 * Initializes the game when the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    initializeEventListeners();
    initializeStatsModal();
    initializeRouletteTable();
    initializeWheel();
    loadStats();
    syncBalance(); // Sync balance display with localStorage
    updateUI();
    showMessage('Willkommen! Setzen Sie Ihre Einsätze und klicken Sie auf "Drehen"', '');
});

/**
 * References all required DOM elements for easy access.
 */
function initializeElements() {
    balanceEl = document.getElementById('balance');
    currentBetEl = document.getElementById('current-bet');
    totalBetEl = document.getElementById('total-bet-amount');
    winningNumberEl = document.getElementById('winning-text');
    gameMessageEl = document.getElementById('game-message');
    spinBtn = document.getElementById('spin-btn');
    historyListEl = document.getElementById('history-list');
    wheelCanvas = document.getElementById('wheel-canvas');
    wheelCtx = wheelCanvas.getContext('2d');
    rouletteBall = document.getElementById('roulette-ball');
}

/**
 * Initializes all event listeners.
 */
function initializeEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (gameState.state === GAME_STATE.WAITING) {
            switch(e.key.toLowerCase()) {
                case 's':
                    spinWheel();
                    break;
                case 'c':
                    clearAllBets();
                    break;
                case 'r':
                    repeatLastBet();
                    break;
            }
        }
    });
}

/**
 * Initializes the roulette table with numbers.
 */
function initializeRouletteTable() {
    const numbersArea = document.getElementById('numbers-area');
    numbersArea.innerHTML = '';
    
    // European roulette table layout: 3 columns x 12 rows
    const tableRows = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
        [13, 14, 15],
        [16, 17, 18],
        [19, 20, 21],
        [22, 23, 24],
        [25, 26, 27],
        [28, 29, 30],
        [31, 32, 33],
        [34, 35, 36]
    ];
    
    // Create rows with numbers
    tableRows.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'number-row';
        
        row.forEach(num => {
            const cell = document.createElement('div');
            cell.className = `number-cell ${getNumberColor(num)}`;
            cell.textContent = num;
            cell.dataset.number = num;
            cell.onclick = () => placeBet('straight', num);
            rowDiv.appendChild(cell);
        });
        
        numbersArea.appendChild(rowDiv);
    });
}

/**
 * Gets the color of a roulette number.
 */
function getNumberColor(num) {
    if (num === 0) return 'green';
    return RED_NUMBERS.includes(num) ? 'red' : 'black';
}

/**
 * Gets the RGB color value for a roulette number.
 */
function getNumberColorRGB(num) {
    if (num === 0) {
        return { r: 34, g: 139, b: 34 }; // Forest green
    }
    if (RED_NUMBERS.includes(num)) {
        return { r: 196, g: 30, b: 58 }; // Cardinal red
    }
    return { r: 26, g: 26, b: 26 }; // Almost black
}

/**
 * Draws the roulette wheel on canvas.
 */
function drawWheel() {
    const canvas = wheelCanvas;
    const ctx = wheelCtx;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply rotation
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(gameState.wheelRotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
    
    // Draw outer ring (metallic chrome effect)
    const outerGradient = ctx.createRadialGradient(centerX, centerY, radius - 30, centerX, centerY, radius);
    outerGradient.addColorStop(0, '#c0c0c0');
    outerGradient.addColorStop(0.3, '#ffffff');
    outerGradient.addColorStop(0.5, '#e8e8e8');
    outerGradient.addColorStop(0.7, '#a0a0a0');
    outerGradient.addColorStop(1, '#606060');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = outerGradient;
    ctx.fill();
    
    // Draw outer gold trim
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // Draw main wheel body (dark wood/metal look)
    const wheelGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius - 15);
    wheelGradient.addColorStop(0, '#3d3d3d');
    wheelGradient.addColorStop(0.5, '#2a2a2a');
    wheelGradient.addColorStop(1, '#1a1a1a');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 12, 0, Math.PI * 2);
    ctx.fillStyle = wheelGradient;
    ctx.fill();
    
    // Draw segments
    const anglePerNumberDeg = 360 / ROULETTE_WHEEL.length;
    const segmentWidth = (2 * Math.PI) / ROULETTE_WHEEL.length;
    
    ROULETTE_WHEEL.forEach((num, index) => {
        const startAngle = index * segmentWidth - Math.PI / 2;
        const endAngle = startAngle + segmentWidth;
        const color = getNumberColorRGB(num);
        
        // Draw segment with 3D effect
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius - 20, startAngle, endAngle);
        ctx.closePath();
        
        // Create gradient for segment (metallic look)
        const segmentGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius - 20);
        segmentGradient.addColorStop(0, `rgb(${Math.min(255, color.r + 60)}, ${Math.min(255, color.g + 60)}, ${Math.min(255, color.b + 60)})`);
        segmentGradient.addColorStop(0.7, `rgb(${color.r}, ${color.g}, ${color.b})`);
        segmentGradient.addColorStop(1, `rgb(${Math.max(0, color.r - 40)}, ${Math.max(0, color.g - 40)}, ${Math.max(0, color.b - 40)})`);
        
        ctx.fillStyle = segmentGradient;
        ctx.fill();
        
        // Draw separator lines (chrome effect)
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(startAngle) * (radius - 20),
            centerY + Math.sin(startAngle) * (radius - 20)
        );
        ctx.strokeStyle = '#c0c0c0';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw number text
        if (num !== 0) {
            const textRadius = radius - 55;
            const textAngle = startAngle + segmentWidth / 2;
            const textX = centerX + Math.cos(textAngle) * textRadius;
            const textY = centerY + Math.sin(textAngle) * textRadius;
            
            ctx.save();
            ctx.translate(textX, textY);
            ctx.rotate(textAngle + Math.PI / 2);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(num.toString(), 0, 0);
            ctx.restore();
        }
    });
    
    // Draw zero segment (larger, green)
    const zeroGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 70);
    zeroGradient.addColorStop(0, '#2ecc71');
    zeroGradient.addColorStop(0.6, '#27ae60');
    zeroGradient.addColorStop(1, '#1e8449');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, 65, 0, Math.PI * 2);
    ctx.fillStyle = zeroGradient;
    ctx.fill();
    
    // Zero border
    ctx.beginPath();
    ctx.arc(centerX, centerY, 65, 0, Math.PI * 2);
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw zero text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText('0', centerX, centerY);
    
    ctx.restore();
    
    // Draw ball track (outer ring with chrome effect)
    const trackRadius = radius - 35;
    ctx.beginPath();
    ctx.arc(centerX, centerY, trackRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(192, 192, 192, 0.4)';
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Inner ball track line
    ctx.beginPath();
    ctx.arc(centerX, centerY, trackRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Outer ball track line
    ctx.beginPath();
    ctx.arc(centerX, centerY, trackRadius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(192, 192, 192, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

/**
 * Initializes the visual wheel display.
 */
function initializeWheel() {
    drawWheel();
}

/**
 * Updates the wheel animation frame.
 */
function updateWheelAnimation() {
    drawWheel();
    if (gameState.isSpinning) {
        requestAnimationFrame(updateWheelAnimation);
    }
}

// ==========================================================================
// BETTING FUNCTIONS
// ==========================================================================

/**
 * Places a bet.
 */
function placeBet(type, value, secondValue = null) {
    if (gameState.state !== GAME_STATE.WAITING) return;
    if (getBalanceSync() < gameState.currentBet) {
        showMessage('Nicht genügend Guthaben!', 'lose');
        return;
    }
    
    let betKey;
    switch(type) {
        case 'split':
            betKey = `${type}_${value}_${secondValue}`;
            break;
        case 'street':
            betKey = `${type}_${value}`; // value is the starting number
            break;
        case 'corner':
            betKey = `${type}_${value}`; // value is the top-left number
            break;
        case 'line':
            betKey = `${type}_${value}`; // value is the row index
            break;
        default:
            betKey = `${type}_${value}`;
    }
    
    if (!gameState.currentBets[betKey]) {
        gameState.currentBets[betKey] = 0;
    }
    
    gameState.currentBets[betKey] += gameState.currentBet;
    deductFromBalance(gameState.currentBet);
    
    updateUI();
    showMessage(`Einsatz auf ${formatBetType(type, value, secondValue)}: ${gameState.currentBets[betKey]}`, '');
}

/**
 * Formats the bet type for display.
 */
function formatBetType(type, value, secondValue = null) {
    const typeNames = {
        straight: `Zahl ${value}`,
        split: `Split ${value}/${secondValue}`,
        street: `Street ${value}-${value + 2}`,
        corner: `Ecke ${value}-${value + 3}`,
        line: `Linie ${value}-${value + 5}`,
        dozen: value === 1 ? '1. Dutzend (1-12)' : value === 2 ? '2. Dutzend (13-24)' : '3. Dutzend (25-36)',
        column: value === 1 ? '1. Kolonne' : value === 2 ? '2. Kolonne' : '3. Kolonne',
        red: 'Rot',
        black: 'Schwarz',
        even: 'Gerade',
        odd: 'Ungerade',
        low: 'Niedrig (1-18)',
        high: 'Hoch (19-36)'
    };
    return typeNames[type] || type;
}

/**
 * Adds to the current bet amount.
 */
function addBet(amount) {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    gameState.currentBet = Math.max(1, gameState.currentBet + amount);
    updateBetDisplay();
}

/**
 * Changes the current bet by the specified amount.
 */
function changeBet(amount) {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    const newBet = gameState.currentBet + amount;
    
    if (newBet >= 1) {
        gameState.currentBet = newBet;
        updateBetDisplay();
    }
}

/**
 * Sets a custom bet from the input field.
 */
function setCustomBet(value) {
    const amount = parseInt(value) || 1;
    gameState.currentBet = Math.max(1, amount);
    updateBetDisplay();
}

/**
 * Sets the bet to half of the player's balance.
 */
function halfBet() {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    const halfBalance = Math.floor(getBalanceSync() / 2);
    gameState.currentBet = Math.max(1, halfBalance);
    updateBetDisplay();
}

/**
 * Doubles the current bet.
 */
function doubleBet() {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    gameState.currentBet = gameState.currentBet * 2;
    gameState.currentBet = Math.max(gameState.currentBet, 1);
    updateBetDisplay();
}

/**
 * Sets the bet to the player's entire balance.
 */
function setAllIn() {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    gameState.currentBet = getBalanceSync();
    updateBetDisplay();
}

/**
 * Clears all current bets.
 */
function clearAllBets() {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    // Return all bet amounts to balance
    Object.values(gameState.currentBets).forEach(amount => {
        addToBalance(amount);
    });
    syncBalance();
    
    gameState.currentBets = {};
    updateUI();
    showMessage('Alle Einsätze gelöscht', '');
}

/**
 * Repeats the last bet.
 */
function repeatLastBet() {
    if (gameState.state !== GAME_STATE.WAITING) return;
    if (Object.keys(gameState.lastBets).length === 0) {
        showMessage('Keine vorherigen Einsätze zum Wiederholen', '');
        return;
    }
    
    const totalLastBet = Object.values(gameState.lastBets).reduce((sum, val) => sum + val, 0);
    
    if (getBalanceSync() < totalLastBet) {
        showMessage('Nicht genügend Guthaben!', 'lose');
        return;
    }
    
    gameState.currentBets = { ...gameState.lastBets };
    deductFromBalance(totalLastBet);
    
    updateUI();
    showMessage('Einsätze wiederholt', '');
}

/**
 * Updates the bet display.
 */
function updateBetDisplay() {
    const betInput = document.getElementById('bet-input');
    if (betInput) {
        betInput.value = gameState.currentBet;
    }
    currentBetEl.textContent = gameState.currentBet;
}

// ==========================================================================
// GAME LOGIC
// ==========================================================================

/**
 * Spins the roulette wheel with realistic ball animation.
 * The ball rotates counter-clockwise and lands on the winning number.
 */
function spinWheel() {
    if (gameState.state !== GAME_STATE.WAITING) return;
    
    if (Object.keys(gameState.currentBets).length === 0) {
        showMessage('Bitte setzen Sie zuerst einen Einsatz!', '');
        return;
    }
    
    gameState.state = GAME_STATE.SPINNING;
    gameState.isSpinning = true;
    spinBtn.disabled = true;
    
    // Save current bets for repetition
    gameState.lastBets = { ...gameState.currentBets };
    
    showMessage('Roulette dreht sich...', 'spinning');
    
    // Reset winning number display
    const winningCircle = document.getElementById('winning-circle');
    winningCircle.className = 'winning-number-circle';
    winningCircle.textContent = '';
    winningCircle.style.opacity = '0';
    winningCircle.style.transform = 'scale(0.5)';
    winningNumberEl.textContent = '';
    winningNumberEl.className = '';
    
    // Generate random winning number
    const winningIndex = Math.floor(Math.random() * ROULETTE_WHEEL.length);
    gameState.winningNumber = ROULETTE_WHEEL[winningIndex];
    
    // Wheel parameters
    const anglePerNumberDeg = 360 / ROULETTE_WHEEL.length; // ~9.73° pro Zahl
    const anglePerNumberRad = 2 * Math.PI / ROULETTE_WHEEL.length; // ~0.17 rad pro Zahl
    const canvasSize = wheelCanvas.width;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const ballTrackRadius = (canvasSize / 2) - 35;
    
    // Get ball element dimensions for proper centering
    const ballWidth = rouletteBall.offsetWidth || 18;
    const ballOffset = ballWidth / 2;
    
    // Calculate the angle of the winning number on the wheel (in degrees)
    // In drawWheel, numbers are drawn starting from -Math.PI/2 (270°/top)
    // with index 0 being number 0
    // So winning number at index winningIndex has angle: winningIndex * anglePerNumberDeg
    // and this angle is relative to the -90° (270°) start position
    const winningNumberAngleDeg = winningIndex * anglePerNumberDeg;
    
    // The wheel pointer is at the TOP (270°)
    // We want the winning number's CENTER to be at the pointer
    // The center of a segment is at anglePerNumberDeg/2 offset
    const segmentCenterOffset = anglePerNumberDeg / 2;
    const winningNumberCenterAngle = winningNumberAngleDeg + segmentCenterOffset;
    
    // Calculate target rotation so winning number is at top (270°)
    // Current rotation + extra spins + correction to bring winning number to top
    const currentRotation = gameState.wheelRotation % 360;
    const extraSpins = 1800; // 5 full spins
    const correctionAngle = 270 - winningNumberCenterAngle;
    const targetWheelRotation = currentRotation + extraSpins + correctionAngle;
    
    // Show ball
    rouletteBall.style.display = 'block';
    
    // Animation timing
    const wheelSpinDuration = 5000;
    const ballSpinDuration = 4500;
    const ballStartDelay = 200;
    const wheelStartTime = Date.now();
    const ballStartTime = wheelStartTime + ballStartDelay;
    
    // Show pointer
    const wheelPointer = document.getElementById('wheel-pointer');
    wheelPointer.style.opacity = '1';
    
    // Initial ball position (starts at top, will move counter-clockwise)
    const ballStartAngle = 270; // Ball starts at top position
    
    // Calculate ball rotation
    // The wheel rotates clockwise, ball rotates counter-clockwise relative to wheel
    // Ball should end up at the winning number position
    // Since winning number is at centerAngle, ball needs to be there too
    const ballEndAngle = winningNumberCenterAngle;
    
    // Ball rotates counter-clockwise (negative direction)
    // We'll animate from ballStartAngle to ballEndAngle in counter-clockwise direction
    // Calculate the counter-clockwise distance
    let ballRotationDistance;
    if (ballEndAngle >= ballStartAngle) {
        // Counter-clockwise wrap-around: 360 -> 0
        ballRotationDistance = -(360 - (ballEndAngle - ballStartAngle));
    } else {
        ballRotationDistance = -(ballStartAngle - ballEndAngle);
    }
    
    // Add extra counter-clockwise rotations for realism
    const extraBallRotations = -1440; // 4 full counter-clockwise rotations
    const totalBallRotation = ballRotationDistance + extraBallRotations;
    
    // Animation loop
    const animate = () => {
        const now = Date.now();
        const wheelElapsed = now - wheelStartTime;
        const wheelProgress = Math.min(wheelElapsed / wheelSpinDuration, 1);
        
        // Wheel rotation with easeOut
        const wheelEaseOut = 1 - Math.pow(1 - wheelProgress, 3);
        const currentWheelRotation = (targetWheelRotation - 1800) + (1800 * wheelEaseOut);
        gameState.wheelRotation = currentWheelRotation;
        drawWheel();
        
        // Ball animation
        if (now >= ballStartTime) {
            const ballElapsed = now - ballStartTime;
            const ballProgressTime = Math.min(ballElapsed / ballSpinDuration, 1);
            
            // Ball easeOut - starts fast, slows down
            const ballEaseOut = 1 - Math.pow(1 - ballProgressTime, 3);
            
            // Current ball angle in degrees (counter-clockwise from top)
            // Start at 270°, rotate counter-clockwise
            const currentBallAngle = ballStartAngle + (ballRotationDistance + extraBallRotations) * ballEaseOut;
            
            // Convert to radians for position calculation
            const ballAngleRad = currentBallAngle * Math.PI / 180;
            
            // Calculate ball position on the track
            const ballX = centerX + Math.cos(ballAngleRad) * ballTrackRadius;
            const ballY = centerY + Math.sin(ballAngleRad) * ballTrackRadius;
            
            // Position ball element (center it with offset)
            rouletteBall.style.left = `${ballX - ballOffset}px`;
            rouletteBall.style.top = `${ballY - ballOffset}px`;
        }
        
        // Pulse pointer
        const pulseIntensity = 1 + Math.sin(wheelElapsed * 0.01) * 0.1;
        wheelPointer.style.transform = `translateX(-50%) scale(${pulseIntensity})`;
        
        if (wheelProgress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Spin complete
            wheelPointer.style.transform = 'translateX(-50%) scale(1)';
            gameState.wheelRotation = targetWheelRotation % 360;
            
            // Hide ball
            setTimeout(() => {
                rouletteBall.style.display = 'none';
            }, 500);
            
            finalizeSpin();
        }
    };
    
    requestAnimationFrame(animate);
    
    function finalizeSpin() {
        gameState.isSpinning = false;
        gameState.wheelRotation = gameState.wheelRotation % 360;
        drawWheel();
        
        calculateResults();
    }
}

/**
 * Calculates the game results.
 */
function calculateResults() {
    const winningNum = gameState.winningNumber;
    const winningColor = getNumberColor(winningNum);
    let totalWin = 0;
    let totalBet = 0;
    let totalProfit = 0;
    
    // Calculate winnings for each bet
    Object.entries(gameState.currentBets).forEach(([betKey, amount]) => {
        totalBet += amount;
        const parts = betKey.split('_');
        const type = parts[0];
        let value = parts[1];
        let secondValue = parts[2];
        
        let won = false;
        
        switch (type) {
            case 'straight':
                won = parseInt(value) === winningNum;
                break;
            case 'split':
                won = parseInt(value) === winningNum || parseInt(secondValue) === winningNum;
                break;
            case 'street':
                const streetStart = parseInt(value);
                won = winningNum >= streetStart && winningNum <= streetStart + 2 && winningNum !== 0;
                break;
            case 'corner':
                const cornerStart = parseInt(value);
                won = winningNum >= cornerStart && winningNum <= cornerStart + 3 && winningNum !== 0;
                break;
            case 'line':
                const lineStart = parseInt(value);
                won = winningNum >= lineStart && winningNum <= lineStart + 5 && winningNum !== 0;
                break;
            case 'dozen':
                const dozen = parseInt(value);
                if (dozen === 1) won = winningNum >= 1 && winningNum <= 12;
                else if (dozen === 2) won = winningNum >= 13 && winningNum <= 24;
                else won = winningNum >= 25 && winningNum <= 36;
                break;
            case 'column':
                const col = parseInt(value);
                const colNumbers = [[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
                                   [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
                                   [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]];
                won = colNumbers[col - 1].includes(winningNum);
                break;
            case 'red':
                won = winningColor === 'red';
                break;
            case 'black':
                won = winningColor === 'black';
                break;
            case 'even':
                won = winningNum !== 0 && winningNum % 2 === 0;
                break;
            case 'odd':
                won = winningNum % 2 === 1;
                break;
            case 'low':
                won = winningNum >= 1 && winningNum <= 18;
                break;
            case 'high':
                won = winningNum >= 19 && winningNum <= 36;
                break;
        }
        
        if (won) {
            const payout = amount + (amount * PAYOUTS[type]);
            totalWin += payout;
            totalProfit += amount * PAYOUTS[type];
        } else {
            totalProfit -= amount;
        }
    });
    
    // Update balance
    addToBalance(totalWin);
    
    // Update statistics
    gameState.gamesPlayed++;
    
    if (totalProfit > 0) {
        gameState.wins++;
        gameState.totalWinnings += totalProfit;
        if (totalProfit > gameState.highestWin) {
            gameState.highestWin = totalProfit;
        }
        showMessage(`Gewonnen! +${totalProfit}`, 'win');
    } else {
        gameState.losses++;
        gameState.totalLosses += Math.abs(totalProfit);
        showMessage(`Verloren! -${Math.abs(totalProfit)}`, 'lose');
    }
    
    // Add to history
    addToHistory(winningNum, totalProfit);
    
    // Save stats
    saveStats();
    
    // Update UI
    gameState.state = GAME_STATE.GAME_OVER;
    
    // Display winning number with animation
    displayWinningNumber(winningNum, winningColor, totalProfit > 0);
    
    updateUI();
    
    // Reset for next game
    setTimeout(() => {
        if (getBalanceSync() > 0) {
            gameState.state = GAME_STATE.WAITING;
            gameState.currentBets = {};
            spinBtn.disabled = false;
            showMessage('Nächste Runde! Setzen Sie Ihre Einsätze.', '');
        } else {
            showMessage('Kein Guthaben mehr! Spiel vorbei.', 'lose');
        }
    }, 4000);
}

/**
 * Displays the winning number with animation.
 */
function displayWinningNumber(number, color, isWin) {
    const winningCircle = document.getElementById('winning-circle');
    const winningText = document.getElementById('winning-text');
    
    console.log('Gewinnzahl:', number, 'Farbe:', color, 'isWin:', isWin);
    
    winningCircle.textContent = number;
    winningCircle.className = `winning-number-circle ${color} show`;
    winningText.textContent = `Gewinnzahl: ${number}`;
    winningText.className = isWin ? 'show win' : 'show lose';
    
    // Add glow effect
    winningCircle.style.boxShadow = `0 0 30px rgba(255, 215, 0, 0.5), 0 0 60px rgba(255, 215, 0, 0.3)`;
    
    // Remove glow after animation
    setTimeout(() => {
        winningCircle.style.boxShadow = '';
    }, 2000);
}

// ==========================================================================
// UI UPDATES
// ==========================================================================

/**
 * Updates the entire user interface based on the game state.
 */
function updateUI() {
    // Update balance display using syncBalance
    syncBalance();
    
    currentBetEl.textContent = gameState.currentBet;
    
    // Calculate and display total bet
    const totalBet = Object.values(gameState.currentBets).reduce((sum, val) => sum + val, 0);
    totalBetEl.textContent = totalBet;
    
    // Update statistics display
    document.getElementById('total-wins').textContent = gameState.wins;
    document.getElementById('total-games').textContent = gameState.gamesPlayed;
    
    // Update Your Bets display
    updateYourBetsDisplay();
    
    // Button states
    spinBtn.disabled = gameState.state !== GAME_STATE.WAITING;
}

/**
 * Updates the Your Bets display with current bets and their colors.
 */
function updateYourBetsDisplay() {
    const betsListEl = document.getElementById('your-bets-list');
    
    if (!betsListEl) return;
    
    betsListEl.innerHTML = '';
    
    if (Object.keys(gameState.currentBets).length === 0) {
        betsListEl.innerHTML = '<span style="color: #888; font-style: italic;">Keine Einsätze platziert</span>';
        return;
    }
    
    Object.entries(gameState.currentBets).forEach(([betKey, amount]) => {
        const [type, value] = betKey.split('_');
        
        const betItem = document.createElement('div');
        betItem.className = 'your-bet-item';
        
        let betDescription = '';
        let numberColor = '';
        
        if (type === 'straight') {
            const num = parseInt(value);
            numberColor = getNumberColor(num);
            betDescription = `<span class="your-bet-number ${numberColor}">${num}</span>`;
        } else if (['red', 'black', 'even', 'odd', 'low', 'high'].includes(type)) {
            const betNames = {
                red: 'Rot',
                black: 'Schwarz',
                even: 'Gerade',
                odd: 'Ungerade',
                low: '1-18',
                high: '19-36'
            };
            const betColor = type === 'red' ? 'red' : type === 'black' ? 'black' : '';
            betDescription = betColor 
                ? `<span class="your-bet-number ${betColor}">${betNames[type]}</span>`
                : betNames[type];
        } else if (type === 'dozen') {
            const dozenNames = {
                1: '1st 12',
                2: '2nd 12',
                3: '3rd 12'
            };
            betDescription = dozenNames[value] || type;
        } else if (type === 'column') {
            betDescription = `${value}. Kolonne`;
        } else {
            betDescription = formatBetType(type, value);
        }
        
        betItem.innerHTML = `
            <span class="your-bet-amount">${amount}</span>
            <span class="your-bet-on">auf</span>
            ${betDescription}
        `;
        
        betsListEl.appendChild(betItem);
    });
}

/**
 * Shows a message on the game table.
 */
function showMessage(message, type) {
    gameMessageEl.textContent = message;
    gameMessageEl.className = `game-message ${type}`;
}

/**
 * Adds an entry to the game history.
 */
function addToHistory(number, profit) {
    const li = document.createElement('li');
    li.className = profit > 0 ? 'win' : 'lose';
    li.innerHTML = `
        <div class="history-number">${number}</div>
        <div style="font-size: 0.9em; margin-top: 5px;">
            ${profit > 0 ? '+' : ''}${profit}
        </div>
    `;
    
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
        currentBet: gameState.currentBet,
        gamesPlayed: gameState.gamesPlayed,
        wins: gameState.wins,
        losses: gameState.losses,
        highestWin: gameState.highestWin,
        totalWinnings: gameState.totalWinnings,
        totalLosses: gameState.totalLosses
    };
    localStorage.setItem('rouletteStats', JSON.stringify(stats));
}

/**
 * Loads game statistics from localStorage.
 */
function loadStats() {
    const savedStats = localStorage.getItem('rouletteStats');
    if (savedStats) {
        try {
            const stats = JSON.parse(savedStats);
            gameState.currentBet = stats.currentBet || 100;
            gameState.gamesPlayed = stats.gamesPlayed || 0;
            gameState.wins = stats.wins || 0;
            gameState.losses = stats.losses || 0;
            gameState.highestWin = stats.highestWin || 0;
            gameState.totalWinnings = stats.totalWinnings || 0;
            gameState.totalLosses = stats.totalLosses || 0;
        } catch (e) {
            console.error('Error loading stats:', e);
        }
    }
}

/**
 * Resets all statistics.
 */
function resetStats() {
    gameState.currentBet = 100;
    gameState.gamesPlayed = 0;
    gameState.wins = 0;
    gameState.losses = 0;
    gameState.highestWin = 0;
    gameState.totalWinnings = 0;
    gameState.totalLosses = 0;
    gameState.state = GAME_STATE.WAITING;
    gameState.currentBets = {};
    
    resetBalance(); // Reset shared balance
    syncBalance();
    saveStats();
    updateUI();
    updateStatsModal();
    showMessage('Statistik zurückgesetzt!', '');
}

// ==========================================================================
// STATS MODAL FUNCTIONS
// ==========================================================================

/**
 * Initializes the stats modal.
 */
function initializeStatsModal() {
    statsModal = document.getElementById('stats-modal');
    statsModalOverlay = document.getElementById('stats-modal-overlay');
    
    document.getElementById('close-stats-modal').addEventListener('click', closeStatsModal);
    document.getElementById('reset-stats-btn').addEventListener('click', resetStats);
    
    statsModalOverlay.addEventListener('click', function(e) {
        if (e.target === statsModalOverlay) {
            closeStatsModal();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && statsModal.style.display === 'block') {
            closeStatsModal();
        }
    });
}

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
    // First sync balance to ensure it's up to date
    syncBalance();
    
    const currentBalance = await getBalance();
    const profit = currentBalance - 1000;
    
    document.getElementById('stats-total-games').textContent = gameState.gamesPlayed;
    document.getElementById('stats-wins').textContent = gameState.wins;
    document.getElementById('stats-losses').textContent = gameState.losses;
    document.getElementById('stats-highest-win').textContent = gameState.highestWin;
    document.getElementById('stats-total-winnings').textContent = gameState.totalWinnings;
    document.getElementById('stats-total-losses').textContent = gameState.totalLosses;
    document.getElementById('stats-balance').textContent = Math.round(currentBalance);
    
    const profitEl = document.getElementById('stats-profit');
    profitEl.textContent = profit >= 0 ? `+${profit}` : profit;
    profitEl.className = profit >= 0 ? 'stat-value positive' : 'stat-value negative';
}

// ==========================================================================
// EXPORT FOR GLOBAL USE
// ==========================================================================

window.addBet = addBet;
window.changeBet = changeBet;
window.setCustomBet = setCustomBet;
window.halfBet = halfBet;
window.doubleBet = doubleBet;
window.setAllIn = setAllIn;
window.placeBet = placeBet;
window.spinWheel = spinWheel;
window.clearAllBets = clearAllBets;
window.repeatLastBet = repeatLastBet;
window.showStatsModal = showStatsModal;
window.closeStatsModal = closeStatsModal;
window.resetStats = resetStats;
