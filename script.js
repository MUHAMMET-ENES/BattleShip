document.addEventListener('DOMContentLoaded', () => {
    const userGrid = document.querySelector('#player-grid');
    const computerGrid = document.querySelector('#computer-grid');
    const displayGrid = document.querySelector('#player-grid');
    const userSquares = [];
    const computerSquares = [];
    const width = 10; // Izgara genişliği (10x10)

    // Gemilerimiz ve Boyutları
    const shipArray = [
        { name: 'destroyer', directions: [[0, 1], [0, width]] }, // 2 birim
        { name: 'submarine', directions: [[0, 1, 2], [0, width, width*2]] }, // 3 birim
        { name: 'cruiser', directions: [[0, 1, 2], [0, width, width*2]] }, // 3 birim
        { name: 'battleship', directions: [[0, 1, 2, 3], [0, width, width*2, width*3]] }, // 4 birim
        { name: 'carrier', directions: [[0, 1, 2, 3, 4], [0, width, width*2, width*3, width*4]] }, // 5 birim
    ];

    // 1. IZGARALARI OLUŞTURMA FONKSİYONU
    function createBoard(grid, squares) {
        for (let i = 0; i < width * width; i++) {
            const square = document.createElement('div');
            square.dataset.id = i; // Her kareye 0-99 arası kimlik ver
            square.classList.add('cell');
            grid.appendChild(square);
            squares.push(square);
        }
    }

    createBoard(userGrid, userSquares);
    createBoard(computerGrid, computerSquares);

    // 2. GEMİLERİ RASTGELE YERLEŞTİRME ALGORİTMASI
    function generate(ship) {
        let randomDirection = Math.floor(Math.random() * ship.directions.length);
        let current = ship.directions[randomDirection];
        
        if (randomDirection === 0) direction = 1; // Yatay
        if (randomDirection === 1) direction = 10; // Dikey

        // Başlangıç noktası için rastgele bir kare seç (0-99)
        // Ancak taşmayı önlemek için sınırları hesapla
        let randomStart = Math.abs(Math.floor(Math.random() * computerSquares.length - (ship.directions[0].length * direction)));

        const isTaken = current.some(index => computerSquares[randomStart + index].classList.contains('taken'));
        const isAtRightEdge = current.some(index => (randomStart + index) % width === width - 1);
        const isAtLeftEdge = current.some(index => (randomStart + index) % width === 0);

        // Hata Kontrolü (Kenara çarptı mı? Başka gemi var mı?)
        if (!isTaken && !isAtRightEdge && !isAtLeftEdge) {
            current.forEach(index => {
                computerSquares[randomStart + index].classList.add('taken', ship.name);
                // Bilgisayarın gemilerini gizli tutuyoruz, sadece class ekledik.
            });
        } else {
            generate(ship); // Eğer yerleşemezse fonksiyonu tekrar çağır (Recursive)
        }
    }
    
    // Bilgisayar için gemileri yerleştir
    shipArray.forEach(ship => generate(ship));

    // --- OYUNCU İÇİN GEMİ YERLEŞTİRME (Şimdilik aynısını oyuncuya da yapalım) ---
    // Normalde oyuncu sürükleyip bırakır ama basitlik için senin gemilerini de rastgele dizeceğim.
    
    function generateUser(ship) {
        let randomDirection = Math.floor(Math.random() * ship.directions.length);
        let current = ship.directions[randomDirection];
        if (randomDirection === 0) direction = 1; 
        if (randomDirection === 1) direction = 10; 

        let randomStart = Math.abs(Math.floor(Math.random() * userSquares.length - (ship.directions[0].length * direction)));

        const isTaken = current.some(index => userSquares[randomStart + index].classList.contains('taken'));
        const isAtRightEdge = current.some(index => (randomStart + index) % width === width - 1);
        const isAtLeftEdge = current.some(index => (randomStart + index) % width === 0);

        if (!isTaken && !isAtRightEdge && !isAtLeftEdge) {
            current.forEach(index => {
                userSquares[randomStart + index].classList.add('taken', 'ship', ship.name); 
                // 'ship' class'ı CSS'de yeşil görünmesini sağlıyor!
            });
        } else {
            generateUser(ship); 
        }
    }

    // Butona basınca gemileri tekrar dizmek için
    const randomBtn = document.querySelector('#random-btn');
    randomBtn.addEventListener('click', () => {
        // Mevcut gemileri temizle
        userSquares.forEach(square => {
            square.className = 'cell'; 
        });
        // Yeniden diz
        shipArray.forEach(ship => generateUser(ship));
    });

    // İlk açılışta senin gemilerini yerleştir
    shipArray.forEach(ship => generateUser(ship));
    // --- SAVAŞ BAŞLASIN ---
    let isGameOver = false;
    let currentPlayer = 'user';
    const startButton = document.querySelector('#start-btn');
    const infoDisplay = document.querySelector('#status-text');
    
    // Toplam vurulması gereken parça sayısı (5+4+3+3+2 = 17)
    let cpuDestroyed = 0;
    let userDestroyed = 0;

    // Oyunu Başlat Butonu
    startButton.addEventListener('click', () => {
        if(startButton.innerText === "Savaşı Başlat") {
            // Bilgisayarın gridine tıklama olaylarını ekle
            computerSquares.forEach(square => square.addEventListener('click', function(e) {
                if(!isGameOver) revealSquare(square);
            }));
            infoDisplay.innerHTML = "Hedef Seç: Düşman sularına tıkla!";
            startButton.innerText = "Savaş Sürüyor...";
            startButton.disabled = true; // Tekrar basılamasın
        }
    });

    // --- SENİN HAMLEN ---
    function revealSquare(square) {
        // Zaten tıklanmışsa işlem yapma
        if (square.classList.contains('hit') || square.classList.contains('miss')) return;

        if (square.classList.contains('taken')) {
            // İSABET!
            square.classList.add('hit');
            infoDisplay.innerHTML = "VURDUN! Düşman gemisi hasar aldı.";
            cpuDestroyed++;
            checkForWins();
        } else {
            // ISKA!
            square.classList.add('miss');
            infoDisplay.innerHTML = "ISKA! Sıra bilgisayarda...";
        }
        
        // Sırayı bilgisayara ver
        currentPlayer = 'computer';
        if(!isGameOver) setTimeout(computerGo, 1000); // 1 saniye bekle (düşünme efekti)
    }

    // --- BİLGİSAYARIN HAMLESİ (Yapay Zeka) ---
    function computerGo() {
        if(isGameOver) return;

        infoDisplay.innerHTML = "Bilgisayar nişan alıyor...";
        
        // Basit Zeka: Rastgele geçerli bir kare bulana kadar dene
        let random = Math.floor(Math.random() * userSquares.length);
        
        // Eğer bu kareye daha önce ateş edildiyse, yeni sayı üret
        while (userSquares[random].classList.contains('hit') || userSquares[random].classList.contains('miss')) {
            random = Math.floor(Math.random() * userSquares.length);
        }

        const targetSquare = userSquares[random];

        if (targetSquare.classList.contains('taken')) {
            targetSquare.classList.add('hit');
            infoDisplay.innerHTML = "DİKKAT! Gemin vuruldu!";
            userDestroyed++;
            checkForWins();
        } else {
            targetSquare.classList.add('miss');
            infoDisplay.innerHTML = "Bilgisayar ıskaladı. Sıra sende.";
        }
        
        currentPlayer = 'user';
    }

    // --- KAZANMA KONTROLÜ ---
    function checkForWins() {
        if (cpuDestroyed === 17) {
            infoDisplay.innerHTML = "TEBRİKLER! TÜM DÜŞMAN FİLOSUNU YOK ETTİNİZ! 🏆";
            infoDisplay.style.color = "#00ff9d"; // Neon Yeşil
            isGameOver = true;
        }
        if (userDestroyed === 17) {
            infoDisplay.innerHTML = "KAYBETTİNİZ... Filonuz yok edildi. 💀";
            infoDisplay.style.color = "#ff2a6d"; // Neon Kırmızı
            isGameOver = true;
        }
    }
});
