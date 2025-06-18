// public/script.js //valtozok
const createRoomBtn = document.getElementById('create-room-btn');
const roomLinkDisplay = document.getElementById('room-link-display');
const roomLinkInput = document.getElementById('room-link');
const goToRoomBtn = document.getElementById('go-to-room-btn');
const homeSection = document.getElementById('home-section');
const roomSection = document.getElementById('room-section');
const currentRoomIdSpan = document.getElementById('current-room-id');

// const gameListContainer = document.getElementById('game-list-container');
const gameSearchSelect = $('#game-search-select'); // JQuery objektum a Select2 miatt
const addGameBtn = document.getElementById('add-game-btn');
const selectedGamesList = document.getElementById('selected-games-list');

const submitGamesBtn = document.getElementById('submit-games-btn');
const evaluateGamesBtn = document.getElementById('evaluate-games-btn');
const resultSection = document.getElementById('result-section');
const matchesList = document.getElementById('matches-list');
const noMatchMessage = document.getElementById('no-match-message');

let currentRoomId = null;
let playerId = null; //
let selectedGames = new Set(); // ezt fogjuk gyujteni és elkuldeni
// fuggvenyek

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substring(2, 9);
}

function showSection(sectionId) {
    document.querySelectorAll('div[id$="-section"]').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
}

function addGameToSelectedList(gameName) {
    if (selectedGames.has(gameName)) {
        alert('Ezt a játékot már hozzáadtad!');
        return;
    }
    selectedGames.add(gameName);

    const listItem = document.createElement('li');
    listItem.classList.add('game-selection-item');
    listItem.innerHTML = `
        <span>${gameName}</span>
        <button data-game="${gameName}">Remove</button>
    `;
    selectedGamesList.appendChild(listItem);

    // Eltavolito gomb esemenykezeloje
    listItem.querySelector('button').addEventListener('click', (e) => {
        const gameToRemove = e.target.dataset.game;
        selectedGames.delete(gameToRemove);
        listItem.remove();
    });
}

/*
async function fetchGameList() { //games lista lekeres a szerverrol
    try {
        const response = await fetch('/api/games');
        const games = await response.json(); //objektumma parse
        gameListContainer.innerHTML = ''; // korabbi listat toroljuk
        games.forEach(game => {// minden gamere:
            const label = document.createElement('label'); //uj label, a label jo
            label.innerHTML = `
                <input type="checkbox" value="${game}">${game}`; //checkboxok
            gameListContainer.appendChild(label); // hozzaadja az uj label elemet, megjelenik
        });
    } catch (error) {
        console.error('error when fetching:', error);
        alert('Nem sikerult lekerni a game listat a szerverrol. Van neted?');
    }
}
*/

// esemenykezelok

createRoomBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/create-room', { method: 'POST' }); // post keres szerverre, am general roomid-t
        const data = await response.json(); //parse jsonbol objektumba
        currentRoomId = data.roomId;
        const roomUrl = `${window.location.origin}/room/${currentRoomId}`; //share link url letrehozasa
        roomLinkInput.value = roomUrl; //beallitja a szoba linkjet az input mezobe
        roomLinkDisplay.style.display = 'block';
        createRoomBtn.style.display = 'none';
    } catch (error) {
        console.error('error when creating room:', error);
        alert('Nem sikerult szobat letrehozni. Van neted?');
    }
});

goToRoomBtn.addEventListener('click', () => { //join room gomb
    if (currentRoomId) { 
        window.location.href = `/room/${currentRoomId}`; // atiranyit a szoba urljere, ez valtja ki a roomsection megjeleniteset az inicializacional
    }
});

// game add gomb
addGameBtn.addEventListener('click', () => {
    const selectedGame = gameSearchSelect.val(); // Select2-bol a kivalasztott ertek
    if (selectedGame) {
        addGameToSelectedList(selectedGame);
        gameSearchSelect.val(null).trigger('change'); // torli a kivalasztast a legordulobol
    } else {
        alert('valasszal mar ki valamit!');
    }
});



submitGamesBtn.addEventListener('click', async () => { //listak kuldese a szervernek
    if (!currentRoomId || !playerId) {
        alert('Eloszor csatlakozz egy szobahoz balfasz!');
        return;
    }
/*
    const selectedCheckboxes = gameListContainer.querySelectorAll('input[type="checkbox"]:checked'); //bejelolt boxok
    const selectedGames = Array.from(selectedCheckboxes).map(cb => cb.value); //vegigmegy es kiveszi a bejelolteket



    if (selectedGames.length === 0) {
        alert('Legalabb egy gamet akarj mar jatszani bazdmeg... veled nem lehet..');
        return;
    }
*/
     const gamesToSend = Array.from(selectedGames); //setbol arrayt kell csinalni hogy el lehessen kuldeni a 144. sorban koszonom

    if (gamesToSend.length === 0) {
        alert('Legalabb egy gamet akarj mar jatszani bazdmeg... veled nem lehet..');
        return;
    }

    try {
        const response = await fetch(`/api/room/${currentRoomId}/submit-games`, { //post keres, header jelzi a szervernek, h json lesz a body, bodynal json stringbe parsol (req.body-ba ez lesz)
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playerId, selectedGames: gamesToSend })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Games successfully sent!');
            submitGamesBtn.style.display = 'none'; // csak egyszer kuldheti el igy
            evaluateGamesBtn.style.display = 'block'; // mostmar latszik a kiertekeles gomb
        } else {
            alert(`error: ${data.message || response.statusText}`);
        }
    } catch (error) {
        console.error('error when sending data:', error);
        alert('Nem lehet elkuldeni a listat. Van neted?');
    }
});

evaluateGamesBtn.addEventListener('click', async () => { //kiertekeles gomb
    if (!currentRoomId) {
        alert('Nincs aktiv szoba a kiertekeleshez!');
        return;
    }

    try {
        const response = await fetch(`/api/room/${currentRoomId}/evaluate`); //szerver megcsinalja a metszetet
        const data = await response.json(); //parse tombbe

        matchesList.innerHTML = ''; // torli az elozo eredmenyt
        resultSection.style.display = 'block'; // result szekcio
        noMatchMessage.style.display = 'none'; // nincs talalat elrejtese

        if (data.matches && data.matches.length > 0) { // eredmeny lista
            data.matches.forEach(game => {
                const li = document.createElement('li');
                li.textContent = game;
                matchesList.appendChild(li);
            });
        } else {
            noMatchMessage.style.display = 'block'; // nincs talalat
        }
    } catch (error) {
        console.error('error when evaluating:', error);
        alert('error');
    }
});


//inicializasa, utvalasztas, (egyszer fut le)

// ellenorzi, h szoba linkkel erkezett e
const pathParts = window.location.pathname.split('/');

if (pathParts[1] === 'room' && pathParts[2]) {
    currentRoomId = pathParts[2].toUpperCase(); // szoba id mentese
    playerId = generatePlayerId(); // id generalas
    showSection('room-section'); // room page
    currentRoomIdSpan.textContent = currentRoomId; //room id span beallitas

    //fetchGameList(); // game list betoltese a szobaban

    // Select2 inicializalas
    gameSearchSelect.select2({
        placeholder: 'Kereses gamere...',
        minimumInputLength: 3, // min 3 karakter utan kezdjen keresni, h ne robbanjon fel
        ajax: {
            url: '/api/games', // szerveroldali API endpoint
            dataType: 'json',
            delay: 100, // kesleltetes a typing utan !! CSAK 20000 REQUEST VAN / HONAP !!
            data: function (params) {
                return {
                    search: params.term // a beirt szoveg
                };
            },
            processResults: function (data) {
                // A kapott gameneveket Select2 formatumba alakitjuk
                return {
                    results: data.map(game => ({ id: game, text: game }))
                };
            },
            cache: true
        }
    });


} else {
    showSection('home-section'); // ha nem szobas link, akkor fooldalra
}