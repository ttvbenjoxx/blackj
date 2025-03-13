/******************************************************
 * script.js
 * - Connects to wss://renderwebsocket-u5u4.onrender.com
 * - Logs all events in the console for debugging
 ******************************************************/
const connectionStatus = document.getElementById("connectionStatus");
const roomsDiv = document.getElementById("rooms");
const gameDiv = document.getElementById("game");
const roomLabel = document.getElementById("roomLabel");
const creditsSpan = document.getElementById("credits");
const betSection = document.getElementById("betSection");
const currentBetSpan = document.getElementById("currentBet");

// HARDCODED RENDER URL
const ws = new WebSocket("wss://renderwebsocket-u5u4.onrender.com");

let playerId = "player-" + Math.floor(Math.random() * 100000);
let currentRoom = "";
let credits = 1000;
let currentBet = 0;

// Log connection events
ws.onopen = () => {
  console.log("WebSocket connected!");
  connectionStatus.textContent = "Connected";
};
ws.onclose = () => {
  console.log("WebSocket closed.");
  connectionStatus.textContent = "Disconnected";
};
ws.onerror = (err) => {
  console.error("WebSocket error:", err);
  connectionStatus.textContent = "Disconnected";
};

// Log incoming messages
ws.onmessage = (event) => {
  console.log("Received:", event.data);
  try {
    const data = JSON.parse(event.data);

    // Example: if the server sends "room_update"
    if (data.type === "room_update" && data.roomName === currentRoom) {
      // If your server includes updated credits/bet
      const p = data.room.players[playerId];
      if (p) {
        credits = p.credits;
        currentBet = p.bet;
        creditsSpan.textContent = credits;
        currentBetSpan.textContent = currentBet;
      }
    }
    // Example: show bet section on round_start
    if (data.type === "round_start" && data.roomName === currentRoom) {
      betSection.classList.remove("hidden");
    }
    // Example: hide bet section on round_end
    if (data.type === "round_end" && data.roomName === currentRoom) {
      betSection.classList.add("hidden");
    }
  } catch (err) {
    console.error("Failed to parse message:", err);
  }
};

// Join a room
function joinRoom(roomName) {
  console.log("Joining room:", roomName);
  currentRoom = roomName;
  roomLabel.textContent = roomName;
  roomsDiv.classList.add("hidden");
  gameDiv.classList.remove("hidden");

  ws.send(JSON.stringify({
    type: "join",
    roomName,
    playerId,
    name: "Anonymous"
  }));
}

// Adjust bet
function adjustBet(amount) {
  currentBet += amount;
  if (currentBet < 0) currentBet = 0;
  if (currentBet > credits) currentBet = credits;
  currentBetSpan.textContent = currentBet;
  console.log("Bet adjusted to:", currentBet);
}

// Place bet
function placeBet() {
  if (!currentRoom) return;
  console.log("Placing bet:", currentBet);
  ws.send(JSON.stringify({
    type: "bet",
    roomName: currentRoom,
    playerId,
    betAmount: currentBet
  }));
}
