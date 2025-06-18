// ddns
const MYADDR_SECRET_KEY = process.env.MYADDR_SECRET_KEY;
// const UPDATE_URL = `https://myaddr.io/update?key=${MYADDR_SECRET_KEY}&ip=self`; ha minden vesz

async function updateMyaddrDns() {
    let publicIpv4 = null;
    try {
        const ipResponse = await fetch('https://api.ipify.org?format=json'); //ipv4 lekeres
        const ipData = await ipResponse.json();
        publicIpv4 = ipData.ip;
        console.log(`Publikus IPv4 cím: ${publicIpv4}`);

        if (!publicIpv4) {
            console.error('Nem sikerult lekerni a publikus IPv4 cimet.');
            return;
        }

        // ha jo frissitjuk a myaddr-t
        const UPDATE_URL_WITH_IPV4 = `https://myaddr.io/update?key=${MYADDR_SECRET_KEY}&ip=${publicIpv4}`;

        const response = await fetch(UPDATE_URL_WITH_IPV4);

        if (response.ok) {
            console.log('myaddr.tools DNS frissites sikeresen elkuldve.');
        } else {
            const errorText = await response.text();
            console.error('Hiba tortent a myaddr.tools DNS frissitesekor:', response.status, errorText);
        }
    } catch (error) {
        console.error('Halozati hiba a myaddr.tools DNS frissitesekor:', error);
    }
}

updateMyaddrDns();

const RAWG_API_KEY = process.env.RAWG_API_KEY; // game database API


// modulok
const express = require('express'); //webes keretrendszer
const path = require('path'); //fajlutvonal kezelesre

const https = require('https');
const http = require('http');
const fs = require('fs');   

const app = express(); // app az egesz webalkalmazas objektuma

const privateKey = fs.readFileSync('C:/Users/a12xb/.acme.sh/gamepickermania.myaddr.io_ecc/gamepickermania.myaddr.io.key', 'utf8');
const certificate = fs.readFileSync('C:/Users/a12xb/.acme.sh/gamepickermania.myaddr.io_ecc/fullchain.cer', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// inmemory szobaknak
const rooms = {};

// ez adatbazisbol kesobb
/* const gameList = [
  "Counter Strike",
  "League of Legends",
  "Valorant",
  "osu!",
  "Minecraft",
  "Fortnite",
  "Rocket League",
  "Elden Ring",
]; */

// middleware, json bodyk parseolasara (req.body objektumban)
app.use(express.json());

// statik fajloknak public lesz a gyoker
app.use('/', express.static(path.join(__dirname, 'public')));

// API endpointok, (logikai utvonalak, a kliens majd ezeket keri le)
// !! js objektumok dynamicek vigyazz !!
// uj szoba letrehozasa
app.post('/api/create-room', (req, res) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase(); // ID generalo (XD)
    rooms[roomId] = {
        players: {}, // userID: [game1, game2, ...]
        playerCount: 0
    };
    console.log(`Room created: ${roomId}`);
    res.json({ roomId: roomId }); //vissza a kliensnek
});

// kliens lista lekeres API ADATBAZISBOL
app.get('/api/games', async (req, res) => {
    const { search } = req.query; // pl: /api/games?search=counter
    let url = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}`;

    if (search) {
        url += `&search=${encodeURIComponent(search)}`;
    }
    url += '&page_size=20'; // mennyi talalatot ker egyszerre

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`RAWG API hiba: ${response.statusText}`);
        }
        const data = await response.json();
        // csak game neveit kuldi vissza
        const gameNames = data.results.map(game => game.name);
        res.json(gameNames);
    } catch (error) {
        console.error('Error a RAWG API hivasakor:', error);
        res.status(500).json({ message: 'Nem sikerult lekerni a game listat.' });
    }
});

// gamek elkuldese a szobaba
// bodynak igy kell kineznie: { playerId: "valami", selectedGames: ["Game A", "Game B"] }
app.post('/api/room/:roomId/submit-games', (req, res) => {  // expressnel a :valami valtozo ugye
    const roomId = req.params.roomId.toUpperCase();
    const { playerId, selectedGames } = req.body; //ezt kuldte a kliens (crazy destructuring szintax)

    if (!rooms[roomId]) {
        return res.status(404).json({ message: 'Room not found.' });
    }
    if (!playerId || !Array.isArray(selectedGames)) { //tomb-e ha majd kesobb elbaszok vmit //elbasztam igen, koszi koszonom
        return res.status(400).json({ message: 'Missing or incorrect data.' }); // 400 az hibas keres
    }

    if (!rooms[roomId].players[playerId]) { //ha nincs benne, vagyis uj
        rooms[roomId].playerCount++;
    }
    rooms[roomId].players[playerId] = selectedGames; //ha uj ez hozzaadja, ha nem, frissiti
    console.log(`Player ${playerId} chose in room ${roomId}:`, selectedGames);
    res.json({ message: 'Games saved.', currentPlayers: rooms[roomId].playerCount });
});

// "MATCH" <333333
app.get('/api/room/:roomId/evaluate', (req, res) => {
    const roomId = req.params.roomId.toUpperCase(); //url-bol

    if (!rooms[roomId]) {
        return res.status(404).json({ message: 'Room not found.' });
    }

    const playersChoices = Object.values(rooms[roomId].players); // [['game A', 'game B'], ['game B', 'game C']]

    if (playersChoices.length === 0) {
        return res.json({ matches: [], message: 'Nobody chose a single game.' });
    }

    // kozos gamek logika
    let commonGames = [];
    if (playersChoices.length > 0) {
        // elso jatekossal set (setnel nem lehet duplicate ugye)
        commonGames = new Set(playersChoices[0]);

        // megy vegig a tobbin, es szukiti a halmazt
        for (let i = 1; i < playersChoices.length; i++) { //masodik jatekostol
            const currentPlayerGames = new Set(playersChoices[i]);
            commonGames = new Set([...commonGames].filter(currentGame => currentPlayerGames.has(currentGame))); //metszetet tartja meg csak, filter truekat
        } // ... spread operator hogy tomb legyen mert a filter nem mukodik seteken
    }

    const matches = Array.from(commonGames);
    console.log(`Match results in room ${roomId}:`, matches);
    res.json({ matches: matches, message: 'The common games.' });
});
// fo oldal es room oldal kiszolgalas
app.get(['/', '/room/:roomId'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});




// INDITAS (EZT CHATGPT IRTA)
http.createServer((req, res) => {
    res.writeHead(301, { "Location": "https://" + req.headers.host + req.url });
    res.end();
}).listen(80, () => {
    console.log('HTTP Server (redirecting to HTTPS) running on port 80');
});

// HTTPS szerver indítása a 443-as porton
https.createServer(credentials, app).listen(443, () => {
    console.log('HTTPS Server running on port 443');
    console.log(`Access your app securely at https://gamepickermania.myaddr.io`);
});