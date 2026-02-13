/* =========================================
   BATTLESHIP ELITE: TACTICAL ENGINE v3
   ========================================= */

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
        sink: 10 // Bonus (Total 20 for the sinking shot)
    }
};

const TEXTS = {
    en: {
        place: "Deploying:",
        rotate: "Rotate (CAPS LOCK)",
        cpu: "TACTICAL AI",
        turnYou: "YOUR TURN",
        turnOpp: "OPPONENT'S TURN",
        win: "VICTORY!",
        lose: "DEFEAT!",
        carrierDown: "HOSTILE CARRIER DESTROYED! INSTANT WIN!",
        alertName: "Enter name!",
        you: "YOU",
        enemy: "ENEMY"
    },
    tr: {
        place: "Yerleştir:",
        rotate: "Döndür (CAPS LOCK)",
        cpu: "YAPAY ZEKA",
        turnYou: "SIRA SİZDE",
        turnOpp: "RAKİBİN SIRASI",
        win: "ZAFER!",
        lose: "YENİLGİ!",
        carrierDown: "DÜŞMAN AMİRAL GEMİSİ BATTI! ZAFER!",
        alertName: "İsim giriniz!",
        you: "SİZ",
        enemy: "DÜŞMAN"
    }
};

const state = {
    lang: localStorage.getItem('lang') || 'en',
    theme: localStorage.getItem('theme') || 'dark',
    mode: null,
    phase: 'menu',
    turn: 1,
    isLocked: false,
    
    // Timers
    timerInterval: null,
    p1Seconds: 0,
    p2Seconds: 0,

    // AI Memory (Hunt & Target)
    aiTargetStack: [], // Stack for adjacent targets
    
    deployingPlayer: 1,
    selectedShipIdx: 0,
    isHorizontal: true,
    p1Buffer: [],
    p2Buffer: [],

    p1: createPlayer(),
    p2: createPlayer()
};

const DOM = {
    screens: {
        menu: document.getElementById('main-menu'),
        profile: document.getElementById('profile-screen'),
        deploy: document.getElementById('deployment-screen'),
        transition: document.getElementById('transition-screen'),
        game: document.getElementById('game-screen'),
        leaderboard: document.getElementById('leaderboard-screen'),
        settings: document.getElementById('settings-modal'),
        gameOver: document.getElementById('game-over-modal')
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

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    updateText();
    attachButtonSounds();
    document.addEventListener('keydown', (e) => {
        if (state.phase === 'deploy' && (e.code === 'CapsLock' || e.getModifierState("CapsLock"))) {
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

/* --- NAVIGATION --- */
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

function validateAndStart() {
    const p1Name = document.getElementById('p1-name-input').value.trim();
    const p2Name = document.getElementById('p2-name-input').value.trim();
    const t = TEXTS[state.lang];

    if (!p1Name) { alert(t.alertName); return; }
    if (state.mode === 'player' && !p2Name) { alert(t.alertName); return; }

    state.p1 = createPlayer(); state.p1.name = p1Name;
    state.p2 = createPlayer(); state.p2.name = (state.mode === 'computer') ? t.cpu : p2Name;
    
    // Reset AI Memory
    state.aiTargetStack = [];
    state.p1Seconds = 0;
    state.p2Seconds = 0;

    state.p1Buffer = []; state.p2Buffer = [];
    state.deployingPlayer = 1;
    
    setupDeployUI();
    switchScreen('deploy');
}

/* --- DEPLOYMENT --- */
function setupDeployUI() {
    state.selectedShipIdx = 0;
    const isP1 = state.deployingPlayer === 1;
    const name = isP1 ? state.p1.name : state.p2.name;
    const t = TEXTS[state.lang];

    document.getElementById('deploy-player-title').textContent = `${t.place} ${name}`;
    document.getElementById('deploy-status').textContent = "";
    document.getElementById('btn-start-battle').classList.add('disabled');
    document.getElementById('btn-start-battle').disabled = true;

    const dock = document.getElementById('ship-dock');
    dock.innerHTML = '';
    CONFIG.ships.forEach((ship, i) => {
        const el = document.createElement('div');
        el.className = 'dock-ship' + (i === 0 ? ' selected' : '');
        el.textContent = `${ship.name} (${ship.size})`;
        el.onclick = () => selectShipIdx(i);
        dock.appendChild(el);
    });

    const grid = document.getElementById('deploy-grid');
    grid.innerHTML = '';
    for(let i=0; i<100; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
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
    state.isHorizontal = !state.isHorizontal;
    clearPreview();
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
    if (coords) {
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

    if(!coords || coords.some(c => buffer.some(s => s.coords.includes(c)))) { playSound('menu'); return; }

    playSound('menu');
    buffer.push({ ...ship, coords, hits: 0 });
    const grid = document.getElementById('deploy-grid');
    coords.forEach(c => grid.children[c].classList.add('ship'));
    
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

/* --- BATTLE ENGINE --- */
function startBattle() {
    state.turn = 1;
    state.isLocked = false;
    
    initBattleGrid('radar-grid', true);
    initBattleGrid('fleet-grid', false);
    
    // Set Names on HUD
    DOM.hud.p1Name.textContent = state.p1.name;
    DOM.hud.p2Name.textContent = state.p2.name;

    // Start Timer Interval
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(gameTimerTick, 1000);

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

    // Active Player / Opponent refs
    let active, opponent;
    
    if (state.mode === 'computer') {
        // In PvC, HUD always shows P1 perspective, but we highlight CPU box if it's CPU turn
        active = state.p1;
        opponent = state.p2;
        
        DOM.hud.p1Box.classList.toggle('active', isP1);
        DOM.hud.p2Box.classList.toggle('active', !isP1);
        DOM.hud.turn.textContent = isP1 ? t.turnYou : t.turnOpp;
    } else {
        // PvP
        active = isP1 ? state.p1 : state.p2;
        opponent = isP1 ? state.p2 : state.p1;
        
        DOM.hud.p1Box.classList.toggle('active', isP1);
        DOM.hud.p2Box.classList.toggle('active', !isP1);
        DOM.hud.turn.textContent = t.turnYou;
    }

    // Update Scores
    DOM.hud.p1Score.textContent = state.p1.score;
    DOM.hud.p2Score.textContent = state.p2.score;

    // Render Grids (Always from P1/Active perspective in PvC)
    // If PvC, we always show P1's radar and P1's fleet.
    if (state.mode === 'computer') {
        updateGrid('radar-grid', state.p2.ships, state.p1.shots, true); // P1 shooting at P2
        updateGrid('fleet-grid', state.p1.ships, state.p2.shots, false); // P2 shooting at P1
    } else {
        // PvP: Show Active Player's perspective
        updateGrid('radar-grid', opponent.ships, active.shots, true);
        updateGrid('fleet-grid', active.ships, opponent.shots, false);
    }
}

function updateGrid(id, ships, shots, hideShips) {
    const grid = document.getElementById(id);
    for(let i=0; i<100; i++) {
        const cell = grid.children[i];
        cell.className = 'cell';
        
        const ship = ships.find(s => s.coords.includes(i));
        const shot = shots.find(s => s.index === i);

        if(ship) {
            const isSunk = ship.hits >= ship.size;
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
    // 1. Validation
    if(state.isLocked || !DOM.screens.transition.classList.contains('hidden')) return;

    const p1Turn = state.turn === 1;
    const attacker = p1Turn ? state.p1 : state.p2;
    const defender = p1Turn ? state.p2 : state.p1;

    // Prevent AI click or double shot
    if(state.mode === 'computer' && !p1Turn) return; 
    if(attacker.shots.some(s => s.index === idx)) return;

    // 2. Execute Shot
    state.isLocked = true; // Lock immediately
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

        // Add Neighbors to AI Stack (If Computer)
        if (state.mode === 'computer' && attacker === state.p2) {
            addNeighborsToStack(idx, attacker.shots);
        }

        // Check Win
        if (ship.size === 5 && ship.hits === 5) {
            attacker.score += CONFIG.scores.sink; // Carrier Bonus
            endGame(attacker, TEXTS[state.lang].carrierDown); 
            return;
        }
        
        if (ship.hits === ship.size) {
            attacker.score += CONFIG.scores.sink; // Sinking Bonus
        }

        if (defender.ships.every(s => s.hits >= s.size)) {
            endGame(attacker, TEXTS[state.lang].win);
            return;
        }

        // BONUS TURN Logic
        renderTurn();
        setTimeout(() => {
            state.isLocked = false; 
            if (state.mode === 'computer' && state.turn === 2) {
                computerAI(); // AI shoots again
            }
        }, 1000);

    } else {
        // MISS -> Swap Turn
        renderTurn();
        setTimeout(swapTurn, 1000);
    }
}

function swapTurn() {
    state.turn = state.turn === 1 ? 2 : 1;
    state.isLocked = false;

    if(state.mode === 'player') {
        const nextName = state.turn === 1 ? state.p1.name : state.p2.name;
        showTransition(nextName, renderTurn);
    } else {
        renderTurn();
        if(state.turn === 2) {
            state.isLocked = true; // Lock player input during AI turn
            setTimeout(computerAI, 1000);
        }
    }
}

/* --- TACTICAL AI (Hunt & Target) --- */
function computerAI() {
    if(state.phase !== 'battle') return;
    const ai = state.p2;
    const player = state.p1;

    let targetIdx = -1;

    // 1. TARGET MODE: Check Stack
    while (state.aiTargetStack.length > 0) {
        const candidate = state.aiTargetStack.pop();
        // Check if valid and not shot yet
        if (candidate >= 0 && candidate < 100 && !ai.shots.some(s => s.index === candidate)) {
            targetIdx = candidate;
            break;
        }
    }

    // 2. HUNT MODE: Random if stack empty or invalid
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
        { r: y - 1, c: x }, // Up
        { r: y + 1, c: x }, // Down
        { r: y, c: x - 1 }, // Left
        { r: y, c: x + 1 }  // Right
    ];

    potential.forEach(p => {
        if (p.r >= 0 && p.r < 10 && p.c >= 0 && p.c < 10) {
            const index = p.r * 10 + p.c;
            // Only push if not already shot
            if (!shots.some(s => s.index === index)) {
                state.aiTargetStack.push(index);
            }
        }
    });
}

/* --- GAME OVER --- */
function endGame(winner, reason) {
    clearInterval(state.timerInterval);
    state.phase = 'gameover';
    
    const isWin = (winner === state.p1);
    const audioKey = (state.mode === 'computer' && !isWin) ? 'lose' : 'win';
    playSound(audioKey);

    if (state.mode === 'computer' && isWin) {
        saveScore(winner.name, winner.moves, winner.score, state.p1Seconds);
    }

    document.getElementById('winner-title').textContent = reason;
    document.getElementById('winner-title').style.color = isWin ? 'gold' : 'red';
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

/* --- UTILS --- */
function showTransition(nextName, callback) {
    const screen = DOM.screens.transition;
    document.getElementById('next-player-name').textContent = nextName;
    screen.classList.remove('hidden');
    screen.querySelector('.btn-primary').onclick = () => {
        playSound('menu');
        screen.classList.add('hidden');
        callback();
    };
}
function playSound(key) { if(DOM.audio[key]) { DOM.audio[key].currentTime = 0; DOM.audio[key].play().catch(()=>{}); }}
function togglePause() { playSound('menu'); alert("PAUSED"); }
function quitGame() { playSound('menu'); if(confirm("Exit?")) switchScreen('menu'); }
function backToMenu() { switchScreen('menu'); }
function restartGame() { switchScreen('menu'); }
function initTheme() { if(state.theme === 'light') document.body.classList.add('light-mode'); }
function toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; document.body.classList.toggle('light-mode'); localStorage.setItem('theme', state.theme); }
function toggleLanguage() { state.lang = state.lang === 'en' ? 'tr' : 'en'; localStorage.setItem('lang', state.lang); updateText(); }
function updateText() { const t = TEXTS[state.lang]; document.querySelectorAll('[data-tr]').forEach(el => { el.textContent = el.getAttribute(`data-${state.lang}`); }); }
function closeSettings() { DOM.screens.settings.classList.add('hidden'); }
function openSettings() { DOM.screens.settings.classList.remove('hidden'); }
