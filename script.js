document.addEventListener('DOMContentLoaded', () => {
    // --- SEÇİCİLER ---
    const userGrid = document.querySelector('#user-grid');
    const computerGrid = document.querySelector('#computer-grid');
    const displayGrid = document.querySelector('#user-grid');
    const ships = document.querySelectorAll('.ship-preview');
    const shipDock = document.querySelector('.ship-dock');
    const rotateBtn = document.querySelector('#rotate-btn');
    const startWarBtn = document.querySelector('#start-war-btn');
    const startBtn = document.querySelector('#start-btn'); // Ana menü butonu
    const infoDisplay = document.querySelector('#info-text');
    const turnDisplay = document.querySelector('#turn-display');
    const setupPanel = document.querySelector('#setup-panel');
    const mainMenu = document.querySelector('#main-menu');
    const gameContainer = document.querySelector('.game-container');

    // --- DEĞİŞKENLER ---
    const userSquares = [];
    const computerSquares = [];
    let isHorizontal = true; // Başlangıçta yatay
    let isGameOver = false;
    let currentPlayer = 'user';
    const width = 10;
    let shipsPlacedCount = 0;
    
    // Sürüklenen gemi bilgileri
    let draggedShipLength;
    let draggedShipId;
    let selectedShipIndex;
    let draggedShipElement;

    // --- 1. OYUN ALANINI OLUŞTURMA ---
    function createBoard(grid, squares) {
        for (let i = 0; i < width * width; i++) {
            const square = document.createElement('div');
            square.dataset.id = i;
            square.classList.add('cell');
            grid.appendChild(square);
            squares.push(square);
        }
    }

    createBoard(userGrid, userSquares);
    createBoard(computerGrid, computerSquares);

    // --- 2. GEMİLERİ TANIMLAMA ---
    const shipArray = [
        { name: 'destroyer', length: 2 },
        { name: 'submarine', length: 3 },
        { name: 'cruiser', length: 3 },
        { name: 'battleship', length: 4 },
        { name: 'carrier', length: 5 },
    ];

    // --- 3. BİLGİSAYAR GEMİLERİNİ RASTGELE YERLEŞTİRME ---
    function generateComputerShips(ship) {
        let randomDirection = Math.floor(Math.random() * 2); // 0 veya 1
        let currentShipLength = ship.length;
        let direction = randomDirection === 0 ? 1 : width; // 1: Yatay, 10: Dikey
        
        let randomStart = Math.floor(Math.random() * computerSquares.length);
        
        // Sınır Kontrolü (Taşma var mı?)
        // Yatayda sağ kenardan taşma kontrolü
        const isAtRightEdge = (randomStart % width) + currentShipLength > width;
        // Dikeyde alt kenardan taşma kontrolü
        const isAtBottomEdge = randomStart + (currentShipLength * width) > width * width;

        if (randomDirection === 0 && isAtRightEdge) randomStart -= currentShipLength; 
        if (randomDirection === 1 && isAtBottomEdge) randomStart -= (currentShipLength * width);

        // Çakışma Kontrolü
        let isTaken = false;
        for (let i = 0; i < currentShipLength; i++) {
            let index = randomStart + (i * direction);
            if (computerSquares[index].classList.contains('taken')) isTaken = true;
        }

        // Eğer yer uygunsa yerleştir, değilse tekrar dene (Recursion)
        if (!isTaken && !isAtRightEdge && !isAtBottomEdge) {
            for (let i = 0; i < currentShipLength; i++) {
                let index = randomStart + (i * direction);
                computerSquares[index].classList.add('taken', ship.name);
                // Not: Bilgisayarın gemilerine 'ship' class'ı eklemiyoruz ki görünmesinler!
            }
        } else {
            generateComputerShips(ship);
        }
    }

    // --- 4. OYUNU BAŞLATMA VE MENÜ GEÇİŞİ ---
    startBtn.addEventListener('click', () => {
        mainMenu.style.display = 'none';
        gameContainer.style.display = 'flex';
        // Bilgisayar gemilerini yerleştir
        shipArray.forEach(ship => generateComputerShips(ship));
    });

    // --- 5. DÖNDÜRME (ROTATION) MANTIĞI ---
    function rotate() {
        isHorizontal = !isHorizontal;
        rotateBtn.innerHTML = isHorizontal ? "Döndür (Yatay)" : "Döndür (Dikey)";
        
        // Görsel olarak dock'taki gemileri çevir
        ships.forEach(ship => {
            let w = ship.style.width;
            let h = ship.style.height || '35px';
            ship.style.width = h;
            ship.style.height = w;
            ship.style.flexDirection = isHorizontal ? 'row' : 'column';
        });
    }
    rotateBtn.addEventListener('click', rotate);
    
    // Klavye Kontrolü (R Tuşu)
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'r') rotate();
    });

    // --- 6. SÜRÜKLE VE BIRAK (DRAG & DROP) ---
    ships.forEach(ship => ship.addEventListener('dragstart', dragStart));

    userSquares.forEach(square => {
        square.addEventListener('dragstart', dragStart);
        square.addEventListener('dragover', dragOver);
        square.addEventListener('dragenter', dragEnter);
        square.addEventListener('dragleave', dragLeave);
        square.addEventListener('drop', dragDrop);
    });

    function dragStart() {
        draggedShipLength = parseInt(this.dataset.length);
        draggedShipElement = this;
    }

    function dragOver(e) { e.preventDefault(); }
    function dragEnter(e) { e.preventDefault(); }
    function dragLeave() { }

    function dragDrop() {
        let shipId = draggedShipElement.dataset.id;
        let startId = parseInt(this.dataset.id);
        
        // Hangi karelere yerleşecek?
        let shipIndices = [];
        let valid = true;
        
        // Sınır ve Taşma Kontrolleri
        // Yatay yerleşimde satır sonuna çarpıyor mu?
        if (isHorizontal) {
            // Örnek: Start 8, Boy 3 -> 8, 9, 10. (10 alt satır başı, yasak!)
            // (8 % 10) + 3 = 11 > 10 -> HATA
            if ((startId % width) + draggedShipLength > width) valid = false;
        } else {
            // Dikey yerleşimde harita dışına çıkıyor mu?
            if (startId + (width * (draggedShipLength - 1)) >= 100) valid = false;
        }

        // Dolu mu kontrolü
        for (let i = 0; i < draggedShipLength; i++) {
            let index = isHorizontal ? startId + i : startId + (i * width);
            if (index < 100) { // Index hatası almamak için
                if (userSquares[index].classList.contains('taken')) valid = false;
                shipIndices.push(index);
            } else {
                valid = false;
            }
        }

        if (valid) {
            shipIndices.forEach(index => {
                userSquares[index].classList.add('taken', 'ship');
                // Görsel olarak gemi olduğunu belli et
            });
            
            // Gemiyi dock'tan kaldır (Görünmez yap)
            draggedShipElement.style.display = 'none';
            shipsPlacedCount++;

            // Tüm gemiler bitti mi?
            if (shipsPlacedCount === 5) {
                infoDisplay.innerHTML = "Harika! Şimdi savaşı başlat.";
                setupPanel.querySelector('.controls').style.display = 'none'; // Döndür butonunu gizle
                setupPanel.querySelector('.ship-dock').style.display = 'none'; // Dock'u gizle
                const playBtn = document.querySelector('.btn-play');
                playBtn.style.display = 'block';
                playBtn.addEventListener('click', playGame);
            }
        } else {
            // Hatalı yerleşim (Kırmızı yanıp sönebilir - Opsiyonel)
            alert("Gemi buraya sığmıyor veya çakışıyor!");
        }
    }

    // --- 7. SAVAŞ MANTIĞI ---
    function playGame() {
        setupPanel.style.display = 'none';
        isGameOver = false;
        infoDisplay.innerHTML = "Sıra Sende! Ateş et.";
        turnDisplay.innerHTML = "Bilgisayar bekliyor...";

        // Bilgisayar karelerine tıklama olayı ekle
        computerSquares.forEach(square => {
            square.addEventListener('click', function(e) {
                if (isGameOver) return;
                if (currentPlayer === 'user' && !square.classList.contains('checked')) {
                    revealSquare(square);
                }
            });
        });
    }

    function revealSquare(square) {
        if (square.classList.contains('checked')) return; // Zaten tıklanmış

        square.classList.add('checked');

        if (square.classList.contains('taken')) {
            square.classList.add('hit');
            infoDisplay.innerHTML = "VURDUN! 🔥";
            checkForWin();
        } else {
            square.classList.add('miss');
            infoDisplay.innerHTML = "ISKA! 🌊";
            currentPlayer = 'computer';
            turnDisplay.innerHTML = "Bilgisayar Düşünüyor...";
            setTimeout(computerGo, 1000); // 1 saniye bekle
        }
    }

    function computerGo() {
        if (isGameOver) return;

        // Rastgele geçerli bir kare seç
        let random = Math.floor(Math.random() * userSquares.length);
        while (userSquares[random].classList.contains('checked')) {
            random = Math.floor(Math.random() * userSquares.length);
        }

        const square = userSquares[random];
        square.classList.add('checked');

        if (square.classList.contains('taken')) {
            square.classList.add('hit');
            turnDisplay.innerHTML = "EYVAH! Gemin vuruldu! 💥";
            checkForWin();
            // Bilgisayar vurursa tekrar oynasın (Basit kural)
            setTimeout(computerGo, 800);
        } else {
            square.classList.add('miss');
            turnDisplay.innerHTML = "Bilgisayar ıskaladı.";
            currentPlayer = 'user';
            infoDisplay.innerHTML = "Sıra Sende!";
        }
    }

    function checkForWin() {
        let computerHits = computerSquares.filter(s => s.classList.contains('taken') && s.classList.contains('hit')).length;
        let userHits = userSquares.filter(s => s.classList.contains('taken') && s.classList.contains('hit')).length;
        
        // Toplam gemi parçası sayısı (2+3+3+4+5 = 17)
        const totalShipParts = 17;

        if (computerHits === totalShipParts) {
            infoDisplay.innerHTML = "TEBRİKLER! KAZANDINIZ! 🏆";
            turnDisplay.innerHTML = "";
            isGameOver = true;
        }
        if (userHits === totalShipParts) {
            infoDisplay.innerHTML = "KAYBETTİNİZ... DONANMA YOK OLDU. 💀";
            turnDisplay.innerHTML = "";
            isGameOver = true;
        }
    }
});
