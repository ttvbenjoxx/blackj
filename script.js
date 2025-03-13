// Connect to your existing Render WebSocket endpoint
const ws = new WebSocket("wss://renderwebsocket-u5u4.onrender.com");

// Basic UI references
const connectionStatus = document.getElementById("connectionStatus");
const roomLabel = document.getElementById("roomLabel");
const creditsSpan = document.getElementById("credits");
const currentBetSpan = document.getElementById("currentBet");
const betSection = document.getElementById("betSection");

let playerId = "player-" + Math.floor(Math.random() * 100000);
let currentRoom = "";
let credits = 1000;
let currentBet = 0;

// Connection events
ws.onopen = () => (connectionStatus.textContent = "Connected");
ws.onclose = () => (connectionStatus.textContent = "Disconnected");
ws.onerror = () => (connectionStatus.textContent = "Disconnected");

// Incoming messages
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    // Example: show bet screen on "round_start"
    if (data.type === "round_start" && data.roomName === currentRoom) {
      betSection.classList.remove("hidden");
    }

    // Example: hide bet screen on "round_end"
    if (data.type === "round_end" && data.roomName === currentRoom) {
      betSection.classList.add("hidden");
    }

    // Example: room updates
    if (data.type === "room_update" && data.roomName === currentRoom) {
      const playerData = data.room.players[playerId];
      if (playerData) {
        credits = playerData.credits;
        currentBet = playerData.bet;
        creditsSpan.textContent = credits;
        currentBetSpan.textContent = currentBet;
      }
    }
  } catch (err) {
    console.error("Error parsing WebSocket message:", err);
  }
};

// Join a room
function joinRoom(roomName) {
  currentRoom = roomName;
  roomLabel.textContent = "Joined " + roomName;
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
}

// Send bet to server
function placeBet() {
  if (!currentRoom) return;
  ws.send(JSON.stringify({
    type: "bet",
    roomName: currentRoom,
    playerId,
    betAmount: currentBet
  }));
}
