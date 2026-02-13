/* =========================================
   BATTLESHIP ELITE: STABLE ENGINE
   ========================================= */

const CONFIG = {
    ships: [
        { name: "Carrier", size: 5 },
        { name: "Battleship", size: 4 },
        { name: "Cruiser", size: 3 },
        { name: "Submarine", size: 3 },
        { name: "Destroyer", size: 2 }
    ]
};

const TEXTS = {
    en: {
        place: "Deploying:",
        rotate: "Rotate (CAPS LOCK)",
        cpu: "AI",
        turn: "'s Turn",
        win: "VICTORY!",
        lose: "DEFEAT!",
        carrierDown: "HOSTILE CARRIER DESTROYED! INSTANT WIN!",
        alertName: "Please enter commander name!",
        you: "YOU",
        enemy: "ENEMY"
    },
    tr: {
        place: "Yerleştiriliyor:",
        rotate: "Döndür (CAPS LOCK)",
        cpu: "Yapay Zeka",
        turn: "Sırası",
        win: "ZAFER!",
        lose: "YENİLGİ!",
        carrierDown: "DÜŞMAN AMİRAL GEMİSİ YOK EDİLDİ! ANINDA ZAFER!",
        alertName: "Lütfen komutan ismini girin!",
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
    isLocked: false, // Prevents multi-click
    timer: 0,
    timerInterval: null,
    
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
        moves: document.getElementById('move-display'),
        time: document.getElementById('time-display'),
        turn: document.getElementById('active-player-label')
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
    return { name: "", ships: [], shots: [], moves: 0 };
}

function attachButtonSounds() {
    document.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => playSound('menu'));
    });
}

// --- NAVIGATION & VALIDATION ---
function switchScreen(name) {
    Object.values(DOM.screens).forEach(s => s.classList.add('hidden'));
    DOM.screens[name].classList.remove('hidden');
    state.phase = name;
}

function showProfileScreen(mode) {
    state.mode = mode;
    document.getElementById('p2-input-group').style.display = (mode === 'computer') ? 'none' : 'block';
    document.getElementById('p1-name-input').value = "";
    document.getElementById('p2-name-input').value = "";
    switchScreen('profile');
}

function validateAndStart() {
    const p1Name = document.getElementById('p1-name-input').value.trim();
    const p2Name = document.getElementById('p2-name-input').value.trim();
    const t = TEXTS[state.lang];

    if (!p1Name) {
        alert(t.alertName);
        return;
    }
    if (state.mode === 'player' && !p2Name) {
        alert(t.alertName);
        return;
    }

    state.p1 = createPlayer();
    state.p1.name = p1Name;
    
    state.p2 = createPlayer();
    state.p2.name = (state.mode === 'computer') ? t.cpu : p2Name;

    state.p1Buffer = [];
    state.p2Buffer = [];
    state.deployingPlayer = 1;
    
    setupDeployUI();
    switchScreen('deploy');
}

// --- DEPLOYMENT ---
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

// --- BATTLE ---
function startBattle() {
    state.turn = 1;
    state.isLocked = false;
    state.timer = 0;
    
    // Timer Logic
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.timer++;
        updateTimerDisplay();
    }, 1000);

    initBattleGrid('radar-grid', true);
    initBattleGrid('fleet-grid', false);
    switchScreen('game');

    if(state.mode === 'player') {
        showTransition(state.p1.name, renderTurn);
    } else {
        renderTurn();
    }
}

function updateTimerDisplay() {
    const m = Math.floor(state.timer / 60).toString().padStart(2, '0');
    const s = (state.timer % 60).toString().padStart(2, '0');
    document.getElementById('time-display').textContent = `${m}:${s}`;
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
    screen.querySelector('.btn-primary').onclick = () => {
        playSound('menu');
        screen.classList.add('hidden');
        callback();
    };
}

// *** CRITICAL FIX: STABLE PERSPECTIVE ***
function renderTurn() {
    // In Computer mode: P1 is ALWAYS the active perspective.
    // In Player mode: We swap based on turn.
    let activePlayer, opponent;
    
    if (state.mode === 'computer') {
        activePlayer = state.p1;
        opponent = state.p2;
        // HUD Name
        DOM.hud.turn.textContent = state.turn === 1 ? state.p1.name : TEXTS[state.lang].cpu;
    } else {
        activePlayer = state.turn === 1 ? state.p1 : state.p2;
        opponent = state.turn === 1 ? state.p2 : state.p1;
        DOM.hud.turn.textContent = activePlayer.name;
    }

    DOM.hud.moves.textContent = activePlayer.moves;

    // RENDER LOGIC
    // RADAR (Left): Shows Opponent Ships (Hidden) + Active's Shots
    // FLEET (Right): Shows Active's Ships (Visible) + Opponent's Shots
    updateGrid('radar-grid', opponent.ships, activePlayer.shots, true);
    updateGrid('fleet-grid', activePlayer.ships, opponent.shots, false);
}

function updateGrid(id, ships, shots, hideShips) {
    const grid = document.getElementById(id);
    for(let i=0; i<100; i++) {
        const cell = grid.children[i];
        cell.className = 'cell';
        
        const ship = ships.find(s => s.coords.includes(i));
        const shot = shots.find(s => s.index === i);

        // Ship Visibility
        if(ship) {
            const isSunk = ship.hits >= ship.size;
            // Show ship if: It's MY fleet (not hidden) OR it's sunk
            if(!hideShips || isSunk) {
                cell.classList.add('ship');
                if(isSunk) cell.classList.add('sunk');
            }
        }

        // Shot Markers
        if(shot) {
            cell.classList.add(shot.hit ? 'hit' : 'miss');
        }

        // Interactive Cursor (Only on Radar, only if empty)
        if(hideShips && !shot) {
            cell.classList.add('interactive');
        }
    }
}

// *** CRITICAL FIX: RACE CONDITION LOCK ***
function handleShot(idx) {
    // 1. Block if locked or transition visible
    if(state.isLocked || !DOM.screens.transition.classList.contains('hidden')) return;

    // 2. Identify Attacker/Defender
    const p1Turn = state.turn === 1;
    const attacker = p1Turn ? state.p1 : state.p2;
    const defender = p1Turn ? state.p2 : state.p1;

    // 3. Prevent shooting same spot or shooting during Computer turn in PvC
    if(attacker.shots.some(s => s.index === idx)) return;
    if(state.mode === 'computer' && !p1Turn) return; // Human cannot click for CPU

    // LOCK BOARD
    state.isLocked = true;
    playSound('fire');
    attacker.moves++;

    const ship = defender.ships.find(s => s.coords.includes(idx));
    const isHit = !!ship;
    
    attacker.shots.push({ index: idx, hit: isHit });

    if (isHit) {
        // --- HIT LOGIC ---
        setTimeout(() => playSound('hit'), 200); // Slight delay for fire sound to finish
        ship.hits++;
        
        // Check Win (Carrier or All)
        if (ship.size === 5 && ship.hits === 5) {
            endGame(attacker, TEXTS[state.lang].carrierDown);
            return;
        }
        if (defender.ships.every(s => s.hits >= s.size)) {
            endGame(attacker, TEXTS[state.lang].win);
            return;
        }

        // BONUS TURN: Unlock and Render
        renderTurn();
        setTimeout(() => {
            state.isLocked = false; // Unlock for bonus shot
            if (state.mode === 'computer' && !p1Turn) computerAI(); // CPU shoots again if it hit
        }, 1000);

    } else {
        // --- MISS LOGIC ---
        renderTurn();
        setTimeout(() => {
            swapTurn(); 
        }, 1000);
    }
}

function swapTurn() {
    state.turn = state.turn === 1 ? 2 : 1;
    state.isLocked = false; // Unlock for next player

    if(state.mode === 'player') {
        const nextName = state.turn === 1 ? state.p1.name : state.p2.name;
        showTransition(nextName, renderTurn);
    } else {
        // PvC
        renderTurn();
        if(state.turn === 2) {
            state.isLocked = true; // Lock while CPU "thinks"
            setTimeout(computerAI, 1000);
        }
    }
}

function computerAI() {
    if(state.phase !== 'battle') return;

    // CPU Logic (Shoots at P1)
    const validMoves = [];
    for(let i=0; i<100; i++) {
        if(!state.p2.shots.some(s => s.index === i)) validMoves.push(i);
    }
    
    if(validMoves.length > 0) {
        const idx = validMoves[Math.floor(Math.random() * validMoves.length)];
        
        // Execute Shot (Manual logic replication to bypass click handlers)
        const attacker = state.p2;
        const defender = state.p1;
        
        playSound('fire');
        const ship = defender.ships.find(s => s.coords.includes(idx));
        const isHit = !!ship;
        
        attacker.shots.push({ index: idx, hit: isHit });
        
        if(isHit) {
            setTimeout(() => playSound('hit'), 200);
            ship.hits++;
            if (ship.size === 5 && ship.hits === 5) { endGame(attacker, TEXTS[state.lang].lose); return; }
            if (defender.ships.every(s => s.hits >= s.size)) { endGame(attacker, TEXTS[state.lang].lose); return; }
            
            renderTurn();
            setTimeout(computerAI, 1000); // CPU Hit Bonus
        } else {
            renderTurn();
            setTimeout(swapTurn, 1000);
        }
    }
}

// --- GAME END & LEADERBOARD ---
function endGame(winner, reason) {
    clearInterval(state.timerInterval);
    state.phase = 'gameover';
    
    const isWin = (winner === state.p1);
    const audioKey = (state.mode === 'computer' && !isWin) ? 'lose' : 'win';
    playSound(audioKey);

    // Save to Leaderboard (Only PvC Wins)
    if (state.mode === 'computer' && isWin) {
        saveScore(winner.name, winner.moves, state.timer);
    }

    document.getElementById('winner-title').textContent = reason;
    document.getElementById('winner-title').style.color = isWin ? 'gold' : 'red';
    document.getElementById('end-icon').className = isWin ? 'fas fa-medal fa-3x' : 'fas fa-skull-crossbones fa-3x';
    document.getElementById('winner-name').textContent = winner.name;
    document.getElementById('winner-moves').textContent = winner.moves;
    document.getElementById('winner-time').textContent = document.getElementById('time-display').textContent;
    
    switchScreen('gameOver');
}

function saveScore(name, moves, time) {
    let scores = JSON.parse(localStorage.getItem('battleship_scores') || '[]');
    scores.push({ name, moves, time });
    
    // Sort: Fewest Moves first, then Shortest Time
    scores.sort((a, b) => {
        if (a.moves !== b.moves) return a.moves - b.moves;
        return a.time - b.time;
    });
    
    scores = scores.slice(0, 10);
    localStorage.setItem('battleship_scores', JSON.stringify(scores));
}

function showLeaderboard() {
    const scores = JSON.parse(localStorage.getItem('battleship_scores') || '[]');
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    
    scores.forEach((s, i) => {
        const row = document.createElement('tr');
        const m = Math.floor(s.time / 60).toString().padStart(2, '0');
        const sec = (s.time % 60).toString().padStart(2, '0');
        row.innerHTML = `<td>${i+1}</td><td>${s.name}</td><td>${s.moves}</td><td>${m}:${sec}</td>`;
        tbody.appendChild(row);
    });
    
    switchScreen('leaderboard');
}

// --- UTILS ---
function playSound(key) {
    const audio = DOM.audio[key];
    if(audio) { audio.currentTime = 0; audio.play().catch(()=>{}); }
}
function togglePause() { playSound('menu'); alert("PAUSED"); }
function quitGame() { playSound('menu'); if(confirm("Exit?")) backToMenu(); }
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
function openSettings() { DOM.screens.settings.classList.remove('hidden'); }
