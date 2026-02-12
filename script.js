/* =========================================
   BATTLESHIP ELITE: OPTIMIZED ENGINE
   ========================================= */

// --- 1. CONFIGURATION & CONSTANTS ---
const CONFIG = {
    boardSize: 10,
    ships: [
        { name: "Carrier", size: 5, id: "carrier" },     // THE TARGET
        { name: "Battleship", size: 4, id: "battleship" },
        { name: "Cruiser", size: 3, id: "cruiser" },
        { name: "Submarine", size: 3, id: "submarine" },
        { name: "Destroyer", size: 2, id: "destroyer" }
    ],
    scores: {
        hit: 50,
        sink: 200,
        win: 1000
    }
};

// Localization Dictionary
const TEXTS = {
    en: {
        placeShip: "Place your",
        rotate: "Rotate (Caps Lock)",
        invalid: "Invalid Position!",
        p1Default: "Admiral 1",
        p2Default: "Admiral 2",
        cpuName: "T.A.C.T.I.C.S. AI",
        turn: "'s Turn",
        win: "VICTORY!",
        sunk: "SUNK!",
        carrierSunk: "TARGET ELIMINATED! VICTORY!",
        miss: "MISS",
        hit: "HIT"
    },
    tr: {
        placeShip: "Yerleştir:",
        rotate: "Döndür (Caps Lock)",
        invalid: "Geçersiz Konum!",
        p1Default: "Amiral 1",
        p2Default: "Amiral 2",
        cpuName: "Yapay Zeka",
        turn: "Sırası",
        win: "ZAFER!",
        sunk: "BATIRILDI!",
        carrierSunk: "HEDEF YOK EDİLDİ! ZAFER!",
        miss: "ISKA",
        hit: "İSABET"
    }
};

// --- 2. GAME STATE ---
const state = {
    lang: localStorage.getItem('lang') || 'en',
    theme: localStorage.getItem('theme') || 'dark',
    highScore: parseInt(localStorage.getItem('highScore')) || 0,
    mode: null, 
    phase: 'menu', 
    
    // Deployment Logic
    deployingPlayer: 1, 
    selectedShipIndex: 0,
    isHorizontal: true,
    p1ShipsBuffer: [],
    p2ShipsBuffer: [],

    // Battle Logic
    turn: 1, 
    p1: { name: "", board: [], ships: [], shots: [], score: 0, moves: 0 },
    p2: { name: "", board: [], ships: [], shots: [], score: 0, moves: 0 }
};

// --- 3. DOM ELEMENTS ---
const DOM = {
    screens: {
        menu: document.getElementById('main-menu'),
        profile: document.getElementById('profile-screen'),
        deployment: document.getElementById('deployment-screen'),
        transition: document.getElementById('transition-screen'),
        game: document.getElementById('game-screen'),
        settings: document.getElementById('settings-modal'),
        gameOver: document.getElementById('game-over-modal')
    },
    hud: {
        score: document.getElementById('score-display'),
        moves: document.getElementById('move-display'),
        turn: document.getElementById('active-player-label'),
        status: document.getElementById('turn-status'),
        highScore: document.getElementById('menu-high-score')
    },
    audio: {
        fire: document.getElementById('sfx-fire'),
        hit: document.getElementById('sfx-hit'),
        miss: document.getElementById('sfx-miss'),
        win: document.getElementById('sfx-win'),
        alert: document.getElementById('sfx-alert'),
        // NOTE: Add <audio id="sfx-menu" src="assets/sounds/menu.mp3"></audio> to your HTML
        menu: document.getElementById('sfx-menu') 
    }
};

// --- 4. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateLanguage(state.lang);
    DOM.hud.highScore.textContent = state.highScore;
    attachButtonSounds(); // Attach sound to all buttons
    
    // Optimized Key Listener for Rotation
    document.addEventListener('keydown', (e) => {
        if (state.phase === 'deployment') {
            // Using CapsLock as requested
            if (e.code === 'CapsLock' || e.key === 'CapsLock') {
                rotateShip();
            }
        }
    });
});

function initTheme() {
    if (state.theme === 'light') document.body.classList.add('light-mode');
}

function attachButtonSounds() {
    // Finds all buttons and attaches the click sound
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => playAudio('menu'));
    });
}

// --- 5. NAVIGATION & FLOW ---

function switchScreen(screenName) {
    Object.values(DOM.screens).forEach(s => s.classList.add('hidden'));
    DOM.screens[screenName].classList.remove('hidden');
    state.phase = screenName;
}

function showProfileScreen(mode) {
    state.mode = mode;
    const p2Input = document.getElementById('p2-input-group');
    p2Input.style.display = (mode === 'computer') ? 'none' : 'block';
    switchScreen('profile');
}

function backToMenu() {
    switchScreen('menu');
}

// Start Deployment Phase
function startDeployment() {
    const p1Name = document.getElementById('p1-name-input').value.trim() || TEXTS[state.lang].p1Default;
    let p2Name = TEXTS[state.lang].p2Default;
    
    if (state.mode === 'computer') {
        p2Name = TEXTS[state.lang].cpuName;
    } else {
        p2Name = document.getElementById('p2-name-input').value.trim() || TEXTS[state.lang].p2Default;
    }

    state.p1 = createPlayer(p1Name);
    state.p2 = createPlayer(p2Name);
    state.deployingPlayer = 1;
    state.p1ShipsBuffer = [];
    state.p2ShipsBuffer = [];
    state.selectedShipIndex = 0;
    
    setupDeploymentUI();
    switchScreen('deployment');
}

function createPlayer(name) {
    return { 
        name, 
        ships: [], 
        shots: [], 
        score: 0, 
        moves: 0 
    };
}

// --- 6. DEPLOYMENT LOGIC (Fixed Stability) ---

function setupDeploymentUI() {
    const grid = document.getElementById('deploy-grid');
    const dock = document.getElementById('ship-dock');
    const title = document.getElementById('deploy-player-title');
    const btn = document.getElementById('btn-start-battle');
    const status = document.getElementById('deploy-status');

    // Reset UI
    dock.innerHTML = '';
    btn.disabled = true;
    btn.classList.add('disabled');
    status.textContent = "";

    const currentPlayer = state.deployingPlayer === 1 ? state.p1 : state.p2;
    title.textContent = `${TEXTS[state.lang].placeShip} ${currentPlayer.name}`;

    // STABILITY FIX: Only create cells if they don't exist. 
    // This prevents the container from collapsing and reshaping.
    if (grid.children.length !== 100) {
        grid.innerHTML = ''; // Only wipe if size is wrong
        for (let i = 0; i < 100; i++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.index = i;
            
            // Attach Events once
            cell.addEventListener('mouseenter', (e) => showGhostShip(parseInt(e.target.dataset.index)));
            cell.addEventListener('mouseleave', () => clearGhostShip());
            cell.addEventListener('click', (e) => placeShip(parseInt(e.target.dataset.index)));
            
            grid.appendChild(cell);
        }
    } else {
        // Just clean classes if grid already exists
        Array.from(grid.children).forEach(c => c.className = 'cell');
    }

    // Create Dock
    CONFIG.ships.forEach((ship, index) => {
        const div = document.createElement('div');
        div.classList.add('dock-ship');
        div.textContent = `${ship.name} (${ship.size})`;
        div.dataset.id = index;
        div.onclick = () => selectShip(index);
        if (index === 0) div.classList.add('selected');
        dock.appendChild(div);
    });
    
    state.selectedShipIndex = 0;
}

function selectShip(index) {
    state.selectedShipIndex = index;
    document.querySelectorAll('.dock-ship').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.dock-ship[data-id="${index}"]`).classList.add('selected');
}

function rotateShip() {
    state.isHorizontal = !state.isHorizontal;
    
    // INSTANT FEEDBACK: Re-trigger hover effect on current cell if mouse is over grid
    const hovered = document.querySelector('#deploy-grid .cell:hover');
    if (hovered) {
        clearGhostShip();
        showGhostShip(parseInt(hovered.dataset.index));
    }
}

function showGhostShip(startIndex) {
    if (state.selectedShipIndex >= CONFIG.ships.length) return;

    const ship = CONFIG.ships[state.selectedShipIndex];
    const coords = getShipCoordinates(startIndex, ship.size, state.isHorizontal);
    const grid = document.getElementById('deploy-grid');
    const currentBuffer = state.deployingPlayer === 1 ? state.p1ShipsBuffer : state.p2ShipsBuffer;

    const isValid = coords.length === ship.size && !checkCollision(coords, currentBuffer);

    coords.forEach(idx => {
        if (idx < 100) {
            const cell = grid.children[idx];
            // Use 'add' to keep base structure stable
            cell.classList.add(isValid ? 'preview' : 'invalid');
        }
    });
}

function clearGhostShip() {
    // Only remove temporary classes, keep 'ship' class if placed
    document.querySelectorAll('#deploy-grid .cell').forEach(c => {
        c.classList.remove('preview', 'invalid');
    });
}

function placeShip(startIndex) {
    if (state.selectedShipIndex >= CONFIG.ships.length) return;

    const ship = CONFIG.ships[state.selectedShipIndex];
    const coords = getShipCoordinates(startIndex, ship.size, state.isHorizontal);
    const currentBuffer = state.deployingPlayer === 1 ? state.p1ShipsBuffer : state.p2ShipsBuffer;

    if (coords.length !== ship.size || checkCollision(coords, currentBuffer)) {
        playAudio('alert');
        return;
    }

    // Valid Placement
    const newShip = { ...ship, coords, hits: 0 };
    currentBuffer.push(newShip);
    
    const grid = document.getElementById('deploy-grid');
    coords.forEach(idx => grid.children[idx].classList.add('ship'));

    const dockItem = document.querySelector(`.dock-ship[data-id="${state.selectedShipIndex}"]`);
    dockItem.classList.add('placed');
    dockItem.classList.remove('selected');

    state.selectedShipIndex++;
    if (state.selectedShipIndex < CONFIG.ships.length) {
        selectShip(state.selectedShipIndex);
    } else {
        document.getElementById('deploy-status').textContent = "FLEET READY!";
        const btn = document.getElementById('btn-start-battle');
        btn.disabled = false;
        btn.classList.remove('disabled');
    }
}

function confirmDeployment() {
    if (state.deployingPlayer === 1) {
        state.p1.ships = [...state.p1ShipsBuffer];
        
        if (state.mode === 'computer') {
            state.p2.ships = generateRandomShips();
            startGameLoop();
        } else {
            state.deployingPlayer = 2;
            state.selectedShipIndex = 0;
            state.p1ShipsBuffer = [];
            
            showTransition(state.p2.name, () => {
                setupDeploymentUI();
                switchScreen('deployment');
            });
        }
    } else {
        state.p2.ships = [...state.p2ShipsBuffer];
        startGameLoop();
    }
}

// Helper: Get Indices
function getShipCoordinates(start, size, horizontal) {
    const coords = [];
    const x = start % 10;
    const y = Math.floor(start / 10);

    for (let i = 0; i < size; i++) {
        let idx;
        if (horizontal) {
            if (x + i >= 10) return [];
            idx = start + i;
        } else {
            if (y + i >= 10) return [];
            idx = start + (i * 10);
        }
        coords.push(idx);
    }
    return coords;
}

function checkCollision(coords, existingShips) {
    const allOccupied = existingShips.flatMap(s => s.coords);
    return coords.some(c => allOccupied.includes(c));
}

function generateRandomShips() {
    const ships = [];
    const occupied = new Set();
    
    CONFIG.ships.forEach(template => {
        let placed = false;
        while (!placed) {
            const horizontal = Math.random() > 0.5;
            const start = Math.floor(Math.random() * 100);
            const coords = getShipCoordinates(start, template.size, horizontal);
            
            if (coords.length === template.size && !coords.some(c => occupied.has(c))) {
                coords.forEach(c => occupied.add(c));
                ships.push({ ...template, coords, hits: 0 });
                placed = true;
            }
        }
    });
    return ships;
}

// --- 7. BATTLE LOOP (Zero-Shake Rendering) ---

function startGameLoop() {
    state.turn = 1;
    
    // Initialize Grids ONCE at start of battle to prevent shaking
    initBattleGrid('enemy-grid', true);
    initBattleGrid('player-grid', false);
    
    switchScreen('game');
    
    if (state.mode === 'player') {
        showTransition(state.p1.name, renderTurn);
    } else {
        renderTurn();
    }
}

// Creates the divs once. Future updates only change classes.
function initBattleGrid(elementId, isInteractive) {
    const grid = document.getElementById(elementId);
    grid.innerHTML = '';
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        if (isInteractive) {
            cell.onclick = () => handleFire(parseInt(cell.dataset.index));
        }
        grid.appendChild(cell);
    }
}

function showTransition(nextName, callback) {
    const tScreen = DOM.screens.transition;
    document.getElementById('next-player-name').textContent = nextName;
    tScreen.classList.remove('hidden');
    
    const btn = tScreen.querySelector('.btn-primary');
    // Ensure sound plays on transition button too
    btn.onclick = () => {
        playAudio('menu');
        tScreen.classList.add('hidden');
        callback();
    };
}

function renderTurn() {
    const attacker = state.turn === 1 ? state.p1 : state.p2;
    const defender = state.turn === 1 ? state.p2 : state.p1;
    
    DOM.hud.turn.textContent = attacker.name;
    DOM.hud.score.textContent = attacker.score;
    DOM.hud.moves.textContent = attacker.moves;
    DOM.hud.status.textContent = TEXTS[state.lang].turn;

    // Update Grids (Visual Only - No DOM Destruction)
    updateGridVisuals('enemy-grid', defender.ships, attacker.shots, true);
    updateGridVisuals('player-grid', attacker.ships, defender.shots, false);
}

function updateGridVisuals(elementId, ships, shots, isInteractive) {
    const grid = document.getElementById(elementId);
    
    // Loop through existing children instead of rebuilding
    Array.from(grid.children).forEach((cell, i) => {
        // Reset class to base
        cell.className = 'cell';

        const shotData = shots.find(s => s.index === i);
        const shipHere = ships.find(s => s.coords.includes(i));
        
        // Ship Logic
        if (!isInteractive && shipHere) {
             cell.classList.add('ship');
             if (shipHere.hits >= shipHere.size) cell.classList.add('sunk');
        } else if (isInteractive && shipHere && shipHere.hits >= shipHere.size) {
            cell.classList.add('sunk');
        }

        // Shot Logic
        if (shotData) {
            cell.classList.add(shotData.hit ? 'hit' : 'miss');
        }
    });
}

function handleFire(index) {
    // Safety check: Don't fire if transitioning
    if (DOM.screens.transition.classList.contains('hidden') === false) return;

    const attacker = state.turn === 1 ? state.p1 : state.p2;
    const defender = state.turn === 1 ? state.p2 : state.p1;

    // Check if already shot
    if (attacker.shots.some(s => s.index === index)) return;

    attacker.moves++;
    const shipHit = defender.ships.find(s => s.coords.includes(index));
    const isHit = !!shipHit;

    attacker.shots.push({ index, hit: isHit });
    playAudio(isHit ? 'hit' : 'miss');

    if (isHit) {
        shipHit.hits++;
        attacker.score += CONFIG.scores.hit;
        
        if (shipHit.hits === shipHit.size) {
            attacker.score += CONFIG.scores.sink;
            playAudio('alert'); 
            
            // CARRIER RULE
            if (shipHit.size === 5) {
                attacker.score += CONFIG.scores.win;
                endGame(attacker, TEXTS[state.lang].carrierSunk);
                return;
            }
        }
    }

    // Instant Update
    renderTurn();

    if (defender.ships.every(s => s.hits >= s.size)) {
        endGame(attacker, TEXTS[state.lang].win);
        return;
    }

    // Delay swap
    setTimeout(() => {
        swapTurn();
    }, 1000);
}

function swapTurn() {
    state.turn = state.turn === 1 ? 2 : 1;
    
    if (state.mode === 'computer' && state.turn === 2) {
        renderTurn();
        // Slightly faster CPU response
        setTimeout(computerAI, 800);
    } else if (state.mode === 'player') {
        const nextName = state.turn === 1 ? state.p1.name : state.p2.name;
        showTransition(nextName, renderTurn);
    } else {
        renderTurn();
    }
}

// --- 8. COMPUTER AI ---
function computerAI() {
    const cpu = state.p2;
    
    // Smart-ish Random: Filter available cells first
    const available = [];
    for(let i=0; i<100; i++) {
        if (!cpu.shots.some(s => s.index === i)) available.push(i);
    }
    
    if (available.length > 0) {
        const randIndex = Math.floor(Math.random() * available.length);
        handleFire(available[randIndex]);
    }
}

// --- 9. GAME OVER ---
function endGame(winner, reason) {
    playAudio('win');
    
    if (winner.score > state.highScore) {
        state.highScore = winner.score;
        localStorage.setItem('highScore', state.highScore);
        DOM.hud.highScore.textContent = state.highScore;
    }

    document.getElementById('winner-title').textContent = reason || TEXTS[state.lang].win;
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-moves').textContent = winner.moves;
    document.getElementById('winner-score').textContent = winner.score;
    
    switchScreen('gameOver');
}

// --- 10. UTILITIES ---
function playAudio(id) {
    const audio = DOM.audio[id];
    // Check if element exists (in case user didn't add the menu audio tag yet)
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
}

function togglePause() {
    playAudio('menu');
    alert("PAUSED");
}

function quitGame() {
    playAudio('menu');
    if(confirm("Abort mission?")) {
        backToMenu();
    }
}

function restartGame() {
    playAudio('menu');
    switchScreen('menu'); 
}

function toggleLanguage() {
    playAudio('menu');
    state.lang = state.lang === 'en' ? 'tr' : 'en';
    localStorage.setItem('lang', state.lang);
    updateLanguage(state.lang);
}

function updateLanguage(lang) {
    const t = TEXTS[lang];
    document.querySelectorAll('[data-tr]').forEach(el => {
        el.textContent = el.getAttribute(`data-${lang}`);
    });
}

function toggleTheme() {
    playAudio('menu');
    document.body.classList.toggle('light-mode');
    state.theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
}

function toggleSound() {
    playAudio('menu');
    alert("Sound settings toggled");
}

function openSettings() { 
    playAudio('menu');
    DOM.screens.settings.classList.remove('hidden'); 
}
function closeSettings() { 
    playAudio('menu');
    DOM.screens.settings.classList.add('hidden'); 
}
