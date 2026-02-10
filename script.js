document.addEventListener('DOMContentLoaded', () => {
    /* --- AYARLAR VE DEĞİŞKENLER --- */
    const width = 10;
    const userGrid = document.querySelector('#grid-friendly');
    const enemyGrid = document.querySelector('#grid-enemy');
    const shipDock = document.querySelector('.ship-dock');
    const ships = document.querySelectorAll('.ship-preview');
    const rotateBtn = document.querySelector('#btn-rotate');
    const startWarBtn = document.querySelector('#btn-start-war');
    const infoDisplay = document.querySelector('#info-text');
    const turnDisplay = document.querySelector('#turn-display');
    const setupPanel = document.querySelector('#setup-panel');
    const mainMenu = document.querySelector('#main-menu');
    const gameLog = document.querySelector('#game-log');
    const turnOverlay = document.querySelector('#turn-overlay');
    const overlayTitle = document.querySelector('#overlay-title');
    const btnReady = document.querySelector('#btn-ready');

    // Sesler
    const sounds = {
        bgMusic: document.getElementById('bg-music'),
        click: document.getElementById('sfx-click'),
        fire: document.getElementById('sfx-fire'),
        hit: document.getElementById('sfx-hit'),
        miss: document.getElementById('sfx-miss'),
        sunk: document.getElementById('sfx-sunk'),
        win: document.getElementById('sfx-win'),
        lose: document.getElementById('sfx-lose')
    };

    // Oyun Durumu
    let gameMode = 'pvc'; // 'pvc' (Bilgisayar) veya 'pvp' (1vs1)
    let isHorizontal = true;
    let isGameOver = false;
    let currentPlayer = 'player1'; // player1, player2 (veya computer)
    let shipsPlacedCount = 0;
    let player1Squares = [];
    let player2Squares = []; // Düşman veya Oyuncu 2
    let player1Ships = [];
    let player2Ships = [];
    
    // AI (Yapay Zeka) Hafızası
    let aiHits = []; // Başarılı vuruşları tutar
    let aiTargetQueue = []; // Hedeflenecek komşu kareler

    // Gemi Verileri
    const shipArray = [
        { name: 'destroyer', length: 2 },
        { name: 'submarine', length: 3 },
        { name: 'cruiser', length: 3 },
        { name: 'battleship', length: 4 },
        { name: 'carrier', length: 5 },
    ];

    /* --- SES AYARLARI --- */
    document.getElementById('vol-music').addEventListener('input', (e) => {
        sounds.bgMusic.volume = e.target.value;
        if(e.target.value > 0) sounds.bgMusic.play().catch(() => {});
    });
    document.getElementById('vol-sfx').addEventListener('input', (e) => {
        Object.values(sounds).forEach(s => {
            if(s !== sounds.bgMusic) s.volume = e.target.value;
        });
        sounds.click.play();
    });

    function playSound(name) {
        if (sounds[name]) {
            sounds[name].currentTime = 0;
            sounds[name].play().catch(() => {});
        }
    }

    /* --- OYUN MODU SEÇİMİ --- */
    document.getElementById('btn-pvc').addEventListener('click', () => startGameSetup('pvc'));
    document.getElementById('btn-pvp').addEventListener('click', () => startGameSetup('pvp'));

    function startGameSetup(mode) {
        gameMode = mode;
        playSound('click');
        mainMenu.style.display = 'none';
        document.querySelector('.game-container').style.display = 'flex';
        createBoard(userGrid, player1Squares);
        createBoard(enemyGrid, player2Squares);
        
        // Müzik Başlat
        sounds.bgMusic.volume = 0.3;
        sounds.bgMusic.play().catch(() => console.log("Otomatik oynatma engellendi"));

        log("Hoşgeldin Komutan! Filoları konuşlandır.");
        
        if (gameMode === 'pvc') {
            document.getElementById('p2-title').innerText = "DÜŞMAN RADARI (CPU)";
            placeEnemyShipsRandomly(); // Bilgisayar gemilerini gizlice dizer
        } else {
            document.getElementById('p2-title').innerText = "OYUNCU 2 RADARI";
            // PvP modunda gemi yerleştirme sırası mantığı daha karmaşık olduğu için
            // Basitlik adına PvP'de de Oyuncu 2 şimdilik rastgele dizilsin veya
            // Gelişmiş versiyonda sırayla dizdirilebilir. Şimdilik CPU gibi gizli dizelim.
            placeEnemyShipsRandomly(); 
            log("1vs1 Modu: Oyuncu 2 filosu gizlice yerleşti.");
        }
    }

    /* --- IZGARA OLUŞTURMA --- */
    function createBoard(grid, squares) {
        grid.innerHTML = '';
        for (let i = 0; i < width * width; i++) {
            const square = document.createElement('div');
            square.dataset.id = i;
            square.classList.add('cell');
            grid.appendChild(square);
            squares.push(square);
        }
    }

    /* --- GEMİ YERLEŞTİRME (OYUNCU) --- */
    ships.forEach(ship => ship.addEventListener('dragstart', dragStart));
    
    player1Squares.forEach(square => {
        square.addEventListener('dragstart', dragStart);
        square.addEventListener('dragover', dragOver);
        square.addEventListener('dragenter', dragEnter);
        square.addEventListener('drop', dragDrop);
    });

    let draggedShipLength;
    let draggedShipName;
    let draggedShipElement;

    function dragStart() {
        draggedShipLength = parseInt(this.dataset.length);
        draggedShipName = this.dataset.ship;
        draggedShipElement = this;
    }

    function dragOver(e) { e.preventDefault(); }
    function dragEnter(e) { e.preventDefault(); }

    function dragDrop() {
        let startId = parseInt(this.dataset.id);
        if (validatePlacement(player1Squares, startId, draggedShipLength, isHorizontal)) {
            placeShip(player1Squares, startId, draggedShipLength, draggedShipName, isHorizontal, 'friendly');
            draggedShipElement.style.display = 'none';
            shipsPlacedCount++;
            playSound('click');

            if (shipsPlacedCount === 5) {
                infoDisplay.innerHTML = "FİLO HAZIR!";
                setupPanel.querySelector('.ship-dock').style.display = 'none';
                startWarBtn.classList.remove('hidden');
            }
        } else {
            playSound('miss'); // Hata sesi
            log("Kaptan! Gemi oraya sığmaz.");
        }
    }

    /* --- YARDIMCI FONKSİYONLAR --- */
    function validatePlacement(squares, startId, length, horizontal) {
        let valid = true;
        // Kenar taşma kontrolü
        if (horizontal) {
            if ((startId % width) + length > width) valid = false;
        } else {
            if (startId + (length * width) >= 100) valid = false;
        }
        // Doluluk kontrolü
        if (valid) {
            for (let i = 0; i < length; i++) {
                let idx = horizontal ? startId + i : startId + (i * width);
                if (squares[idx].classList.contains('taken')) valid = false;
            }
        }
        return valid;
    }

    function placeShip(squares, startId, length, name, horizontal, type) {
        for (let i = 0; i < length; i++) {
            let idx = horizontal ? startId + i : startId + (i * width);
            squares[idx].classList.add('taken', name);
            if(type === 'friendly') squares[idx].classList.add('friendly-ship'); 
        }
        // Gemi listesine ekle (Takip için)
        if(squares === player1Squares) player1Ships.push({name, length, hits: 0});
        else player2Ships.push({name, length, hits: 0});
    }

    function placeEnemyShipsRandomly() {
        shipArray.forEach(ship => {
            let placed = false;
            while (!placed) {
                let randomIdx = Math.floor(Math.random() * 100);
                let randomDir = Math.random() > 0.5;
                if (validatePlacement(player2Squares, randomIdx, ship.length, randomDir)) {
                    placeShip(player2Squares, randomIdx, ship.length, ship.name, randomDir, 'enemy');
                    placed = true;
                }
            }
        });
    }

    /* --- DÖNDÜRME (CAPS LOCK & BUTON) --- */
    function toggleRotate() {
        isHorizontal = !isHorizontal;
        rotateBtn.innerText = isHorizontal ? "DÖNDÜR (YATAY)" : "DÖNDÜR (DİKEY)";
        ships.forEach(ship => {
            ship.style.flexDirection = isHorizontal ? 'row' : 'column';
            let w = ship.style.width; ship.style.width = ship.style.height; ship.style.height = w;
        });
    }
    rotateBtn.addEventListener('click', toggleRotate);

    // Caps Lock Tespiti
    document.addEventListener('keydown', (e) => {
        if (e.code === 'CapsLock' || e.getModifierState("CapsLock")) {
            toggleRotate();
            // Kullanıcıya görsel uyarı (Buton parlasın)
            rotateBtn.style.backgroundColor = "#e67e22";
            setTimeout(() => rotateBtn.style.backgroundColor = "", 200);
        }
    });

    /* --- SAVAŞ BAŞLANGICI --- */
    startWarBtn.addEventListener('click', () => {
        setupPanel.classList.add('hidden');
        gameLog.innerText = "SAVAŞ BAŞLADI! İLK ATIŞI YAP.";
        playSound('fire');
        playGame();
    });

    function playGame() {
        if (isGameOver) return;
        
        // Düşman karesine tıklama (Saldırı)
        player2Squares.forEach(square => {
            square.addEventListener('click', () => {
                if (currentPlayer === 'player1' && !isGameOver && !square.classList.contains('checked')) {
                    handleAttack(square, player2Ships, 'player2');
                }
            });
        });

        // 1vs1 Modunda kendi karemize tıklanmasını engellemek için sadece düşman grid aktif
    }

    /* --- SALDIRI MANTIĞI --- */
    function handleAttack(square, targetShips, targetName) {
        square.classList.add('checked');
        playSound('fire');

        if (square.classList.contains('taken')) {
            // VURULDU
            square.classList.add('hit');
            playSound('hit');
            log("İSABET! Bir düşman parçası vuruldu.");
            
            // Hangi gemi vuruldu bul
            let hitShipName = getShipNameFromClasses(square.classList);
            let hitShip = targetShips.find(s => s.name === hitShipName);
            if (hitShip) {
                hitShip.hits++;
                checkSunk(hitShip, targetName);
            }

            checkForWin();
            
            // Eğer vuran bizsek tekrar vurabiliriz (Bonus hak) veya sıra geçer.
            // Klasik kuralda sıra geçer, ama vurdukça devam etme varyasyonu da var.
            // Biz klasik yapalım, sıra geçsin.
            if (!isGameOver) switchTurn();

        } else {
            // ISKA
            square.classList.add('miss');
            playSound('miss');
            log("ISKA! Sulara gömüldü.");
            if (!isGameOver) switchTurn();
        }
    }

    function getShipNameFromClasses(classList) {
        const names = ['destroyer', 'submarine', 'cruiser', 'battleship', 'carrier'];
        for (let cls of classList) {
            if (names.includes(cls)) return cls;
        }
        return null;
    }

    function checkSunk(ship, targetPlayer) {
        if (ship.hits === ship.length) {
            playSound('sunk');
            log(`DEHŞETLİ HABER! ${ship.name.toUpperCase()} BATIRILDI!`);
            // Batırılan geminin tüm karelerine 'sunk' efekti ekle (Görsel)
            // (Bu kısım biraz daha kompleks class yönetimi gerektirir, şimdilik log yeterli)
        }
    }

    function switchTurn() {
        if (gameMode === 'pvc') {
            if (currentPlayer === 'player1') {
                currentPlayer = 'computer';
                turnDisplay.innerText = "BİLGİSAYAR DÜŞÜNÜYOR...";
                setTimeout(computerAI, 1000);
            } else {
                currentPlayer = 'player1';
                turnDisplay.innerText = "SIRA SENDE KOMUTAN!";
            }
        } else {
            // 1 vs 1 Modu (Ara Ekran)
            currentPlayer = (currentPlayer === 'player1') ? 'player2' : 'player1';
            showTurnOverlay();
        }
    }

    /* --- AKILLI YAPAY ZEKA (AI) --- */
    function computerAI() {
        if (isGameOver) return;

        let targetSquare;
        
        // 1. Hedef Kuyruğu Doluysa (Hunt Mode)
        if (aiTargetQueue.length > 0) {
            targetSquare = aiTargetQueue.shift();
            // Eğer bu kare daha önce vurulduysa başkasını seç
            if (targetSquare.classList.contains('checked')) {
                computerAI(); 
                return;
            }
        } else {
            // 2. Rastgele Atış (Hunt Mode)
            // Algoritma: Sadece çift karelere (Satranç tahtası gibi) ateş ederek şansı artır
            // Veya tamamen rastgele
            let valid = false;
            while (!valid) {
                let rand = Math.floor(Math.random() * 100);
                targetSquare = player1Squares[rand];
                if (!targetSquare.classList.contains('checked')) valid = true;
            }
        }

        // Ateş Et
        targetSquare.classList.add('checked');
        playSound('fire');

        if (targetSquare.classList.contains('taken')) {
            targetSquare.classList.add('hit');
            playSound('hit');
            log("BİLGİSAYAR GEMİNİ VURDU!");
            
            // Komşu kareleri hedefe ekle (Yukarı, Aşağı, Sağ, Sol)
            let id = parseInt(targetSquare.dataset.id);
            addNeighborsToQueue(id);
            
            // Gemi batırma kontrolü
            let sName = getShipNameFromClasses(targetSquare.classList);
            let s = player1Ships.find(ship => ship.name === sName);
            if(s) {
                s.hits++;
                if(s.hits === s.length) {
                    playSound('sunk');
                    log("BİLGİSAYAR GEMİNİ BATIRDI!");
                    // Gemi battıysa kuyruğu temizleyebiliriz (Basit AI için)
                    // Gelişmiş AI'da sadece o gemiye ait komşuları temizleriz.
                    aiTargetQueue = []; 
                }
            }
            checkForWin();
        } else {
            targetSquare.classList.add('miss');
            playSound('miss');
            log("Bilgisayar ıskaladı.");
        }

        if (!isGameOver) switchTurn();
    }

    function addNeighborsToQueue(id) {
        const moves = [-1, 1, -width, width]; // Sol, Sağ, Yukarı, Aşağı
        moves.forEach(move => {
            let neighborId = id + move;
            // Harita sınırları kontrolü
            if (neighborId >= 0 && neighborId < 100) {
                // Sol/Sağ taşma kontrolü
                if (Math.abs((id % width) - (neighborId % width)) > 1) return;
                
                let neighbor = player1Squares[neighborId];
                if (!neighbor.classList.contains('checked')) {
                    aiTargetQueue.push(neighbor);
                }
            }
        });
    }

    /* --- 1 vs 1 ARA EKRAN --- */
    function showTurnOverlay() {
        turnOverlay.style.display = 'flex';
        overlayTitle.innerText = currentPlayer === 'player1' ? "OYUNCU 1" : "OYUNCU 2";
        // Ekranı gizle ki kopya çekilmesin
        document.querySelector('.game-container').classList.add('hidden');
    }

    btnReady.addEventListener('click', () => {
        turnOverlay.style.display = 'none';
        document.querySelector('.game-container').classList.remove('hidden');
        
        // 1vs1'de gridlerin görünürlüğünü değiştir (Fog of War)
        // Sıra kimdeyse onun gemileri görünsün, diğerininki gizlensin
        if (currentPlayer === 'player1') {
            userGrid.classList.add('friendly'); userGrid.classList.remove('enemy');
            enemyGrid.classList.add('enemy'); enemyGrid.classList.remove('friendly');
            document.getElementById('p1-title').innerText = "DOST SULAR";
            document.getElementById('p2-title').innerText = "DÜŞMAN RADARI";
            turnDisplay.innerText = "OYUNCU 1 SALDIRIYOR";
            // Tıklama olaylarını güncelle (Sadece düşman gridine tıklanabilsin)
            setupPvPClickEvents(enemyGrid, player2Ships, 'player2');
        } else {
            // Oyuncu 2'nin ekranı: Gridler yer değiştirmiş gibi davranmalı
            // Sol taraf P2 (Dost), Sağ taraf P1 (Düşman)
            // Basitlik için sadece class değiştiriyoruz, gridler yerinde kalıyor
            userGrid.classList.add('enemy'); userGrid.classList.remove('friendly');
            enemyGrid.classList.add('friendly'); enemyGrid.classList.remove('enemy');
            document.getElementById('p1-title').innerText = "DÜŞMAN RADARI";
            document.getElementById('p2-title').innerText = "DOST SULAR";
            turnDisplay.innerText = "OYUNCU 2 SALDIRIYOR";
            setupPvPClickEvents(userGrid, player1Ships, 'player1');
        }
    });

    function setupPvPClickEvents(targetGrid, targetShips, targetName) {
        // Önce tüm eventleri temizlemek gerekir (karmaşık), 
        // Basit çözüm: Global bir 'tıklanabilir grid' değişkeni tutmak.
        // Bu örnekte basitleştirilmiş mantık kullanıyoruz.
        // Gerçek bir uygulamada removeEventListener kullanmak daha sağlıklıdır.
        
        // Not: Bu kısım MVP (Minimum Viable Product) için basitleştirilmiştir.
        // PvP modunda tıklamalar global event listener içinde kontrol edilir.
        targetGrid.onclick = (e) => {
            if (e.target.classList.contains('cell') && !e.target.classList.contains('checked')) {
                handleAttack(e.target, targetShips, targetName);
                targetGrid.onclick = null; // Tek atış hakkı
            }
        };
    }

    /* --- KAZANMA KONTROLÜ --- */
    function checkForWin() {
        const p1Sunk = player1Ships.every(ship => ship.hits === ship.length);
        const p2Sunk = player2Ships.every(ship => ship.hits === ship.length);

        if (p1Sunk || p2Sunk) {
            isGameOver = true;
            let winner = p2Sunk ? "OYUNCU 1" : (gameMode === 'pvc' ? "BİLGİSAYAR" : "OYUNCU 2");
            
            if (winner === "BİLGİSAYAR") playSound('lose');
            else playSound('win');

            infoDisplay.innerText = `ZAFER! ${winner} KAZANDI! 🏆`;
            infoDisplay.style.color = "#27ae60";
            turnDisplay.innerText = "Oyun Bitti. Yenilemek için sayfayı yenile.";
        }
    }

    function log(msg) {
        gameLog.innerText = msg;
        gameLog.style.borderLeftColor = currentPlayer === 'player1' ? '#3498db' : '#e74c3c';
    }
});
