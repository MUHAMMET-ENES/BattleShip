/* =========================================
   BATTLESHIP ELITE: TACTICAL ENGINE
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
        rotate: "Rotate (R)",
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
        rotate: "Döndür (R)",
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
    mode: null, // 'computer' or 'player'
    phase: 'menu', // menu, profile, deployment, transition, battle, gameover
    
    // Deployment Logic
    deployingPlayer: 1, // 1 or 2
    selectedShipIndex: 0,
    isHorizontal: true,
    p1ShipsBuffer: [],
    p2ShipsBuffer: [],

    // Battle Logic
    turn: 1, // 1 or 2
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
        alert: document.getElementById('sfx-alert')
    }
};

// --- 4. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateLanguage(state.lang);
    DOM.hud.highScore.textContent = state.highScore;
    
    // Keyboard Listener for Rotation
    document.addEventListener('keydown', (e) => {
        if (state.phase === 'deployment' && (e.key === 'r' || e.key === 'R')) {
            rotateShip();
        }
    });
});

function initTheme() {
    if (state.theme === 'light') document.body.classList.add('light-mode');
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
    // 1. Capture Names
    const p1Name = document.getElementById('p1-name-input').value.trim() || TEXTS[state.lang].p1Default;
    let p2Name = TEXTS[state.lang].p2Default;
    
    if (state.mode === 'computer') {
        p2Name = TEXTS[state.lang].cpuName;
    } else {
        p2Name = document.getElementById('p2-name-input').value.trim() || TEXTS[state.lang].p2Default;
    }

    // 2. Reset State
    state.p1 = createPlayer(p1Name);
    state.p2 = createPlayer(p2Name);
    state.deployingPlayer = 1;
    state.p1ShipsBuffer = [];
    state.p2ShipsBuffer = [];
    state.selectedShipIndex = 0;
    
    // 3. UI Setup
    setupDeploymentUI();
    switchScreen('deployment');
}

function createPlayer(name) {
    return { 
        name, 
        board: Array(CONFIG.boardSize * CONFIG.boardSize).fill(null), // Flat array for grid
        ships: [], 
        shots: [], 
        score: 0, 
        moves: 0 
    };
}

// --- 6. DEPLOYMENT LOGIC ---

function setupDeploymentUI() {
    const grid = document.getElementById('deploy-grid');
    const dock = document.getElementById('ship-dock');
    const title = document.getElementById('deploy-player-title');
    const btn = document.getElementById('btn-start-battle');
    const status = document.getElementById('deploy-status');

    grid.innerHTML = '';
    dock.innerHTML = '';
    btn.disabled = true;
    btn.classList.add('disabled');
    status.textContent = "";

    const currentPlayer = state.deployingPlayer === 1 ? state.p1 : state.p2;
    title.textContent = `${TEXTS[state.lang].placeShip} ${currentPlayer.name}`;

    // Create Grid
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        
        // Mouse Events for Ghost Placement
        cell.addEventListener('mouseenter', () => showGhostShip(i));
        cell.addEventListener('mouseleave', () => clearGhostShip());
        cell.addEventListener('click', () => placeShip(i));
        
        grid.appendChild(cell);
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
    clearGhostShip(); // Refresh preview
}

function showGhostShip(startIndex) {
    if (state.selectedShipIndex >= CONFIG.ships.length) return; // All placed

    const ship = CONFIG.ships[state.selectedShipIndex];
    const coords = getShipCoordinates(startIndex, ship.size, state.isHorizontal);
    const grid = document.getElementById('deploy-grid');
    const currentBuffer = state.deployingPlayer === 1 ? state.p1ShipsBuffer : state.p2ShipsBuffer;

    const isValid = coords.length === ship.size && !checkCollision(coords, currentBuffer);

    coords.forEach(idx => {
        if (idx < 100) {
            const cell = grid.children[idx];
            cell.classList.add(isValid ? 'preview' : 'invalid');
        }
    });
}

function clearGhostShip() {
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
    
    // Draw permanently on deploy grid
    const grid = document.getElementById('deploy-grid');
    coords.forEach(idx => grid.children[idx].classList.add('ship'));

    // Update Dock
    const dockItem = document.querySelector(`.dock-ship[data-id="${state.selectedShipIndex}"]`);
    dockItem.classList.add('placed');
    dockItem.classList.remove('selected');

    // Next Ship
    state.selectedShipIndex++;
    if (state.selectedShipIndex < CONFIG.ships.length) {
        selectShip(state.selectedShipIndex);
    } else {
        // All ships placed
        document.getElementById('deploy-status').textContent = "FLEET READY!";
        const btn = document.getElementById('btn-start-battle');
        btn.disabled = false;
        btn.classList.remove('disabled');
    }
}

function confirmDeployment() {
    // Save ships to player object
    if (state.deployingPlayer === 1) {
        state.p1.ships = [...state.p1ShipsBuffer];
        
        if (state.mode === 'computer') {
            // CPU Auto Deploy
            state.p2.ships = generateRandomShips();
            startGameLoop();
        } else {
            // PvP: Switch to Player 2
            state.deployingPlayer = 2;
            state.selectedShipIndex = 0;
            state.p1ShipsBuffer = []; // Clear visual buffer (not the saved p1.ships)
            
            // Show Transition
            showTransition(state.p2.name, () => {
                setupDeploymentUI();
                switchScreen('deployment');
            });
        }
    } else {
        // P2 Finished (PvP)
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
            if (x + i >= 10) return []; // Out of bounds X
            idx = start + i;
        } else {
            if (y + i >= 10) return []; // Out of bounds Y
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

// --- 7. BATTLE LOOP ---

function startGameLoop() {
    state.turn = 1;
    switchScreen('game');
    
    // If PvP, show transition first
    if (state.mode === 'player') {
        showTransition(state.p1.name, renderTurn);
    } else {
        renderTurn();
    }
}

function showTransition(nextName, callback) {
    const tScreen = DOM.screens.transition;
    document.getElementById('next-player-name').textContent = nextName;
    tScreen.classList.remove('hidden');
    
    // Override the button onclick
    const btn = tScreen.querySelector('.btn-primary');
    btn.onclick = () => {
        tScreen.classList.add('hidden');
        callback();
    };
}

function renderTurn() {
    const attacker = state.turn === 1 ? state.p1 : state.p2;
    const defender = state.turn === 1 ? state.p2 : state.p1;
    
    // Update HUD
    DOM.hud.turn.textContent = attacker.name;
    DOM.hud.score.textContent = attacker.score;
    DOM.hud.moves.textContent = attacker.moves;
    DOM.hud.status.textContent = TEXTS[state.lang].turn;

    // Render Grids
    drawGrid('enemy-grid', defender.ships, attacker.shots, true); // True = interactive
    drawGrid('player-grid', attacker.ships, defender.shots, false); // False = static
}

function drawGrid(elementId, ships, shots, isInteractive) {
    const grid = document.getElementById(elementId);
    grid.innerHTML = '';

    for (let i = 0; i < 100; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        
        const shotData = shots.find(s => s.index === i);
        const shipHere = ships.find(s => s.coords.includes(i));
        
        // Show ships ONLY on friendly board OR if they are sunk on enemy board
        if (!isInteractive && shipHere) {
             cell.classList.add('ship');
             if (shipHere.hits >= shipHere.size) cell.classList.add('sunk');
        } else if (isInteractive && shipHere && shipHere.hits >= shipHere.size) {
            // Reveal sunk ships on enemy radar
            cell.classList.add('sunk');
        }

        // Show Hits/Misses
        if (shotData) {
            cell.classList.add(shotData.hit ? 'hit' : 'miss');
        } 
        // Interactivity
        else if (isInteractive) {
            cell.onclick = () => handleFire(i);
        }

        grid.appendChild(cell);
    }
}

function handleFire(index) {
    const attacker = state.turn === 1 ? state.p1 : state.p2;
    const defender = state.turn === 1 ? state.p2 : state.p1;

    // Record Shot
    attacker.moves++;
    const shipHit = defender.ships.find(s => s.coords.includes(index));
    const isHit = !!shipHit;

    attacker.shots.push({ index, hit: isHit });
    playAudio(isHit ? 'hit' : 'miss');

    if (isHit) {
        shipHit.hits++;
        attacker.score += CONFIG.scores.hit;
        
        // Check Sunk
        if (shipHit.hits === shipHit.size) {
            attacker.score += CONFIG.scores.sink;
            playAudio('alert'); // Sinking alarm
            
            // SPECIAL RULE: Carrier (Size 5) Death = Instant Win
            if (shipHit.size === 5) {
                attacker.score += CONFIG.scores.win;
                endGame(attacker, "CARRIER DESTROYED");
                return;
            }
        }
        
        // Update UI immediately (Hit grants another turn? No, standard rules usually don't, but let's stick to turn swap for strict tactical play)
        // Note: Some rules say hit = shoot again. Let's keep it simple: Turn swap.
    }

    DOM.hud.score.textContent = attacker.score;
    DOM.hud.moves.textContent = attacker.moves;
    
    // Re-render immediately to show result
    renderTurn();

    // Check Total Wipeout (Backup win condition)
    if (defender.ships.every(s => s.hits >= s.size)) {
        endGame(attacker, "FLEET DESTROYED");
        return;
    }

    // Delay then swap turn
    setTimeout(() => {
        if (isHit && state.mode === 'computer' && state.turn === 2) {
            // CPU hit, let it shoot again? Or swap? 
            // Let's swap to be fair.
            swapTurn();
        } else {
            swapTurn();
        }
    }, 1000);
}

function swapTurn() {
    state.turn = state.turn === 1 ? 2 : 1;
    
    if (state.mode === 'computer' && state.turn === 2) {
        // Computer Turn
        renderTurn();
        setTimeout(computerAI, 1000);
    } else if (state.mode === 'player') {
        // PvP Transition
        const nextName = state.turn === 1 ? state.p1.name : state.p2.name;
        showTransition(nextName, renderTurn);
    } else {
        renderTurn();
    }
}

// --- 8. COMPUTER AI ---
function computerAI() {
    const cpu = state.p2;
    const player = state.p1;
    
    // Simple Hunt Logic: Pick random not yet shot
    // (A real "Tactical" AI would search around hits, but this is random for now)
    let index;
    do {
        index = Math.floor(Math.random() * 100);
    } while (cpu.shots.some(s => s.index === index));

    handleFire(index);
}

// --- 9. GAME OVER ---
function endGame(winner, reason) {
    playAudio('win');
    
    // Update High Score
    if (winner.score > state.highScore) {
        state.highScore = winner.score;
        localStorage.setItem('highScore', state.highScore);
        DOM.hud.highScore.textContent = state.highScore;
    }

    document.getElementById('winner-title').textContent = TEXTS[state.lang].win;
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-moves').textContent = winner.moves;
    document.getElementById('winner-score').textContent = winner.score;
    
    switchScreen('gameOver');
}

// --- 10. UTILITIES ---
function playAudio(id) {
    const audio = DOM.audio[id];
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {}); // Catch autoplay blocks
    }
}

function togglePause() {
    alert("PAUSED");
}

function quitGame() {
    if(confirm("Abort mission?")) {
        backToMenu();
    }
}

function restartGame() {
    // Reset necessary vars
    switchScreen('menu'); // Simple reload flow
    // Ideally, directly call startDeployment() but menu flow is cleaner
}

// Settings
function toggleLanguage() {
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
    document.body.classList.toggle('light-mode');
    state.theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
}

function toggleSound() {
    // Mute toggle implementation
    alert("Sound settings toggled (Placeholder)");
}

function openSettings() { DOM.screens.settings.classList.remove('hidden'); }
function closeSettings() { DOM.screens.settings.classList.add('hidden'); }
