/* =========================================
   BATTLESHIP ELITE: FINAL ENGINE
   ========================================= */

// --- 1. CONFIGURATION ---
const CONFIG = {
    ships: [
        { name: "Carrier", size: 5, id: "carrier" },     // PRIMARY TARGET
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

const TEXTS = {
    en: {
        place: "Deploying:",
        rotate: "Rotate (CAPS LOCK)",
        p1Def: "Commander",
        p2Def: "Enemy",
        cpu: "AI TACTICAL",
        turn: "COMMANDING",
        win: "VICTORY",
        lose: "DEFEAT",
        carrierDown: "ENEMY CARRIER DESTROYED! INSTANT WIN!",
        await: "AWAITING ORDERS"
    },
    tr: {
        place: "Yerleştiriliyor:",
        rotate: "Döndür (CAPS LOCK)",
        p1Def: "Komutan",
        p2Def: "Düşman",
        cpu: "YAPAY ZEKA",
        turn: "KOMUTADA",
        win: "ZAFER",
        lose: "YENİLGİ",
        carrierDown: "DÜŞMAN AMİRAL GEMİSİ BATTI! KAZANDINIZ!",
        await: "EMİR BEKLENİYOR"
    }
};

// --- 2. STATE MANAGEMENT ---
const state = {
    lang: localStorage.getItem('lang') || 'en',
    theme: localStorage.getItem('theme') || 'dark',
    highScore: parseInt(localStorage.getItem('highScore')) || 0,
    
    mode: null,          // 'player' or 'computer'
    phase: 'menu',       // menu, profile, deploy, transition, battle, gameover
    turn: 1,             // 1 or 2
    
    // Deployment vars
    deployingPlayer: 1,
    selectedShipIdx: 0,
    isHorizontal: true,
    p1Buffer: [],
    p2Buffer: [],

    // Players
    p1: createPlayer(),
    p2: createPlayer()
};

// --- 3. DOM & AUDIO ---
const DOM = {
    screens: {
        menu: document.getElementById('main-menu'),
        profile: document.getElementById('profile-screen'),
        deploy: document.getElementById('deployment-screen'),
        transition: document.getElementById('transition-screen'),
        game: document.getElementById('game-screen'),
        settings: document.getElementById('settings-modal'),
        gameOver: document.getElementById('game-over-modal')
    },
    hud: {
        score: document.getElementById('score-display'),
        turn: document.getElementById('active-player-label'),
        status: document.getElementById('turn-status'),
        highScore: document.getElementById('menu-high-score')
    },
    audio: {
        fire: document.getElementById('sfx-fire'),
        hit: document.getElementById('sfx-hit'),
        win: document.getElementById('sfx-win'),
        lose: document.getElementById('sfx-lose'), // Mapped to miss.mp3 for Defeat
        menu: document.getElementById('sfx-menu')
    }
};

// --- 4. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateText();
    DOM.hud.highScore.textContent = state.highScore;
    attachButtonSounds();

    // Rotation Handler (Caps Lock)
    document.addEventListener('keydown', (e) => {
        if (state.phase === 'deploy' && e.getModifierState("CapsLock")) {
            rotateShip();
        } else if (state.phase === 'deploy' && e.code === 'CapsLock') {
            rotateShip(); // Fallback for some browsers
        }
    });
});

function createPlayer() {
    return { name: "Player", ships: [], shots: [], score: 0 };
}

function attachButtonSounds() {
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => playSound('menu'));
    });
}

// --- 5. NAVIGATION ---
function switchScreen(name) {
    Object.values(DOM.screens).forEach(s => s.classList.add('hidden'));
    DOM.screens[name].classList.remove('hidden');
    state.phase = name;
}

function showProfileScreen(mode) {
    state.mode = mode;
    document.getElementById('p2-input-group').style.display = (mode === 'computer') ? 'none' : 'block';
    switchScreen('profile');
}

function startDeployment() {
    const t = TEXTS[state.lang];
    state.p1.name = document.getElementById('p1-name-input').value.trim() || t.p1Def;
    state.p2.name = (state.mode === 'computer') 
        ? t.cpu 
        : (document.getElementById('p2-name-input').value.trim() || t.p2Def);

    // Reset Games
    state.p1.ships = []; state.p1.shots = []; state.p1.score = 0;
    state.p2.ships = []; state.p2.shots = []; state.p2.score = 0;
    state.p1Buffer = []; state.p2Buffer = [];
    
    state.deployingPlayer = 1;
    setupDeployUI();
    switchScreen('deploy');
}

// --- 6. DEPLOYMENT SYSTEM ---
function setupDeployUI() {
    state.selectedShipIdx = 0;
    const isP1 = state.deployingPlayer === 1;
    const name = isP1 ? state.p1.name : state.p2.name;
    const t = TEXTS[state.lang];

    document.getElementById('deploy-player-title').textContent = `${t.place} ${name}`;
    document.getElementById('deploy-status').textContent = "";
    
    const btn = document.getElementById('btn-start-battle');
    btn.disabled = true;
    btn.classList.add('disabled');

    // Create Dock
    const dock = document.getElementById('ship-dock');
    dock.innerHTML = '';
    CONFIG.ships.forEach((ship, i) => {
        const el = document.createElement('div');
        el.className = 'dock-ship' + (i === 0 ? ' selected' : '');
        el.textContent = `${ship.name} (${ship.size})`;
        el.onclick = () => {
            state.selectedShipIdx = i;
            document.querySelectorAll('.dock-ship').forEach(d => d.classList.remove('selected'));
            el.classList.add('selected');
        };
        dock.appendChild(el);
    });

    // Create Grid (Once)
    const grid = document.getElementById('deploy-grid');
    grid.innerHTML = ''; // Fresh grid for new player
    for(let i=0; i<100; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.idx = i;
        cell.onmouseenter = () => previewShip(i);
        cell.onmouseleave = () => clearPreview();
        cell.onclick = () => placeShip(i);
        grid.appendChild(cell);
    }
}

function rotateShip() {
    state.isHorizontal = !state.isHorizontal;
    clearPreview(); // Clear old rotation
}

function getCoords(idx, size, horiz) {
    const x = idx % 10;
    const y = Math.floor(idx / 10);
    const coords = [];
    
    for(let i=0; i<size; i++) {
        if(horiz) {
            if(x + i > 9) return null;
            coords.push(idx + i);
        } else {
            if(y + i > 9) return null;
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
    const valid = coords && !coords.some(c => buffer.some(s => s.coords.includes(c)));

    if(coords) {
        coords.forEach(c => {
            if(grid.children[c]) {
                grid.children[c].classList.add(valid ? 'preview' : 'invalid');
            }
        });
    }
}

function clearPreview() {
    document.querySelectorAll('#deploy-grid .cell').forEach(c => {
        c.classList.remove('preview', 'invalid');
    });
}

function placeShip(idx) {
    if(state.selectedShipIdx >= CONFIG.ships.length) return;

    const ship = CONFIG.ships[state.selectedShipIdx];
    const coords = getCoords(idx, ship.size, state.isHorizontal);
    const buffer = state.deployingPlayer === 1 ? state.p1Buffer : state.p2Buffer;

    // Validate
    if(!coords || coords.some(c => buffer.some(s => s.coords.includes(c)))) {
        playSound('menu'); // Error sound (using menu click as generic alert)
        return;
    }

    // Place
    playSound('menu');
    buffer.push({ ...ship, coords, hits: 0 });
    
    // Update Grid Visuals
    const grid = document.getElementById('deploy-grid');
    coords.forEach(c => grid.children[c].classList.add('ship'));
    
    // Update Dock
    const dock = document.getElementById('ship-dock');
    dock.children[state.selectedShipIdx].classList.add('placed');
    dock.children[state.selectedShipIdx].classList.remove('selected');

    state.selectedShipIdx++;
    
    // Check Completion
    if(state.selectedShipIdx < CONFIG.ships.length) {
        dock.children[state.selectedShipIdx].classList.add('selected');
    } else {
        document.getElementById('deploy-status').textContent = "READY!";
        const btn = document.getElementById('btn-start-battle');
        btn.disabled = false;
        btn.classList.remove('disabled');
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

// --- 7. BATTLE ENGINE ---
function startBattle() {
    state.turn = 1;
    state.phase = 'battle';
    
    // Init Battle Grids (Fixed)
    initBattleGrid('radar-grid', true);
    initBattleGrid('fleet-grid', false);
    
    switchScreen('game');
    
    if(state.mode === 'player') {
        showTransition(state.p1.name, renderTurn);
    } else {
        renderTurn();
    }
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

function showTransition(nextName, callback) {
    const screen = DOM.screens.transition;
    document.getElementById('next-player-name').textContent = nextName;
    screen.classList.remove('hidden');
    
    const btn = screen.querySelector('.btn-primary');
    btn.onclick = () => {
        playSound('menu');
        screen.classList.add('hidden');
        callback();
    };
}

function renderTurn() {
    const p1Turn = state.turn === 1;
    const active = p1Turn ? state.p1 : state.p2;
    const opponent = p1Turn ? state.p2 : state.p1;
    const t = TEXTS[state.lang];

    // HUD Updates
    DOM.hud.turn.textContent = active.name;
    DOM.hud.score.textContent = active.score;
    DOM.hud.status.textContent = t.await;

    // LEFT SCREEN: RADAR (Shows Enemy Board, Hidden Ships)
    updateGrid('radar-grid', opponent.ships, active.shots, true);

    // RIGHT SCREEN: FLEET (Shows My Board, Visible Ships)
    updateGrid('fleet-grid', active.ships, opponent.shots, false);
}

function updateGrid(id, ships, shots, hideShips) {
    const grid = document.getElementById(id);
    const children = grid.children;

    for(let i=0; i<100; i++) {
        const cell = children[i];
        cell.className = 'cell'; // Reset

        // Check Ship
        const ship = ships.find(s => s.coords.includes(i));
        const shot = shots.find(s => s.index === i);
        
        // 1. Draw Ship (Only if own fleet OR if sunk on radar)
        if(ship) {
            const isSunk = ship.hits >= ship.size;
            if(!hideShips || isSunk) {
                cell.classList.add('ship');
                if(isSunk) cell.classList.add('sunk');
            }
        }

        // 2. Draw Marks
        if(shot) {
            cell.classList.add(shot.hit ? 'hit' : 'miss');
        }

        // 3. Hover (Radar only)
        if(hideShips && !shot) {
            cell.classList.add('interactive');
        }
    }
}

function handleShot(idx) {
    // Prevent shooting during transitions or if already shot
    if(!DOM.screens.transition.classList.contains('hidden')) return;
    
    const p1Turn = state.turn === 1;
    const attacker = p1Turn ? state.p1 : state.p2;
    const defender = p1Turn ? state.p2 : state.p1;

    if(attacker.shots.some(s => s.index === idx)) return; // Already shot

    // FIRE SOUND (Always plays on attempt)
    playSound('fire');

    // Logic
    const ship = defender.ships.find(s => s.coords.includes(idx));
    const isHit = !!ship;
    
    attacker.shots.push({ index: idx, hit: isHit });

    if(isHit) {
        playSound('hit');
        ship.hits++;
        attacker.score += CONFIG.scores.hit;

        // Check Sunk
        if(ship.hits >= ship.size) {
            attacker.score += CONFIG.scores.sink;
            
            // CARRIER RULE (Size 5)
            if(ship.size === 5) {
                attacker.score += CONFIG.scores.win;
                endGame(attacker, TEXTS[state.lang].carrierDown);
                renderTurn(); // Show final state
                return;
            }
        }

        // Check Total Wipeout
        if(defender.ships.every(s => s.hits >= s.size)) {
            endGame(attacker, TEXTS[state.lang].win);
            renderTurn();
            return;
        }

        // BONUS TURN RULE: If Hit, do NOT swap turn.
        // Just re-render and let AI fire again if needed.
        renderTurn();
        
        if(state.mode === 'computer' && state.turn === 2) {
            setTimeout(computerAI, 1000); // AI shoots again
        }

    } else {
        // MISS: Turn ends.
        // Note: No specific 'miss' sound requested here, only 'fire' sound.
        renderTurn();
        setTimeout(swapTurn, 800);
    }
}

function swapTurn() {
    state.turn = state.turn === 1 ? 2 : 1;

    if(state.mode === 'player') {
        const nextName = state.turn === 1 ? state.p1.name : state.p2.name;
        showTransition(nextName, renderTurn);
    } else {
        // Computer Mode
        renderTurn();
        if(state.turn === 2) {
            setTimeout(computerAI, 1000);
        }
    }
}

function computerAI() {
    if(state.phase !== 'battle') return;

    // AI Logic: Find valid targets
    const validMoves = [];
    for(let i=0; i<100; i++) {
        if(!state.p2.shots.some(s => s.index === i)) {
            validMoves.push(i);
        }
    }

    if(validMoves.length > 0) {
        // Random shot (Tactical AI is complex, sticking to random for stability)
        const move = validMoves[Math.floor(Math.random() * validMoves.length)];
        handleShot(move);
    }
}

// --- 8. GAME OVER ---
function endGame(winner, reason) {
    state.phase = 'gameover';
    
    // Save High Score
    if(winner.score > state.highScore) {
        state.highScore = winner.score;
        localStorage.setItem('highScore', state.highScore);
        DOM.hud.highScore.textContent = state.highScore;
    }

    // Determine Sound: Win or Lose (Miss.mp3)
    const isHumanWinner = (winner === state.p1);
    // If Human wins -> Win Sound. If CPU wins -> Lose Sound (Miss.mp3)
    if (state.mode === 'computer' && !isHumanWinner) {
        playSound('lose'); // Plays miss.mp3
        document.getElementById('winner-title').style.color = 'red';
        document.getElementById('end-icon').className = 'fas fa-skull-crossbones fa-3x';
    } else {
        playSound('win');
        document.getElementById('winner-title').style.color = 'gold';
        document.getElementById('end-icon').className = 'fas fa-medal fa-3x';
    }

    document.getElementById('winner-title').textContent = reason;
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-score').textContent = winner.score;
    
    switchScreen('gameOver');
}

// --- 9. UTILITIES ---
function playSound(key) {
    const audio = DOM.audio[key];
    if(audio) {
        audio.currentTime = 0;
        audio.play().catch(e => {});
    }
}

function togglePause() {
    playSound('menu');
    alert("GAME PAUSED");
}

function quitGame() {
    playSound('menu');
    if(confirm("Exit battle?")) {
        switchScreen('menu');
    }
}

function restartGame() {
    playSound('menu');
    switchScreen('menu');
}

function initTheme() {
    if(state.theme === 'light') document.body.classList.add('light-mode');
}

function toggleTheme() {
    playSound('menu');
    document.body.classList.toggle('light-mode');
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
}

function toggleLanguage() {
    playSound('menu');
    state.lang = state.lang === 'en' ? 'tr' : 'en';
    localStorage.setItem('lang', state.lang);
    updateText();
}

function updateText() {
    const t = TEXTS[state.lang];
    document.querySelectorAll('[data-tr]').forEach(el => {
        const key = state.lang === 'tr' ? 'data-tr' : 'data-en';
        el.textContent = el.getAttribute(key);
    });
}

function closeSettings() {
    playSound('menu');
    DOM.screens.settings.classList.add('hidden');
}

function openSettings() {
    playSound('menu');
    DOM.screens.settings.classList.remove('hidden');
}
