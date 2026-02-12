/* script.js */

// --- 1. Game State & Config ---
const state = {
    currentMode: null, // 'computer' or 'player'
    language: 'en',
    turn: 'player', // 'player' or 'enemy'
    gameActive: false,
    theme: 'dark',
    playerShips: [],
    enemyShips: [],
    playerHits: [],
    enemyHits: []
};

const SHIPS = [5, 4, 3, 3, 2]; // Sizes of ships
const BOARD_SIZE = 10;

// --- 2. Localization Dictionary ---
const translations = {
    en: {
        yourTurn: "Your Turn",
        enemyTurn: "Enemy's Turn",
        win: "VICTORY!",
        lose: "DEFEAT!",
        p1Win: "PLAYER 1 WINS!",
        p2Win: "PLAYER 2 WINS!"
    },
    tr: {
        yourTurn: "Sıra Sizde",
        enemyTurn: "Rakibin Sırası",
        win: "ZAFER!",
        lose: "YENİLGİ!",
        p1Win: "OYUNCU 1 KAZANDI!",
        p2Win: "OYUNCU 2 KAZANDI!"
    }
};

// --- 3. DOM Elements ---
const screens = {
    menu: document.getElementById('main-menu'),
    game: document.getElementById('game-screen'),
    settings: document.getElementById('settings-modal'),
    gameOver: document.getElementById('game-over-modal')
};

const sounds = {
    fire: document.getElementById('sfx-fire'),
    hit: document.getElementById('sfx-hit'),
    miss: document.getElementById('sfx-miss'),
    win: document.getElementById('sfx-win')
};

// --- 4. Core Functions ---

function init() {
    // Check local storage for preferences
    if(localStorage.getItem('theme') === 'light') toggleTheme();
    if(localStorage.getItem('lang') === 'tr') toggleLanguage();
}

// Navigation
function startGame(mode) {
    state.currentMode = mode;
    state.gameActive = true;
    state.turn = 'player';
    state.playerHits = [];
    state.enemyHits = [];
    
    // Switch Screens
    screens.menu.classList.add('hidden');
    screens.game.classList.remove('hidden');
    screens.gameOver.classList.add('hidden');

    // Setup Boards
    generateRandomBoard('player');
    generateRandomBoard('enemy');
    
    renderBoards();
    updateTurnIndicator();
}

function quitGame() {
    state.gameActive = false;
    screens.game.classList.add('hidden');
    screens.gameOver.classList.add('hidden');
    screens.menu.classList.remove('hidden');
}

function restartGame() {
    startGame(state.currentMode);
}

// --- 5. Game Logic ---

// Helper: Place ships randomly (Logic for both Player auto-setup and Computer)
function generateRandomBoard(who) {
    const ships = [];
    const occupied = new Set();

    SHIPS.forEach(size => {
        let placed = false;
        while (!placed) {
            const vertical = Math.random() > 0.5;
            const x = Math.floor(Math.random() * BOARD_SIZE);
            const y = Math.floor(Math.random() * BOARD_SIZE);
            const coords = [];

            // Check fit
            let fits = true;
            for (let i = 0; i < size; i++) {
                const cx = vertical ? x : x + i;
                const cy = vertical ? y + i : y;
                if (cx >= BOARD_SIZE || cy >= BOARD_SIZE || occupied.has(`${cx},${cy}`)) {
                    fits = false;
                    break;
                }
                coords.push({x: cx, y: cy});
            }

            if (fits) {
                coords.forEach(c => occupied.add(`${c.x},${c.y}`));
                ships.push({ coords, hits: 0, size });
                placed = true;
            }
        }
    });

    if (who === 'player') state.playerShips = ships;
    else state.enemyShips = ships;
}

// Handle Cell Click
function handleAttack(x, y) {
    if (!state.gameActive || state.turn !== 'player') return;

    const cellKey = `${x},${y}`;
    if (state.enemyHits.includes(cellKey)) return; // Already shot here

    playSound('fire');
    
    // Check Hit logic
    const isHit = checkHit(x, y, state.enemyShips);
    state.enemyHits.push(cellKey);
    
    // Visual Update
    updateCellVisual('enemy-grid', x, y, isHit ? 'hit' : 'miss');

    if (isHit) {
        playSound('hit');
        if (checkWin(state.enemyShips)) gameOver(true);
    } else {
        playSound('miss');
        state.turn = 'enemy';
        updateTurnIndicator();
        if (state.currentMode === 'computer') {
            setTimeout(computerTurn, 1000); // AI Delay
        }
    }
}

// Computer AI
function computerTurn() {
    if (!state.gameActive) return;

    let x, y, cellKey;
    do {
        x = Math.floor(Math.random() * BOARD_SIZE);
        y = Math.floor(Math.random() * BOARD_SIZE);
        cellKey = `${x},${y}`;
    } while (state.playerHits.includes(cellKey));

    const isHit = checkHit(x, y, state.playerShips);
    state.playerHits.push(cellKey);
    updateCellVisual('player-grid', x, y, isHit ? 'hit' : 'miss');

    if (isHit) {
        playSound('hit');
        if (checkWin(state.playerShips)) gameOver(false);
        else setTimeout(computerTurn, 800); // AI shoots again on hit
    } else {
        playSound('miss');
        state.turn = 'player';
        updateTurnIndicator();
    }
}

function checkHit(x, y, shipArray) {
    let hit = false;
    shipArray.forEach(ship => {
        ship.coords.forEach(c => {
            if (c.x === x && c.y === y) {
                hit = true;
                ship.hits++;
            }
        });
    });
    return hit;
}

function checkWin(shipArray) {
    return shipArray.every(ship => ship.hits >= ship.size);
}

// --- 6. Rendering ---

function renderBoards() {
    // Player Grid (Shows Ships)
    const pGrid = document.getElementById('player-grid');
    pGrid.innerHTML = '';
    createGridHTML(pGrid, state.playerShips, state.playerHits, false); // False = not interactive

    // Enemy Grid (Hidden Ships)
    const eGrid = document.getElementById('enemy-grid');
    eGrid.innerHTML = '';
    createGridHTML(eGrid, [], state.enemyHits, true); // True = interactive
}

function createGridHTML(container, ships, hits, interactive) {
    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            const div = document.createElement('div');
            div.classList.add('cell');
            div.dataset.x = x;
            div.dataset.y = y;

            // Check Status
            const cellKey = `${x},${y}`;
            const isHit = hits.includes(cellKey);
            const isShip = ships.some(s => s.coords.some(c => c.x === x && c.y === y));

            if (isShip && !interactive) div.classList.add('ship');
            if (isHit && isShip) div.classList.add('hit');
            else if (isHit) div.classList.add('miss');

            if (interactive && !isHit) {
                div.classList.add('interactive');
                div.addEventListener('click', () => handleAttack(x, y));
            }

            container.appendChild(div);
        }
    }
}

function updateCellVisual(gridId, x, y, status) {
    const grid = document.getElementById(gridId);
    const index = y * 10 + x;
    const cell = grid.children[index];
    cell.classList.add(status);
    cell.classList.remove('interactive');
}

// --- 7. UI Helpers ---

function togglePause() {
    alert("Game Paused. Click OK to Resume.");
}

function openSettings() { screens.settings.classList.remove('hidden'); }
function closeSettings() { screens.settings.classList.add('hidden'); }

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    state.theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
}

function toggleLanguage() {
    state.language = state.language === 'en' ? 'tr' : 'en';
    localStorage.setItem('lang', state.language);
    updateTexts();
}

function updateTexts() {
    document.querySelectorAll('[data-en]').forEach(el => {
        el.textContent = el.getAttribute(`data-${state.language}`);
    });
    updateTurnIndicator();
}

function updateTurnIndicator() {
    const el = document.getElementById('turn-indicator');
    const t = translations[state.language];
    if (state.turn === 'player') el.textContent = t.yourTurn;
    else el.textContent = t.enemyTurn;
}

function gameOver(playerWon) {
    state.gameActive = false;
    playSound('win');
    screens.gameOver.classList.remove('hidden');
    const t = translations[state.language];
    document.getElementById('winner-text').textContent = playerWon ? t.win : t.lose;
}

function playSound(name) {
    // Simple sound handler
    if(sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(e => console.log("Audio play failed", e));
    }
}

// Initialize
init();
