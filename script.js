document.addEventListener('DOMContentLoaded', () => {
    // Seçiciler
    const userGrid = document.querySelector('#user-grid');
    const computerGrid = document.querySelector('#computer-grid');
    const shipDock = document.querySelector('.ship-dock');
    const ships = document.querySelectorAll('.ship-preview');
    const rotateBtn = document.querySelector('#rotate-btn');
    const startWarBtn = document.querySelector('#start-war-btn');
    const infoText = document.querySelector('#info-text');
    const setupPanel = document.querySelector('#setup-panel');
    const gameContainer = document.querySelector('#game-container');
    const mainMenu = document.querySelector('#main-menu');
    const startBtn = document.querySelector('#start-btn');

    let isHorizontal = true;
    let draggedShipLength = 0;
    let draggedShipElement = null;
    let userSquares = [];
    let computerSquares = [];
    let width = 10;
    let isGameOver = false;
    let playerTurn = true;
    let shipsPlaced = 0;

    // --- 1. OYUN BAŞLATMA ---
    startBtn.addEventListener('click', () => {
        mainMenu.style.display = 'none';
        gameContainer.style.display = 'flex';
        createBoard(userGrid, userSquares);
        createBoard(computerGrid, computerSquares);
        // Bilgisayar gemilerini şimdi gizlice yerleştirsin
        placeComputerShips(); 
    });

    // --- 2. GRID OLUŞTURMA ---
    function createBoard(grid, squares) {
        for (let i = 0; i < 100; i++) {
            const square = document.createElement('div');
            square.dataset.id = i;
            square.classList.add('cell');
            grid.appendChild(square);
            squares.push(square);
        }
    }

    // --- 3. DÖNDÜRME (Rotate) ---
    function toggleRotate() {
        isHorizontal = !isHorizontal;
        rotateBtn.innerText = isHorizontal ? "Döndür (Yatay)" : "Döndür (Dikey)";
        // Dock'taki gemilerin şeklini değiştir
        ships.forEach(ship => {
            if (isHorizontal) {
                ship.style.width = `${ship.dataset.length * 35}px`;
                ship.style.height = '35px';
                ship.style.flexDirection = 'row';
            } else {
                ship.style.width = '35px';
                ship.style.height = `${ship.dataset.length * 35}px`;
                ship.style.flexDirection = 'column';
            }
        });
    }
    rotateBtn.addEventListener('click', toggleRotate);
    
    // Klavye ile Döndürme ('R' tuşu veya Space)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'KeyR') toggleRotate();
    });

    // --- 4. SÜRÜKLE & BIRAK (Drag and Drop) ---
    ships.forEach(ship => {
        ship.addEventListener('dragstart', dragStart);
        ship.addEventListener('dragend', dragEnd);
    });

    userSquares.forEach(square => {
        square.addEventListener('dragstart', dragStart);
        square.addEventListener('dragover', dragOver);
        square.addEventListener('dragenter', dragEnter);
        square.addEventListener('dragleave', dragLeave);
        square.addEventListener('drop', dragDrop);
    });

    function dragStart(e) {
        draggedShipLength = parseInt(this.dataset.length);
        draggedShipElement = this;
    }

    function dragOver(e) { e.preventDefault(); }
    function dragEnter(e) { e.preventDefault(); }
    function dragLeave() { }
    function dragEnd() { }

    function dragDrop() {
        let shipNameWithLastId = draggedShipElement.lastChild.id;
        let startId = parseInt(this.dataset.id);
        
        // Sınır Kontrolü
        if (checkValidity(userSquares, startId, draggedShipLength, isHorizontal)) {
            // Gemiyi Yerleştir
            for (let i = 0; i < draggedShipLength; i++) {
                let index = isHorizontal ? startId + i : startId + (i * 10);
                userSquares[index].classList.add('taken', 'ship');
            }
            // Dock'tan gemiyi kaldır
            shipDock.removeChild(draggedShipElement);
            shipsPlaced++;

            if (shipsPlaced === 5) {
                infoText.innerText = "Tüm gemiler yerleşti! Savaşa hazır mısın?";
                startWarBtn.style.display = "block";
                rotateBtn.style.display = "none";
            }
        } else {
            // Hata mesajı veya titreme efekti eklenebilir
        }
    }

    // Yerleştirme Kuralları (Taşma var mı?)
    function checkValidity(squares, startIndex, length, isHorizontal) {
        let valid = true;
        for (let i = 0; i < length; i++) {
            let index = isHorizontal ? startIndex + i : startIndex + (i * 10);
            
            // Grid dışına çıkma kontrolü
            if (index >= 100) return false;
            
            // Yatayda sağ kenardan taşma kontrolü
            if (isHorizontal && (index % 10 === 0 && i !== 0)) return false; 
            
            // Zaten dolu mu?
            if (squares[index].classList.contains('taken')) return false;
        }
        return true;
    }

    // --- 5. BİLGİSAYAR GEMİLERİNİ YERLEŞTİR ---
    function placeComputerShips() {
        const lengths = [5, 4, 3, 3, 2];
        lengths.forEach(len => {
            let placed = false;
            while (!placed) {
                let randomIdx = Math.floor(Math.random() * 100);
                let randomDir = Math.random() > 0.5; // True = Horizontal
                if (checkValidity(computerSquares, randomIdx, len, randomDir)) {
                    for (let i = 0; i < len; i++) {
                        let idx = randomDir ? randomIdx + i : randomIdx + (i * 10);
                        computerSquares[idx].classList.add('taken'); 
                        // 'ship' class'ı eklemedik, yani görünmezler!
                    }
                    placed = true;
                }
            }
        });
    }

    // --- 6. SAVAŞ MANTIĞI ---
    startWarBtn.addEventListener('click', () => {
        setupPanel.style.display = 'none';
        infoText.innerText = "Sıra Sende! Düşman sularına ateş et.";
        playGame();
    });

    function playGame() {
        if (isGameOver) return;
        
        computerSquares.forEach(square => {
            square.addEventListener('click', function(e) {
                if (!isGameOver && playerTurn && !square.classList.contains('hit') && !square.classList.contains('miss')) {
                    if (square.classList.contains('taken')) {
                        square.classList.add('hit');
                        infoText.innerText = "VURDUN! Tekrar ateş et!";
                        checkWin();
                    } else {
                        square.classList.add('miss');
                        infoText.innerText = "ISKA! Sıra Bilgisayarda...";
                        playerTurn = false;
                        setTimeout(computerTurn, 800);
                    }
                }
            });
        });
    }

    function computerTurn() {
        if (isGameOver) return;
        
        let validMove = false;
        while (!validMove) {
            let random = Math.floor(Math.random() * 100);
            const square = userSquares[random];
            if (!square.classList.contains('hit') && !square.classList.contains('miss')) {
                if (square.classList.contains('taken')) {
                    square.classList.add('hit');
                    infoText.innerText = "EYVAH! Gemin vuruldu!";
                    checkWin();
                    validMove = true;
                    setTimeout(computerTurn, 800); // Vurursa tekrar oynasın
                } else {
                    square.classList.add('miss');
                    infoText.innerText = "Bilgisayar Iskalandı. Sıra Sende.";
                    playerTurn = true;
                    validMove = true;
                }
            }
        }
    }

    function checkWin() {
        const playerWins = computerSquares.filter(s => s.classList.contains('taken')).every(s => s.classList.contains('hit'));
        const computerWins = userSquares.filter(s => s.classList.contains('taken')).every(s => s.classList.contains('hit'));

        if (playerWins) {
            infoText.innerText = "TEBRİKLER! Düşman filosunu yok ettin! 🏆";
            isGameOver = true;
        }
        if (computerWins) {
            infoText.innerText = "KAYBETTİN... Donanman yok oldu. 🏳️";
            isGameOver = true;
        }
    }
});
