/*********************************************************
 * script.js
 * 
 * - Connects to the server's WebSocket
 * - Joins a room, starts a round, places bets, hits, stands
 * - Shows/hides sections (bet screen, etc.) based on messages
 *********************************************************/
const connectionStatus = document.getElementById("connectionStatus");
const roomSelection = document.getElementById("roomSelection");
const gameSection = document.getElementById("game");
const roomLabel = document.getElementById("roomLabel");
const creditsSpan = document.getElementById("credits");
const betSection = document.getElementById("betSection");
const currentBetSpan = document.getElementById("currentBet");
const playerHandSection = document.getElementById("playerHandSection");
const playerHandDiv = document.getElementById("playerHand");
const dealerHandSection = document.getElementById("dealerHandSection");
const dealerHandDiv = document.getElementById("dealerHand");

// If running locally, you might use ws://localhost:3000
// If deploying to Render, replace with your WebSocket URL or dynamic logic
// For your old scoreboard Render URL: "wss://renderwebsocket-u5u4.onrender.com"
const wsProtocol = (location.protocol === "https:") ? "wss://" : "ws://";
const ws = new WebSocket("wss://renderwebsocket-u5u4.onrender.com");

let playerId = "player-" + Math.floor(Math.random() * 100000);
let currentRoom = "";
let credits = 1000;
let currentBet = 0;

ws.onopen = () => {
  connectionStatus.textContent = "Connected";
};
ws.onclose = () => {
  connectionStatus.textContent = "Disconnected";
};
ws.onerror = () => {
  connectionStatus.textContent = "Disconnected";
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    if (data.type === "room_update" && data.roomName === currentRoom) {
      // The entire room state
      const roomState = data.room;
      // Get this player's data
      const p = roomState.players[playerId];
      if (p) {
        credits = p.credits;
        currentBet = p.bet;
        creditsSpan.textContent = credits;
        currentBetSpan.textContent = currentBet;
        // Show player's hand
        displayHand(playerHandDiv, p.hand);
      }
      // Show dealer's hand if round is active
      if (roomState.roundActive) {
        dealerHandSection.classList.remove("hidden");
        displayHand(dealerHandDiv, roomState.dealerHand);
      } else {
        dealerHandSection.classList.add("hidden");
        dealerHandDiv.innerHTML = "";
      }
    }

    // Round start => show bet screen, reset UI
    if (data.type === "round_start" && data.roomName === currentRoom) {
      betSection.classList.remove("hidden");
      playerHandSection.classList.remove("hidden");
      // Clear the hands for fresh display
      playerHandDiv.innerHTML = "";
      dealerHandDiv.innerHTML = "";
    }

    // Round end => hide bet screen
    if (data.type === "round_end" && data.roomName === currentRoom) {
      betSection.classList.add("hidden");
      // After the round ends, you might also hide hit/stand if you want
    }
  } catch (err) {
    console.error("Error parsing message:", err);
  }
};

/** Join a room */
function joinRoom(roomName) {
  currentRoom = roomName;
  roomLabel.textContent = roomName;
  roomSelection.classList.add("hidden");
  gameSection.classList.remove("hidden");

  ws.send(JSON.stringify({
    type: "join",
    roomName,
    playerId,
    name: "Anonymous"
  }));
}

/** Start round => server deals new cards, sends "round_start" */
function startRound() {
  if (!currentRoom) return;
  ws.send(JSON.stringify({
    type: "start_round",
    roomName: currentRoom
  }));
}

/** Adjust bet by a certain amount */
function adjustBet(amount) {
  currentBet += amount;
  if (currentBet < 0) currentBet = 0;
  if (currentBet > credits) currentBet = credits;
  currentBetSpan.textContent = currentBet;
}

/** Send bet to server */
function placeBet() {
  if (!currentRoom) return;
  ws.send(JSON.stringify({
    type: "bet",
    roomName: currentRoom,
    playerId,
    betAmount: currentBet
  }));
}

/** "Hit" => request a card from the server */
function hit() {
  if (!currentRoom) return;
  ws.send(JSON.stringify({
    type: "hit",
    roomName: currentRoom,
    playerId
  }));
}

/** "Stand" => finish your turn */
function stand() {
  if (!currentRoom) return;
  ws.send(JSON.stringify({
    type: "stand",
    roomName: currentRoom,
    playerId
  }));
}

/** Display a hand of cards in a given container */
function displayHand(container, hand) {
  container.innerHTML = "";
  hand.forEach(card => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "card";
    cardDiv.textContent = card.value + card.suit;
    container.appendChild(cardDiv);
  });
}
