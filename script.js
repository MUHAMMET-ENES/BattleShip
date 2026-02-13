/* =========================================
   BATTLESHIP ELITE: FINAL JS ENGINE
   ========================================= */

/* --- 1. CONFIGURATION --- */
const CONFIG = {
    ships: [
        { name: "Carrier", size: 5 },
        { name: "Battleship", size: 4 },
        { name: "Cruiser", size: 3 },
        { name: "Submarine", size: 3 },
        { name: "Destroyer", size: 2 }
    ],
    scores: {
        hit: 10,
        sink: 10 // Bonus points for sinking
    }
};

const TEXTS = {
    en: {
        place: "Deploying:",
        rotate: "Rotate (R)",
        cpu: "TACTICAL AI",
        turnYou: "YOUR TURN",
        turnOpp: "OPPONENT'S TURN",
        win: "VICTORY!",
        lose: "DEFEAT!",
        carrierDown: "HOSTILE CARRIER DESTROYED!",
        alertName: "Please enter your name!",
        you: "YOU",
        enemy: "ENEMY"
    },
    tr: {
        place: "Yerleştir:",
        rotate: "Döndür (R)",
        cpu: "YAPAY ZEKA",
        turnYou: "SIRA SİZDE",
        turnOpp: "RAKİBİN SIRASI",
        win: "ZAFER!",
        lose: "YENİLGİ!",
        carrierDown: "DÜŞMAN AMİRAL GEMİSİ BATTI!",
        alertName: "Lütfen isminizi giriniz!",
        you: "SİZ",
        enemy: "DÜŞMAN"
    }
};

/* --- 2. STATE --- */
const state = {
    lang: localStorage.getItem('lang') || 'en',
    theme: localStorage.getItem('theme') || 'dark',
    volume: parseFloat(localStorage.getItem('volume')) || 1.0,
    
    mode: null,          // 'player' or 'computer'
    phase: 'menu',       // Current screen
    turn: 1,             // 1 = Player 1, 2 = Player 2 (or CPU)
    isLocked: false,     // Input lock (prevent spamming)
    
    // Timers
    timerInterval: null,
    p1Seconds: 0,
    p2Seconds: 0,

    // AI Memory (Hunt & Target Strategy)
    aiTargetStack: [], 
    
    // Deployment
    deployingPlayer: 1,
    selectedShipIdx: 0,
    isHorizontal: true,
    p1Buffer: [],
    p2Buffer: [],

    // Players
    p1: createPlayer(),
    p2: createPlayer()
};

/* --- 3. DOM ELEMENTS --- */
const DOM = {
    screens: {
        menu: document.getElementById('main-menu'),
        profile: document.getElementById('profile-screen'),
        deploy: document.getElementById('deployment-screen'),
        transition: document.getElementById('transition-screen'),
        game: document.getElementById('game-screen'),
        leaderboard: document.getElementById('leaderboard-screen'),
        settings: document.getElementById('settings-modal'),
        gameOver: document.getElementById('game-over-modal'),
        howToPlay: document.getElementById('how-to-play-screen')
    },
    hud: {
        p1Box: document.getElementById('p1-stat-box'),
        p2Box: document.getElementById('p2-stat-box'),
        p1Score: document.getElementById('p1-score'),
        p2Score: document.getElementById('p2-score'),
        p1Timer: document.getElementById('p1-timer'),
        p2Timer: document.getElementById('p2-timer'),
        p1Name: document.getElementById('p1-hud-name'),
        p2Name: document.getElementById('p2-hud-name'),
        turn: document.getElementById('turn-indicator')
    },
    audio: {
        fire: document.getElementById('sfx-fire'),
        hit: document.getElementById('sfx-hit'),
        win: document.getElementById('sfx-win'),
        lose: document.getElementById('sfx-lose'),
        menu: document.getElementById('sfx-menu')
    }
};

/* --- 4. INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateText();
    initVolume(); // Set initial volume
    attachButtonSounds();
    
    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (state.phase === 'deploy' && (e.key === 'r' || e.key === 'R')) {
            rotateShip();
        }
    });
});

function createPlayer() {
    return { name: "", ships: [], shots: [], moves: 0, score: 0 };
}

function attachButtonSounds() {
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => playSound('menu'));
    });
}

/* --- 5. NAVIGATION --- */
function switchScreen(name) {
    // Hide all screens
    Object.values(DOM.screens).forEach(s => {
        if(s) s.classList.add('hidden');
    });
    // Show target
    if(DOM.screens[name]) DOM.screens[name].classList.remove('hidden');
    state.phase = name;
}

function showProfileScreen(mode) {
    state.mode = mode;
    document.getElementById('p2-input-group').style.display = (mode === 'computer') ? 'none' : 'block';
    // Clear inputs
    document.getElementById('p1-name-input').value = "";
    document.getElementById('p2-name-input').value = "";
    switchScreen('profile');
}

function showHowToPlay() {
    switchScreen('howToPlay');
}

function validateAndStart() {
    const p1Name = document.getElementById('p1-name-input').value.trim();
    const p2Name = document.getElementById('p2-name-input').value.trim();
    const t = TEXTS[state.lang];

    if (!p1Name) { alert(t.alertName); return; }
    if (state.mode === 'player' && !p2Name) { alert(t.alertName); return; }

    // Init Players
    state.p1 = createPlayer(); state.p1.name = p1Name;
    state.p2 = createPlayer(); state.p2.name = (state.mode === 'computer') ? t.cpu : p2Name;
    
    // Reset State
    state.aiTargetStack = [];
    state.p1Seconds = 0; state.p2Seconds = 0;
    state.p1Buffer = []; state.p2Buffer = [];
    state.deployingPlayer = 1;
    
    setupDeployUI();
    switchScreen('deploy');
}

/* --- 6. DEPLOYMENT LOGIC --- */
function setupDeployUI() {
    state.selectedShipIdx = 0;
    const isP1 = state.deployingPlayer === 1;
    const name = isP1 ? state.p1.name : state.p2.name;
    const t = TEXTS[state.lang];

    document.getElementById('deploy-player-title').textContent = `${t.place} ${name}`;
    document.getElementById('deploy-status').textContent = "";
    document.getElementById('btn-start-battle').classList.add('disabled');
    document.getElementById('btn-start-battle').disabled = true;

    // Build Dock
    const dock = document.getElementById('ship-dock');
    dock.innerHTML = '';
    CONFIG.ships.forEach((ship, i) => {
        const el = document.createElement('div');
        el.className = 'dock-ship' + (i === 0 ? ' selected' : '');
        el.textContent = `${ship.name} (${ship.size})`;
        el.onclick = () => selectShipIdx(i);
        dock.appendChild(el);
    });

    // Build Grid
    const grid = document.getElementById('deploy-grid');
    grid.innerHTML = '';
    for(let i=0; i<100; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        // Event Listeners for placement
        cell.onmouseenter = () => previewShip(i);
        cell.onmouseleave = () => clearPreview();
        cell.onclick = () => placeShip(i);
        grid.appendChild(cell);
    }
}

function selectShipIdx(i) {
    state.selectedShipIdx = i;
    document.querySelectorAll('.dock-ship').forEach(d => d.classList.remove('selected'));
    document.getElementById('ship-dock').children[i].classList.add('selected');
}

function rotateShip() {
    playSound('menu');
    state.isHorizontal = !state.isHorizontal;
    
    // FIX: Re-render preview immediately if mouse is hovering
    // We find the currently hovered cell and re-trigger preview
    const hovered = document.querySelector('#deploy-grid .cell:hover');
    if (hovered) {
        clearPreview();
        // Calculate index based on child position
        const index = Array.prototype.indexOf.call(hovered.parentNode.children, hovered);
        previewShip(index);
    }
}

function getCoords(idx, size, horiz) {
    const x = idx % 10;
    const y = Math.floor(idx / 10);
    const coords = [];
    for(let i=0; i<size; i++) {
        if(horiz) {
            if(x + i > 9) return null; // Out of bounds
            coords.push(idx + i);
        } else {
            if(y + i > 9) return null; // Out of bounds
            coords.push(idx + (i * 10));
        }
    }
    return coords;
}

function previewShip(idx) {
    if(state.selectedShipIdx >= CONFIG.ships.length) return;
    const ship = CONFIG.ships[state.selectedShipIdx];
    const coords = getCoords(idx, ship.size, state.isHorizontal);
    const buffer = state.deployingPlayer === 1 ? state.p1Buffer : state.p2Buffer;
    const grid = document.getElementById('deploy-grid');
    
    if (coords) {
        // Check collision
        const valid = !coords.some(c => buffer.some(s => s.coords.includes(c)));
        coords.forEach(c => {
            if(grid.children[c]) grid.children[c].classList.add(valid ? 'preview' : 'invalid');
        });
    }
}

function clearPreview() {
    document.querySelectorAll('#deploy-grid .cell').forEach(c => c.classList.remove('preview', 'invalid'));
}

function placeShip(idx) {
    if(state.selectedShipIdx >= CONFIG.ships.length) return;
    const ship = CONFIG.ships[state.selectedShipIdx];
    const coords = getCoords(idx, ship.size, state.isHorizontal);
    const buffer = state.deployingPlayer === 1 ? state.p1Buffer : state.p2Buffer;

    if(!coords || coords.some(c => buffer.some(s => s.coords.includes(c)))) { 
        playSound('menu'); // Error sound
        return; 
    }

    playSound('menu'); // Success sound
    buffer.push({ ...ship, coords, hits: 0 });
    
    // Mark on Grid
    const grid = document.getElementById('deploy-grid');
    coords.forEach(c => grid.children[c].classList.add('ship'));
    
    // Mark on Dock
    const dock = document.getElementById('ship-dock');
    dock.children[state.selectedShipIdx].classList.add('placed');
    dock.children[state.selectedShipIdx].classList.remove('selected');

    state.selectedShipIdx++;
    if(state.selectedShipIdx < CONFIG.ships.length) {
        dock.children[state.selectedShipIdx].classList.add('selected');
    } else {
        document.getElementById('btn-start-battle').classList.remove('disabled');
        document.getElementById('btn-start-battle').disabled = false;
        document.getElementById('deploy-status').textContent = "READY!";
    }
}

function confirmDeployment() {
    playSound('menu');
    if(state.deployingPlayer === 1) {
        state.p1.ships = [...state.p1Buffer];
        if(state.mode === 'computer') {
            state.p2.ships = generateRandomShips();
            startBattle();
        } else {
            state.deployingPlayer = 2;
            showTransition(state.p2.name, setupDeployUI);
        }
    } else {
        state.p2.ships = [...state.p2Buffer];
        startBattle();
    }
}

function generateRandomShips() {
    const ships = [];
    const occupied = new Set();
    CONFIG.ships.forEach(s => {
        let placed = false;
        while(!placed) {
            const idx = Math.floor(Math.random() * 100);
            const horiz = Math.random() > 0.5;
            const coords = getCoords(idx, s.size, horiz);
            if(coords && !coords.some(c => occupied.has(c))) {
                coords.forEach(c => occupied.add(c));
                ships.push({ ...s, coords, hits: 0 });
                placed = true;
            }
        }
    });
    return ships;
}

/* --- 7. BATTLE ENGINE --- */
function startBattle() {
    state.turn = 1;
    state.isLocked = false;
    
    // Setup HUD Names
    DOM.hud.p1Name.textContent = state.p1.name;
    DOM.hud.p2Name.textContent = state.p2.name;

    // Start Timer
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(gameTimerTick, 1000);

    // Initial Grids
    initBattleGrid('radar-grid', true);
    initBattleGrid('fleet-grid', false);
    switchScreen('game');

    if(state.mode === 'player') {
        showTransition(state.p1.name, renderTurn);
    } else {
        renderTurn();
    }
}

function gameTimerTick() {
    if (state.turn === 1) {
        state.p1Seconds++;
        DOM.hud.p1Timer.textContent = formatTime(state.p1Seconds);
    } else {
        state.p2Seconds++;
        DOM.hud.p2Timer.textContent = formatTime(state.p2Seconds);
    }
}

function formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function initBattleGrid(id, interactive) {
    const grid = document.getElementById(id);
    grid.innerHTML = '';
    for(let i=0; i<100; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        if(interactive) cell.onclick = () => handleShot(i);
        grid.appendChild(cell);
    }
}

function renderTurn() {
    const t = TEXTS[state.lang];
    const isP1 = state.turn === 1;

    // Highlight active player
    DOM.hud.p1Box.classList.toggle('active', isP1);
    DOM.hud.p2Box.classList.toggle('active', !isP1);
    
    // Update Scores
    DOM.hud.p1Score.textContent = state.p1.score;
    DOM.hud.p2Score.textContent = state.p2.score;

    if (state.mode === 'computer') {
        DOM.hud.turn.textContent = isP1 ? t.turnYou : t.turnOpp;
        // PvC: Always P1 perspective
        // Radar (Left): P2 Ships (Hidden), P1 Shots
        updateGrid('radar-grid', state.p2.ships, state.p1.shots, true);
        // Fleet (Right): P1 Ships (Visible), P2 Shots
        updateGrid('fleet-grid', state.p1.ships, state.p2.shots, false);
    } else {
        // PvP: Perspective swaps
        const active = isP1 ? state.p1 : state.p2;
        const opponent = isP1 ? state.p2 : state.p1;
        DOM.hud.turn.textContent = t.turnYou;
        updateGrid('radar-grid', opponent.ships, active.shots, true);
        updateGrid('fleet-grid', active.ships, opponent.shots, false);
    }
}

function updateGrid(id, ships, shots, hideShips) {
    const grid = document.getElementById(id);
    for(let i=0; i<100; i++) {
        const cell = grid.children[i];
        // Reset classes but keep base 'cell'
        cell.className = 'cell';
        
        const ship = ships.find(s => s.coords.includes(i));
        const shot = shots.find(s => s.index === i);

        if(ship) {
            const isSunk = ship.hits >= ship.size;
            // Reveal if my ship OR if sunk
            if(!hideShips || isSunk) {
                cell.classList.add('ship');
                if(isSunk) cell.classList.add('sunk');
            }
        }
        if(shot) {
            cell.classList.add(shot.hit ? 'hit' : 'miss');
        }
        if(hideShips && !shot) {
            cell.classList.add('interactive');
        }
    }
}

function handleShot(idx) {
    // 1. Validation checks
    if(state.isLocked || !DOM.screens.transition.classList.contains('hidden')) return;

    const p1Turn = state.turn === 1;
    const attacker = p1Turn ? state.p1 : state.p2;
    const defender = p1Turn ? state.p2 : state.p1;

    // Prevent AI turn hijacking
    if(state.mode === 'computer' && !p1Turn) return; 
    // Prevent double shooting
    if(attacker.shots.some(s => s.index === idx)) return;

    // 2. Fire!
    state.isLocked = true;
    executeFire(idx, attacker, defender);
}

function executeFire(idx, attacker, defender) {
    playSound('fire');
    attacker.moves++;
    
    const ship = defender.ships.find(s => s.coords.includes(idx));
    const isHit = !!ship;
    
    attacker.shots.push({ index: idx, hit: isHit });

    if(isHit) {
        setTimeout(() => playSound('hit'), 200);
        ship.hits++;
        attacker.score += CONFIG.scores.hit;

        // Smart AI: Store neighbors for next shots
        if (state.mode === 'computer' && attacker === state.p2) {
            addNeighborsToStack(idx, attacker.shots);
        }

        // Check Sinking
        if (ship.hits === ship.size) {
            attacker.score += CONFIG.scores.sink; // Bonus
            
            // Carrier (Size 5) = Instant Win Rule
            if (ship.size === 5) {
                endGame(attacker, TEXTS[state.lang].carrierDown); 
                return;
            }
        }

        // Check Total Victory
        if (defender.ships.every(s => s.hits >= s.size)) {
            endGame(attacker, TEXTS[state.lang].win);
            return;
        }

        // BONUS TURN Logic (Do not swap)
        renderTurn();
        setTimeout(() => {
            state.isLocked = false; 
            // If Computer hit, it shoots again
            if (state.mode === 'computer' && state.turn === 2) {
                computerAI();
            }
        }, 800);

    } else {
        // MISS Logic (Swap Turn)
        renderTurn();
        setTimeout(swapTurn, 800);
    }
}

function swapTurn() {
    state.turn = state.turn === 1 ? 2 : 1;
    state.isLocked = false;

    if(state.mode === 'player') {
        const nextName = state.turn === 1 ? state.p1.name : state.p2.name;
        showTransition(nextName, renderTurn);
    } else {
        // PvC: Refresh
        renderTurn();
        // If CPU Turn, trigger AI
        if(state.turn === 2) {
            state.isLocked = true; // Lock player input
            setTimeout(computerAI, 500);
        }
    }
}

/* --- 8. AI ENGINE (Hunt & Target) --- */
function computerAI() {
    if(state.phase !== 'battle' || state.turn !== 2) return;
    
    const ai = state.p2;
    const player = state.p1;
    let targetIdx = -1;

    // 1. Target Strategy: Check stack
    while (state.aiTargetStack.length > 0) {
        const candidate = state.aiTargetStack.pop();
        // Valid & Not Shot
        if (candidate >= 0 && candidate < 100 && !ai.shots.some(s => s.index === candidate)) {
            targetIdx = candidate;
            break;
        }
    }

    // 2. Hunt Strategy: Random
    if (targetIdx === -1) {
        const validMoves = [];
        for(let i=0; i<100; i++) {
            if(!ai.shots.some(s => s.index === i)) validMoves.push(i);
        }
        if(validMoves.length > 0) {
            targetIdx = validMoves[Math.floor(Math.random() * validMoves.length)];
        }
    }

    if (targetIdx !== -1) {
        executeFire(targetIdx, ai, player);
    }
}

function addNeighborsToStack(idx, shots) {
    const x = idx % 10;
    const y = Math.floor(idx / 10);
    const potential = [
        { r: y - 1, c: x }, { r: y + 1, c: x }, { r: y, c: x - 1 }, { r: y, c: x + 1 }
    ];
    // Randomize order for "smart" feeling
    potential.sort(() => Math.random() - 0.5);

    potential.forEach(p => {
        if (p.r >= 0 && p.r < 10 && p.c >= 0 && p.c < 10) {
            const index = p.r * 10 + p.c;
            if (!shots.some(s => s.index === index)) {
                state.aiTargetStack.push(index);
            }
        }
    });
}

/* --- 9. GAME OVER & SCORING --- */
function endGame(winner, reason) {
    clearInterval(state.timerInterval);
    state.phase = 'gameover';
    
    const isWin = (winner === state.p1);
    const audioKey = (state.mode === 'computer' && !isWin) ? 'lose' : 'win';
    playSound(audioKey);

    // Save Score (Only PvC Wins)
    if (state.mode === 'computer' && isWin) {
        saveScore(winner.name, winner.moves, winner.score, state.p1Seconds);
    }

    // Update Modal
    const modal = document.getElementById('game-over-modal');
    document.getElementById('winner-title').textContent = reason;
    document.getElementById('winner-title').style.color = isWin ? 'gold' : 'red';
    document.getElementById('end-icon').className = isWin ? 'fas fa-medal fa-3x' : 'fas fa-skull-crossbones fa-3x';
    
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-moves').textContent = winner.moves;
    document.getElementById('winner-score').textContent = winner.score;
    
    switchScreen('gameOver');
}

function saveScore(name, moves, score, time) {
    let scores = JSON.parse(localStorage.getItem('battleship_rank') || '[]');
    scores.push({ name, moves, score, time });
    
    // Sort: Fewest Moves > Shortest Time
    scores.sort((a, b) => {
        if (a.moves !== b.moves) return a.moves - b.moves;
        return a.time - b.time;
    });
    
    // Keep top 10
    scores = scores.slice(0, 10);
    localStorage.setItem('battleship_rank', JSON.stringify(scores));
}

function showLeaderboard() {
    const scores = JSON.parse(localStorage.getItem('battleship_rank') || '[]');
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    scores.forEach((s, i) => {
        const row = document.createElement('tr');
        const m = Math.floor(s.time / 60).toString().padStart(2, '0');
        const sec = (s.time % 60).toString().padStart(2, '0');
        row.innerHTML = `<td>${i+1}</td><td>${s.name}</td><td>${s.moves}</td><td>${s.score}</td><td>${m}:${sec}</td>`;
        tbody.appendChild(row);
    });
    switchScreen('leaderboard');
}

/* --- 10. UTILS & SETTINGS --- */
function showTransition(nextName, callback) {
    const screen = DOM.screens.transition;
    document.getElementById('next-player-name').textContent = nextName;
    screen.classList.remove('hidden');
    // One-time listener
    screen.querySelector('.btn-primary').onclick = () => {
        playSound('menu');
        screen.classList.add('hidden');
        callback();
    };
}

function initVolume() {
    const slider = document.getElementById('volume-slider');
    if(slider) slider.value = state.volume;
}

function setVolume(val) {
    state.volume = parseFloat(val);
    localStorage.setItem('volume', state.volume);
    // Update active audio elements? 
    // Usually handled on play(), but let's force current updates if needed
}

function playSound(key) {
    const audio = DOM.audio[key];
    if(audio) {
        audio.volume = state.volume; // Apply volume
        audio.currentTime = 0;
        audio.play().catch(()=>{}); 
    }
}

function togglePause() { 
    playSound('menu'); 
    alert("PAUSED"); 
}

function quitGame() { 
    playSound('menu'); 
    if(confirm("Exit to Main Menu?")) switchScreen('menu'); 
}

function backToMenu() { switchScreen('menu'); }
function restartGame() { switchScreen('menu'); }

function initTheme() { if(state.theme === 'light') document.body.classList.add('light-mode'); }
function toggleTheme() { 
    state.theme = state.theme === 'dark' ? 'light' : 'dark'; 
    document.body.classList.toggle('light-mode'); 
    localStorage.setItem('theme', state.theme); 
}

function toggleLanguage() { 
    state.lang = state.lang === 'en' ? 'tr' : 'en'; 
    localStorage.setItem('lang', state.lang); 
    updateText(); 
}

function updateText() { 
    const t = TEXTS[state.lang]; 
    document.querySelectorAll('[data-tr]').forEach(el => { 
        el.textContent = el.getAttribute(`data-${state.lang}`); 
    }); 
}

function closeSettings() { DOM.screens.settings.classList.add('hidden'); }
function openSettings() { 
    initVolume(); // Ensure slider matches state
    DOM.screens.settings.classList.remove('hidden'); 
}
