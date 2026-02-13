/* =========================================
   BATTLESHIP ELITE: FINAL JS ENGINE
   ========================================= */

const CONFIG = {
    ships: [
        { name: "Carrier", size: 5 },
        { name: "Battleship", size: 4 },
        { name: "Cruiser", size: 3 },
        { name: "Submarine", size: 3 },
        { name: "Destroyer", size: 2 }
    ],
    scores: { hit: 10, sink: 10 }
};

const TEXTS = {
    en: {
        place: "Deploying:",
        rotate: "Rotate (R)",
        cpu: "TACTICAL AI",
        turnYou: "YOUR TURN",
        turnOpp: "ENEMY TURN",
        win: "VICTORY!",
        lose: "DEFEAT!",
        carrierDown: "HOSTILE CARRIER DESTROYED!",
        ready: "READY - START BATTLE",
        deploying: "Deploying..."
    },
    tr: {
        place: "Yerleştir:",
        rotate: "Döndür (R)",
        cpu: "YAPAY ZEKA",
        turnYou: "SIRA SİZDE",
        turnOpp: "DÜŞMAN SIRASI",
        win: "ZAFER!",
        lose: "YENİLGİ!",
        carrierDown: "DÜŞMAN AMİRAL GEMİSİ BATTI!",
        ready: "HAZIR - SAVAŞI BAŞLAT",
        deploying: "Yerleştiriliyor..."
    }
};

const state = {
    lang: localStorage.getItem('lang') || 'en',
    theme: localStorage.getItem('theme') || 'dark',
    volume: parseFloat(localStorage.getItem('volume')) || 1.0,
    mode: null, phase: 'menu', turn: 1, isLocked: false,
    timerInterval: null, p1Seconds: 0, p2Seconds: 0,
    aiTargetStack: [],
    deployingPlayer: 1, selectedShipIdx: 0, isHorizontal: true,
    p1Buffer: [], p2Buffer: [],
    p1: createPlayer(), p2: createPlayer()
};

const DOM = {
    screens: {
        menu: document.getElementById('main-menu'),
        profile: document.getElementById('profile-screen'),
        deploy: document.getElementById('deployment-screen'),
        transition: document.getElementById('transition-screen'),
        game: document.getElementById('game-screen'),
        settings: document.getElementById('settings-modal'),
        gameOver: document.getElementById('game-over-modal'),
        howToPlay: document.getElementById('how-to-play-screen'),
        leaderboard: document.getElementById('leaderboard-screen')
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

/* --- INIT --- */
document.addEventListener('DOMContentLoaded', () => {
    initTheme(); updateText(); initVolume(); attachButtonSounds();
    document.addEventListener('keydown', (e) => {
        if (state.phase === 'deploy' && (e.key === 'r' || e.key === 'R')) rotateShip();
    });
});

function createPlayer() { return { name: "", ships: [], shots: [], moves: 0, score: 0 }; }
function attachButtonSounds() { document.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => playSound('menu'))); }

/* --- NAVIGATION --- */
function switchScreen(name) {
    Object.values(DOM.screens).forEach(s => s && s.classList.add('hidden'));
    if(DOM.screens[name]) DOM.screens[name].classList.remove('hidden');
    state.phase = name;
}
function showProfileScreen(mode) {
    state.mode = mode;
    document.getElementById('p2-input-group').style.display = (mode === 'computer') ? 'none' : 'block';
    switchScreen('profile');
}
function showHowToPlay() { switchScreen('howToPlay'); }
function showLeaderboard() { renderLeaderboard(); switchScreen('leaderboard'); }
function backToMenu() { switchScreen('menu'); }

/* --- PROFILE & START --- */
function validateAndStart() {
    const p1Name = document.getElementById('p1-name-input').value.trim();
    const p2Name = document.getElementById('p2-name-input').value.trim();
    if (!p1Name) { alert("Enter Name!"); return; }
    if (state.mode === 'player' && !p2Name) { alert("Enter Name!"); return; }

    state.p1 = createPlayer(); state.p1.name = p1Name;
    state.p2 = createPlayer(); state.p2.name = (state.mode === 'computer') ? TEXTS[state.lang].cpu : p2Name;
    
    state.p1Buffer = []; state.p2Buffer = [];
    state.deployingPlayer = 1;
    state.aiTargetStack = [];
    state.p1Seconds = 0; state.p2Seconds = 0;
    
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
    document.getElementById('deploy-status').textContent = t.deploying;
    
    // DISABLE BUTTON
    const btn = document.getElementById('btn-start-battle');
    btn.classList.add('disabled');
    btn.disabled = true;

    // Render Dock
    const dock = document.getElementById('ship-dock');
    dock.innerHTML = '';
    CONFIG.ships.forEach((ship, i) => {
        const el = document.createElement('div');
        el.className = 'dock-ship' + (i === 0 ? ' selected' : '');
        el.textContent = `${ship.name} (${ship.size})`;
        el.onclick = () => selectShipIdx(i);
        dock.appendChild(el);
    });

    // Render Grid
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
        el.classList.toggle('selected', idx === i);
    });
}

function rotateShip() {
    playSound('menu');
    state.isHorizontal = !state.isHorizontal;
    const hovered = document.querySelector('#deploy-grid .cell:hover');
    if (hovered) {
        clearPreview();
        let idx = 0, el = hovered;
        while((el = el.previousSibling) != null) idx++;
        previewShip(idx);
    }
}

function getCoords(idx, size, horiz) {
    const x = idx % 10, y = Math.floor(idx / 10);
    const coords = [];
    for(let i=0; i<size; i++) {
        if(horiz) { if(x+i>9) return null; coords.push(idx+i); }
        else { if(y+i>9) return null; coords.push(idx+(i*10)); }
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
        coords.forEach(c => grid.children[c].classList.add(valid ? 'preview' : 'invalid'));
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
    
    // CHECK IF ALL PLACED
    if(state.selectedShipIdx < CONFIG.ships.length) {
        dock.children[state.selectedShipIdx].classList.add('selected');
    } else {
        // ENABLE BUTTON
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
    const ships = []; const occupied = new Set();
    CONFIG.ships.forEach(s => {
        let placed = false;
        while(!placed) {
            const idx = Math.floor(Math.random()*100);
            const horiz = Math.random()>0.5;
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
    state.turn = 1; state.isLocked = false;
    DOM.hud.p1Name.textContent = state.p1.name;
    DOM.hud.p2Name.textContent = state.p2.name;

    if(state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        if(state.turn === 1) { state.p1Seconds++; DOM.hud.p1Timer.textContent = formatTime(state.p1Seconds); }
        else { state.p2Seconds++; DOM.hud.p2Timer.textContent = formatTime(state.p2Seconds); }
    }, 1000);

    initBattleGrid('radar-grid', true);
    initBattleGrid('fleet-grid', false);
    switchScreen('game');
    
    if(state.mode === 'player') showTransition(state.p1.name, renderTurn);
    else renderTurn();
}

function formatTime(s) { return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }

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
    const isP1 = state.turn === 1;
    const t = TEXTS[state.lang];
    
    DOM.hud.p1Box.classList.toggle('active', isP1);
    DOM.hud.p2Box.classList.toggle('active', !isP1);
    DOM.hud.p1Score.textContent = state.p1.score;
    DOM.hud.p2Score.textContent = state.p2.score;

    if (state.mode === 'computer') {
        // PvC Mode: Always P1 View
        DOM.hud.turn.textContent = isP1 ? t.turnYou : t.turnOpp;
        updateGrid('radar-grid', state.p2.ships, state.p1.shots, true); // Enemy ships hidden
        updateGrid('fleet-grid', state.p1.ships, state.p2.shots, false); // My ships visible
    } else {
        // PvP Mode: Swap
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

        if(ship && (!hideShips || (ship.hits >= ship.size))) {
            cell.classList.add('ship');
            if(ship.hits >= ship.size) cell.classList.add('sunk');
        }
        if(shot) cell.classList.add(shot.hit ? 'hit' : 'miss');
        if(hideShips && !shot) cell.classList.add('interactive');
    }
}

function handleShot(idx) {
    if(state.isLocked || !DOM.screens.transition.classList.contains('hidden')) return;
    
    const isP1 = state.turn === 1;
    const attacker = isP1 ? state.p1 : state.p2;
    const defender = isP1 ? state.p2 : state.p1;

    if(state.mode === 'computer' && !isP1) return; // Block human clicking for CPU
    if(attacker.shots.some(s => s.index === idx)) return; // Already shot

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

        if(state.mode === 'computer' && attacker === state.p2) addSmartTargets(idx, attacker.shots);

        if(ship.hits === ship.size) {
            attacker.score += CONFIG.scores.sink;
            if(ship.size === 5) { endGame(attacker, TEXTS[state.lang].carrierDown); return; }
        }
        if(defender.ships.every(s => s.hits >= s.size)) { endGame(attacker, TEXTS[state.lang].win); return; }

        renderTurn();
        setTimeout(() => {
            state.isLocked = false;
            // Bonus Turn for Hit
            if(state.mode === 'computer' && state.turn === 2) computerAI();
        }, 800);
    } else {
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
            setTimeout(computerAI, 500); // Trigger AI
        }
    }
}

/* --- AI --- */
function computerAI() {
    const ai = state.p2;
    let target = -1;

    // Hunt Mode (Smart Stack)
    while(state.aiTargetStack.length > 0) {
        const t = state.aiTargetStack.pop();
        if(t>=0 && t<100 && !ai.shots.some(s=>s.index===t)) { target = t; break; }
    }
    // Random Mode
    if(target === -1) {
        const valid = [];
        for(let i=0; i<100; i++) if(!ai.shots.some(s=>s.index===i)) valid.push(i);
        if(valid.length>0) target = valid[Math.floor(Math.random()*valid.length)];
    }

    if(target !== -1) executeFire(target, ai, state.p1);
}

function addSmartTargets(idx, shots) {
    const x = idx%10, y = Math.floor(idx/10);
    const neighbors = [{r:y-1,c:x}, {r:y+1,c:x}, {r:y,c:x-1}, {r:y,c:x+1}];
    neighbors.sort(() => Math.random()-0.5);
    neighbors.forEach(n => {
        if(n.r>=0 && n.r<10 && n.c>=0 && n.c<10) {
            const i = n.r*10 + n.c;
            if(!shots.some(s=>s.index===i)) state.aiTargetStack.push(i);
        }
    });
}

/* --- LEADERBOARD --- */
function renderLeaderboard() {
    const scores = JSON.parse(localStorage.getItem('battleship_rank') || '[]');
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    scores.forEach((s, i) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${i+1}</td><td>${s.name}</td><td>${s.moves}</td><td>${s.score}</td><td>${formatTime(s.time)}</td>`;
        tbody.appendChild(row);
    });
}
function saveScore(name, moves, score, time) {
    let scores = JSON.parse(localStorage.getItem('battleship_rank') || '[]');
    scores.push({ name, moves, score, time });
    scores.sort((a,b) => (a.moves - b.moves) || (a.time - b.time));
    localStorage.setItem('battleship_rank', JSON.stringify(scores.slice(0, 10)));
}

/* --- UTILS --- */
function endGame(winner, reason) {
    clearInterval(state.timerInterval);
    state.phase = 'gameover';
    const isWin = (winner === state.p1);
    playSound((state.mode === 'computer' && !isWin) ? 'lose' : 'win');
    
    if(state.mode === 'computer' && isWin) saveScore(winner.name, winner.moves, winner.score, state.p1Seconds);

    document.getElementById('winner-title').textContent = reason;
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-score').textContent = winner.score;
    switchScreen('gameOver');
}

function showTransition(name, cb) {
    const s = DOM.screens.transition;
    document.getElementById('next-player-name').textContent = name;
    s.classList.remove('hidden');
    s.querySelector('.btn-primary').onclick = () => { s.classList.add('hidden'); cb(); };
}

function playSound(k) { if(DOM.audio[k]) { DOM.audio[k].volume = state.volume; DOM.audio[k].currentTime=0; DOM.audio[k].play().catch(()=>{}); }}
function initVolume() { const v = document.getElementById('volume-slider'); if(v) v.value = state.volume; }
function setVolume(v) { state.volume = parseFloat(v); localStorage.setItem('volume', v); }
function toggleLanguage() { state.lang = (state.lang==='en')?'tr':'en'; localStorage.setItem('lang',state.lang); updateText(); }
function toggleTheme() { state.theme = (state.theme==='dark')?'light':'dark'; localStorage.setItem('theme',state.theme); initTheme(); }
function initTheme() { if(state.theme === 'light') document.body.classList.add('light-mode'); else document.body.classList.remove('light-mode'); }
function updateText() { document.querySelectorAll('[data-tr]').forEach(el => el.textContent = el.getAttribute(`data-${state.lang}`)); }
function openSettings() { initVolume(); DOM.screens.settings.classList.remove('hidden'); }
function closeSettings() { DOM.screens.settings.classList.add('hidden'); }
function togglePause() { playSound('menu'); alert("GAME PAUSED"); }
function restartGame() { switchScreen('menu'); }
function quitGame() { if(confirm("Quit?")) switchScreen('menu'); }
