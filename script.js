document.addEventListener('DOMContentLoaded', () => {
    // SELECTORS
    const userGrid = document.querySelector('#user-grid');
    const computerGrid = document.querySelector('#computer-grid');
    const ships = document.querySelectorAll('.ship-preview');
    const rotateBtn = document.querySelector('#rotate-btn');
    const startWarBtn = document.querySelector('#start-war-btn');
    const startBtn = document.querySelector('#start-btn'); 
    const infoDisplay = document.querySelector('#info-text');
    const turnDisplay = document.querySelector('#turn-display');
    const setupPanel = document.querySelector('#setup-panel');
    const mainMenu = document.querySelector('#main-menu');
    const gameContainer = document.querySelector('.game-container');

    // VARIABLES
    const userSquares = [];
    const computerSquares = [];
    let isHorizontal = true; 
    let isGameOver = false;
    let currentPlayer = 'user';
    const width = 10;
    let shipsPlacedCount = 0;
    let draggedShipLength;
    let draggedShipElement;

    // 1. CREATE BOARDS
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

    // 2. DEFINE SHIPS
    const shipArray = [
        { name: 'destroyer', length: 2 },
        { name: 'submarine', length: 3 },
        { name: 'cruiser', length: 3 },
        { name: 'battleship', length: 4 },
        { name: 'carrier', length: 5 },
    ];

    // 3. COMPUTER RANDOM PLACEMENT
    function generateComputerShips(ship) {
        let randomDirection = Math.floor(Math.random() * 2); 
        let currentShipLength = ship.length;
        let direction = randomDirection === 0 ? 1 : width; 
        let randomStart = Math.floor(Math.random() * computerSquares.length);
        
        const isAtRightEdge = (randomStart % width) + currentShipLength > width;
        const isAtBottomEdge = randomStart + (currentShipLength * width) > width * width;

        if (randomDirection === 0 && isAtRightEdge) randomStart -= currentShipLength; 
        if (randomDirection === 1 && isAtBottomEdge) randomStart -= (currentShipLength * width);

        let isTaken = false;
        for (let i = 0; i < currentShipLength; i++) {
            let index = randomStart + (i * direction);
            if (computerSquares[index].classList.contains('taken')) isTaken = true;
        }

        if (!isTaken && !isAtRightEdge && !isAtBottomEdge) {
            for (let i = 0; i < currentShipLength; i++) {
                let index = randomStart + (i * direction);
                computerSquares[index].classList.add('taken', ship.name);
            }
        } else {
            generateComputerShips(ship);
        }
    }

    // 4. START GAME LOGIC
    startBtn.addEventListener('click', () => {
        mainMenu.style.display = 'none';
        gameContainer.style.display = 'flex'; // This fixes the white screen!
        shipArray.forEach(ship => generateComputerShips(ship));
    });

    // 5. ROTATION LOGIC
    function rotate() {
        isHorizontal = !isHorizontal;
        rotateBtn.innerHTML = isHorizontal ? "Rotate (Horizontal)" : "Rotate (Vertical)";
        
        ships.forEach(ship => {
            let w = ship.style.width;
            let h = ship.style.height || '35px';
            ship.style.width = h;
            ship.style.height = w;
            ship.style.flexDirection = isHorizontal ? 'row' : 'column';
        });
    }
    rotateBtn.addEventListener('click', rotate);
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'r') rotate();
    });

    // 6. DRAG & DROP
    ships.forEach(ship => ship.addEventListener('dragstart', dragStart));

    userSquares.forEach(square => {
        square.addEventListener('dragstart', dragStart);
        square.addEventListener('dragover', dragOver);
        square.addEventListener('dragenter', dragEnter);
        square.addEventListener('drop', dragDrop);
    });

    function dragStart() {
        draggedShipLength = parseInt(this.dataset.length);
        draggedShipElement = this;
    }

    function dragOver(e) { e.preventDefault(); }
    function dragEnter(e) { e.preventDefault(); }

    function dragDrop() {
        let startId = parseInt(this.dataset.id);
        let shipIndices = [];
        let valid = true;
        
        if (isHorizontal) {
            if ((startId % width) + draggedShipLength > width) valid = false;
        } else {
            if (startId + (width * (draggedShipLength - 1)) >= 100) valid = false;
        }

        for (let i = 0; i < draggedShipLength; i++) {
            let index = isHorizontal ? startId + i : startId + (i * width);
            if (index < 100) { 
                if (userSquares[index].classList.contains('taken')) valid = false;
                shipIndices.push(index);
            } else {
                valid = false;
            }
        }

        if (valid) {
            shipIndices.forEach(index => {
                userSquares[index].classList.add('taken', 'ship');
            });
            draggedShipElement.style.display = 'none';
            shipsPlacedCount++;

            if (shipsPlacedCount === 5) {
                infoDisplay.innerHTML = "Fleet Ready! Start the War!";
                setupPanel.querySelector('.controls').style.display = 'none'; 
                setupPanel.querySelector('.ship-dock').style.display = 'none'; 
                const playBtn = document.querySelector('.btn-play');
                playBtn.style.display = 'block';
                playBtn.addEventListener('click', playGame);
            }
        } else {
            alert("Invalid Placement!");
        }
    }

    // 7. BATTLE LOGIC
    function playGame() {
        setupPanel.style.display = 'none';
        isGameOver = false;
        infoDisplay.innerHTML = "Your Turn! Fire at Enemy Waters.";
        turnDisplay.innerHTML = "Waiting for your move...";

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
        if (square.classList.contains('checked')) return;

        square.classList.add('checked');

        if (square.classList.contains('taken')) {
            square.classList.add('hit');
            infoDisplay.innerHTML = "HIT! 🔥 Fire Again!";
            checkForWin();
        } else {
            square.classList.add('miss');
            infoDisplay.innerHTML = "MISS! 🌊";
            currentPlayer = 'computer';
            turnDisplay.innerHTML = "Computer is thinking...";
            setTimeout(computerGo, 1000);
        }
    }

    function computerGo() {
        if (isGameOver) return;

        let random = Math.floor(Math.random() * userSquares.length);
        while (userSquares[random].classList.contains('checked')) {
            random = Math.floor(Math.random() * userSquares.length);
        }

        const square = userSquares[random];
        square.classList.add('checked');

        if (square.classList.contains('taken')) {
            square.classList.add('hit');
            turnDisplay.innerHTML = "WARNING! Your ship was hit! 💥";
            checkForWin();
            setTimeout(computerGo, 800);
        } else {
            square.classList.add('miss');
            turnDisplay.innerHTML = "Computer Missed.";
            currentPlayer = 'user';
            infoDisplay.innerHTML = "Your Turn!";
        }
    }

    function checkForWin() {
        let computerHits = computerSquares.filter(s => s.classList.contains('taken') && s.classList.contains('hit')).length;
        let userHits = userSquares.filter(s => s.classList.contains('taken') && s.classList.contains('hit')).length;
        const totalShipParts = 17;

        if (computerHits === totalShipParts) {
            infoDisplay.innerHTML = "VICTORY! YOU SANK THE ENEMY FLEET! 🏆";
            turnDisplay.innerHTML = "";
            isGameOver = true;
        }
        if (userHits === totalShipParts) {
            infoDisplay.innerHTML = "DEFEAT... YOUR FLEET IS GONE. 💀";
            turnDisplay.innerHTML = "";
            isGameOver = true;
        }
    }
});
