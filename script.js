/* =========================================
   BATTLESHIP ELITE: ULTIMATE EDITION
   ========================================= */

/* --- 1. CONFIGURATION & TEXTS --- */
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
        sink: 10 // Bonus points
    }
};

const TEXTS = {
    en: {
        place: "Deploying:",
        rotate: "Rotate (Press 'R')",
        cpu: "TACTICAL AI",
        turnYou: "YOUR TURN - AWAITING ORDERS",
        turnOpp: "ENEMY TURN - EVASIVE MANEUVERS",
        win: "VICTORY! ENEMY FLEET NEUTRALIZED",
        lose: "DEFEAT! OUR FLEET IS LOST",
        carrierDown: "HOSTILE CARRIER DESTROYED!",
        alertName: "Commander, please identify yourself!",
        ready: "FLEET READY - AWAITING ORDER",
        deploying: "DEPLOYING SHIPS..."
    },
    tr: {
        place: "Yerleştir:",
        rotate: "Döndür ('R' Tuşu)",
        cpu: "YAPAY ZEKA",
        turnYou: "SIRA SİZDE - EMİR BEKLENİYOR",
        turnOpp: "DÜŞMAN SIRASI - KAÇINMA MANEVRASI",
        win: "ZAFER! DÜŞMAN FİLOSU YOK EDİLDİ",
        lose: "YENİLGİ! FİLOMUZU KAYBETTİK",
        carrierDown: "DÜŞMAN AMİRAL GEMİSİ BATTI!",
        alertName: "Komutan, lütfen kimliğinizi girin!",
        ready: "FİLO HAZIR - EMİR BEKLENİYOR",
        deploying: "GEMİLER YERLEŞTİRİLİYOR..."
    }
};

/* --- 2. GAME STATE --- */
const state = {
    lang: localStorage.getItem('lang') || 'en',
    theme: localStorage.getItem('theme') || 'dark',
    volume: parseFloat(localStorage.getItem('volume')) || 1.0,
    
    mode: null,
    phase: 'menu',
    turn: 1,
    isLocked: false,
    
    // Timers
    timerInterval: null,
    p1Seconds: 0,
    p2Seconds: 0,

    // AI Intelligence (Smart Targeting)
    aiState: 'hunt', // 'hunt', 'target', 'line'
    aiHitStack: [],  // Stores successful hits on current target
    aiPotentialTargets: [], // Neighbors to try
    
    // Deployment
    deployingPlayer: 1,
    selectedShipIdx: 0,
    isHorizontal: true,
    p1Buffer: [],
    p2Buffer: [],

    // Player Objects
    p1: createPlayer(),
    p2: createPlayer()
};

/* --- 3. DOM CACHE --- */
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
    initVolume();
    attachButtonSounds();
    
    // Rotation Hotkey
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
    Object.values(DOM.screens).forEach(s => { if(s) s.classList.add('hidden'); });
    if(DOM.screens[name]) DOM.screens[name].classList.remove('hidden');
    state.phase = name;
}

function showProfileScreen(mode) {
    state.mode = mode;
    document.getElementById('p2-input-group').style.display = (mode === 'computer') ? 'none' : 'block';
    document.getElementById('p1-name-input').value = "";
    document.getElementById('p2-name-input').value = "";
    switchScreen('profile');
}

function showHowToPlay() { switchScreen('howToPlay'); }

function validateAndStart() {
    const p1Name = document.getElementById('p1-name-input').value.trim();
    const p2Name = document.getElementById('p2-name-input').value.trim();
    const t = TEXTS[state.lang];

    if (!p1Name) { alert(t.alertName); return; }
    if (state.mode === 'player' && !p2Name) { alert(t.alertName); return; }

    state.p1 = createPlayer(); state.p1.name = p1Name;
    state.p2 = createPlayer(); state.p2.name = (state.mode === 'computer') ? t.cpu : p2Name;
    
    // Reset Logic
    resetAI();
    state.p1Seconds = 0; state.p2Seconds = 0;
    state.p1Buffer = []; state.p2Buffer = [];
    state.deployingPlayer = 1;
    
    setupDeployUI();
    switchScreen('deploy');
}

function resetAI() {
    state.aiState = 'hunt';
    state.aiHitStack = [];
    state.aiPotentialTargets = [];
}

/* --- 6. DEPLOYMENT SYSTEM --- */
function setupDeployUI() {
    state.selectedShipIdx = 0;
    const isP1 = state.deployingPlayer === 1;
    const name = isP1 ? state.p1.name : state.p2.name;
    const t = TEXTS[state.lang];

    document.getElementById('deploy-player-title').textContent = `${t.place} ${name}`;
    document.getElementById('deploy-status').textContent = t.deploying;
    
    // DISABLE BUTTON INITIALLY
    const btn = document.getElementById('btn-start-battle');
    btn.classList.add('disabled');
    btn.disabled = true;

    // Populate Dock
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
        cell.onmouseenter = () => previewShip(i);
        cell.onmouseleave = () => clearPreview();
        cell.onclick = () => placeShip(i);
        grid.appendChild(cell);
    }
}

function selectShipIdx(i) {
    state.selectedShipIdx = i;
    Array.from(document.getElementById('ship-dock').children).forEach((el, idx) => {
        if(idx === i) el.classList.add('selected');
        else el.classList.remove('selected');
    });
}

function rotateShip() {
    playSound('menu');
    state.isHorizontal = !state.isHorizontal;
    
    const hovered = document.querySelector('#deploy-grid .cell:hover');
    if (hovered) {
        clearPreview();
        let idx = 0;
        let el = hovered;
        while((el = el.previousSibling) != null) idx++;
        previewShip(idx);
    }
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

    if(!coords || coords.some(c => buffer.some(s => s.coords.includes(c)))) { 
        playSound('menu'); 
        return; 
    }

    playSound('menu');
    buffer.push({ ...ship, coords, hits: 0 });
    
    const grid = document.getElementById('deploy-grid');
    coords.forEach(c => grid.children[c].classList.add('ship'));
    
    const dock = document.getElementById('ship-dock');
    dock.children[state.selectedShipIdx].classList.add('placed');
    dock.children[state.selectedShipIdx].classList.remove('selected');

    state.selectedShipIdx++;

    // **CRITICAL FIX: Start Button ONLY enables if ALL ships are placed**
    if(state.selectedShipIdx < CONFIG.ships.length) {
        dock.children[state.selectedShipIdx].classList.add('selected');
    } else {
        document.getElementById('deploy-status').textContent = TEXTS[state.lang].ready;
        const btn = document.getElementById('btn-start-battle');
        btn.classList.remove('disabled');
        btn.disabled = false;
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

/* --- 7. BATTLE LOGIC --- */
function startBattle() {
    state.turn = 1;
    state.isLocked = false;
    
    DOM.hud.p1Name.textContent = state.p1.name;
    DOM.hud.p2Name.textContent = state.p2.name;

    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(gameTimerTick, 1000);

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

    DOM.hud.p1Box.classList.toggle('active', isP1);
    DOM.hud.p2Box.classList.toggle('active', !isP1);
    DOM.hud.p1Score.textContent = state.p1.score;
    DOM.hud.p2Score.textContent = state.p2.score;

    if (state.mode === 'computer') {
        DOM.hud.turn.textContent = isP1 ? t.turnYou : t.turnOpp;
        updateGrid('radar-grid', state.p2.ships, state.p1.shots, true); // Radar (P1 shots at P2)
        updateGrid('fleet-grid', state.p1.ships, state.p2.shots, false); // Fleet (P2 shots at P1)
    } else {
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
    if(state.isLocked || !DOM.screens.transition.classList.contains('hidden')) return;

    const p1Turn = state.turn === 1;
    const attacker = p1Turn ? state.p1 : state.p2;
    const defender = p1Turn ? state.p2 : state.p1;

    if(state.mode === 'computer' && !p1Turn) return;
    if(attacker.shots.some(s => s.index === idx)) return;

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

        // **AI LOGIC UPDATE**
        if (state.mode === 'computer' && attacker === state.p2) {
            handleAIHit(idx);
        }

        if (ship.hits === ship.size) {
            attacker.score += CONFIG.scores.sink;
            if (state.mode === 'computer' && attacker === state.p2) {
                // Ship sunk, return to hunt mode
                resetAI(); 
            }
            
            if (ship.size === 5) {
                endGame(attacker, TEXTS[state.lang].carrierDown);
                return;
            }
        }
        
        if (defender.ships.every(s => s.hits >= s.size)) {
            endGame(attacker, TEXTS[state.lang].win);
            return;
        }

        // Hit = Bonus Turn
        renderTurn();
        setTimeout(() => {
            state.isLocked = false;
            if (state.mode === 'computer' && state.turn === 2) {
                computerAI();
            }
        }, 600);

    } else {
        // Miss = Swap
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
        renderTurn();
        if(state.turn === 2) {
            state.isLocked = true;
            setTimeout(computerAI, 500);
        }
    }
}

/* --- 8. SMART AI: LINE FIRE LOGIC --- */
function handleAIHit(idx) {
    // Add current hit to stack
    state.aiHitStack.push(idx);
    
    // Sort hits to determine orientation easily
    state.aiHitStack.sort((a, b) => a - b);

    // If we have 2 or more hits, we can determine a line
    if (state.aiHitStack.length >= 2) {
        const first = state.aiHitStack[0];
        const second = state.aiHitStack[1];
        
        // Difference: 1 = Horizontal, 10 = Vertical
        const diff = second - first;
        
        if (diff === 1) state.aiState = 'line-horiz';
        else if (diff === 10) state.aiState = 'line-vert';
        else state.aiState = 'target'; // Fallback if disjointed (rare)
    } else {
        // Just one hit, go to target mode (check neighbors)
        state.aiState = 'target';
    }
}

function computerAI() {
    if(state.phase !== 'battle' || state.turn !== 2) return;
    
    const ai = state.p2;
    const player = state.p1;
    let targetIdx = -1;

    // 1. Line Fire Mode (We know the axis)
    if (state.aiState === 'line-horiz' || state.aiState === 'line-vert') {
        targetIdx = getLineTarget(ai.shots);
        // If line is exhausted but ship not sunk (unlikely with logic, but safety), fallback
        if (targetIdx === -1) state.aiState = 'target'; 
    }

    // 2. Target Mode (We have a hit, check neighbors)
    if (state.aiState === 'target' && targetIdx === -1) {
        // Use the last hit to find neighbors
        const lastHit = state.aiHitStack[state.aiHitStack.length - 1];
        targetIdx = getNeighborTarget(lastHit, ai.shots);
        
        // If no valid neighbors, go back to hunt (maybe disjointed ship?)
        if (targetIdx === -1) state.aiState = 'hunt';
    }

    // 3. Hunt Mode (Random)
    if (targetIdx === -1) {
        const valid = [];
        for(let i=0; i<100; i++) {
            if(!ai.shots.some(s => s.index === i)) valid.push(i);
        }
        if(valid.length > 0) {
            targetIdx = valid[Math.floor(Math.random() * valid.length)];
        }
    }

    if (targetIdx !== -1) {
        executeFire(targetIdx, ai, player);
    }
}

function getLineTarget(shots) {
    // Try to extend the line from ends of the hit stack
    const hits = state.aiHitStack;
    const isHoriz = state.aiState === 'line-horiz';
    const step = isHoriz ? 1 : 10;

    // Try shooting before the first hit
    const pre = hits[0] - step;
    if (isValidTarget(pre, shots) && isAligned(pre, hits[0], isHoriz)) return pre;

    // Try shooting after the last hit
    const post = hits[hits.length - 1] + step;
    if (isValidTarget(post, shots) && isAligned(post, hits[hits.length - 1], isHoriz)) return post;

    return -1;
}

function getNeighborTarget(center, shots) {
    const x = center % 10;
    const y = Math.floor(center / 10);
    const neighbors = [
        { r: y - 1, c: x }, { r: y + 1, c: x }, 
        { r: y, c: x - 1 }, { r: y, c: x + 1 }
    ];
    // Shuffle for randomness
    neighbors.sort(() => Math.random() - 0.5);

    for (let n of neighbors) {
        if (n.r >= 0 && n.r < 10 && n.c >= 0 && n.c < 10) {
            const idx = n.r * 10 + n.c;
            if (!shots.some(s => s.index === idx)) return idx;
        }
    }
    return -1;
}

function isValidTarget(idx, shots) {
    return idx >= 0 && idx < 100 && !shots.some(s => s.index === idx);
}

function isAligned(idx1, idx2, isHoriz) {
    if (isHoriz) return Math.floor(idx1 / 10) === Math.floor(idx2 / 10); // Same row
    return true; // Vertical alignment is handled by step math usually
}

/* --- UTILS --- */
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

function initVolume() { const s = document.getElementById('volume-slider'); if(s) s.value = state.volume; }
function setVolume(val) { state.volume = parseFloat(val); localStorage.setItem('volume', state.volume); }
function playSound(key) { if(DOM.audio[key]) { DOM.audio[key].volume = state.volume; DOM.audio[key].currentTime = 0; DOM.audio[key].play().catch(()=>{}); }}
function togglePause() { playSound('menu'); alert("PAUSED"); }
function quitGame() { playSound('menu'); if(confirm("Abort Mission?")) switchScreen('menu'); }
function backToMenu() { switchScreen('menu'); }
function restartGame() { switchScreen('menu'); }
function initTheme() { if(state.theme === 'light') document.body.classList.add('light-mode'); }
function toggleTheme() { state.theme = state.theme === 'dark' ? 'light' : 'dark'; document.body.classList.toggle('light-mode'); localStorage.setItem('theme', state.theme); }
function toggleLanguage() { state.lang = state.lang === 'en' ? 'tr' : 'en'; localStorage.setItem('lang', state.lang); updateText(); }
function updateText() { const t = TEXTS[state.lang]; document.querySelectorAll('[data-tr]').forEach(el => { el.textContent = el.getAttribute(`data-${state.lang}`); }); }
function closeSettings() { DOM.screens.settings.classList.add('hidden'); }
function openSettings() { initVolume(); DOM.screens.settings.classList.remove('hidden'); }
