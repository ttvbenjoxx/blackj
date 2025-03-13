/********************************************************************
 * server.js
 * A simple Node + Express + ws server that handles:
 *  - Multiple rooms
 *  - Round start/end
 *  - Basic Blackjack logic (deal, hit, stand)
 *
 * HOW IT WORKS:
 * 1. Each room has its own deck, dealer hand, and players.
 * 2. On "round_start", server resets deck, deals two cards to each player,
 *    and sends a "round_start" message to clients, telling them to show
 *    the bet screen.
 * 3. Clients place bets, then can "hit" or "stand".
 * 4. When all players are done, the server finishes dealer's hand,
 *    updates credits, and broadcasts "round_end".
 ********************************************************************/
const express = require("express");
const WebSocket = require("ws");
const path = require("path");

const PORT = process.env.PORT || 3000;
const app = express();

// Serve index.html + style.css + script.js from the same folder
app.use(express.static(__dirname));

// Start the HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Create a WebSocket server on top of our HTTP server
const wss = new WebSocket.Server({ server });

// In-memory store of rooms
let rooms = {
  "Room 1": createRoomState("Room 1"),
  "Room 2": createRoomState("Room 2"),
  "Room 3": createRoomState("Room 3")
};

/** Helper to create a new blank room state */
function createRoomState(name) {
  return {
    name,
    players: {},      // playerId -> { name, credits, bet, hand, done }
    dealerHand: [],   // dealer's cards
    deck: [],         // array of cards
    roundActive: false
  };
}

/** Broadcast the entire room state to all players in that room */
function broadcastRoom(roomName) {
  const room = rooms[roomName];
  const data = {
    type: "room_update",
    roomName,
    room
  };
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.roomName === roomName) {
      client.send(JSON.stringify(data));
    }
  });
}

/** Start a new round in the specified room */
function startRound(roomName) {
  const room = rooms[roomName];
  if (!room) return;
  
  // Reset deck, dealer, etc.
  room.deck = createShuffledDeck();
  room.dealerHand = [];
  room.roundActive = true;

  // Reset each player for the new round
  Object.values(room.players).forEach(player => {
    player.hand = [];
    player.bet = 0;
    player.done = false;
  });

  // Deal 2 cards to each player
  for (let i = 0; i < 2; i++) {
    Object.values(room.players).forEach(player => {
      player.hand.push(room.deck.pop());
    });
    // 2 cards to the dealer
    room.dealerHand.push(room.deck.pop());
  }

  // Broadcast "round_start" so clients show the bet screen
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.roomName === roomName) {
      client.send(JSON.stringify({
        type: "round_start",
        roomName
      }));
    }
  });

  // Then broadcast full room state (so they see initial hands, etc.)
  broadcastRoom(roomName);
}

/** End the round: do dealer logic, compare hands, update credits */
function endRound(roomName) {
  const room = rooms[roomName];
  if (!room) return;

  // Let the dealer draw until 17 or more
  while (calculateHandValue(room.dealerHand) < 17) {
    room.dealerHand.push(room.deck.pop());
  }

  // Compare dealer's final hand with each player
  const dealerValue = calculateHandValue(room.dealerHand);

  Object.values(room.players).forEach(player => {
    if (player.bet > 0) {
      const playerValue = calculateHandValue(player.hand);
      if (playerValue > 21) {
        // Player bust - lose
        player.credits -= player.bet;
      } else if (dealerValue > 21 || playerValue > dealerValue) {
        // Dealer bust or player higher
        player.credits += player.bet;
      } else if (playerValue < dealerValue) {
        // Dealer higher
        player.credits -= player.bet;
      } else {
        // tie => push => no change
      }
    }
  });

  room.roundActive = false;

  // Broadcast "round_end" so clients hide bet screen
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.roomName === roomName) {
      client.send(JSON.stringify({
        type: "round_end",
        roomName
      }));
    }
  });

  // Finally, broadcast updated room state
  broadcastRoom(roomName);
}

/** Check if all players are "done" => end the round */
function checkAllPlayersDone(roomName) {
  const room = rooms[roomName];
  if (!room) return;
  const playersArr = Object.values(room.players);
  if (playersArr.length === 0) return;

  const allDone = playersArr.every(p => p.done === true);
  if (allDone) {
    endRound(roomName);
  }
}

/** Create a fresh deck of 52 cards, shuffle, return */
function createShuffledDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  let deck = [];
  for (let suit of suits) {
    for (let val of values) {
      deck.push({ value: val, suit });
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Calculate Blackjack hand value (Aces can be 1 or 11) */
function calculateHandValue(hand) {
  let total = 0;
  let aces = 0;
  for (let card of hand) {
    if (card.value === "A") {
      total += 11;
      aces++;
    } else if (["J", "Q", "K"].includes(card.value)) {
      total += 10;
    } else {
      total += parseInt(card.value);
    }
  }
  // Adjust for aces if over 21
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

wss.on("connection", (ws) => {
  console.log("Client connected.");

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      console.error("Invalid message:", err);
      return;
    }

    const { type, roomName, playerId } = data;

    // Ensure room exists
    if (!rooms[roomName] && roomName) {
      rooms[roomName] = createRoomState(roomName);
    }

    if (type === "join") {
      // data => { type, roomName, playerId, name }
      ws.roomName = roomName;
      ws.playerId = playerId;
      const name = data.name || "Anonymous";
      if (!rooms[roomName].players[playerId]) {
        rooms[roomName].players[playerId] = {
          name,
          credits: 1000,
          bet: 0,
          hand: [],
          done: false
        };
      }
      broadcastRoom(roomName);

    } else if (type === "start_round") {
      // data => { type, roomName }
      startRound(roomName);

    } else if (type === "bet") {
      // data => { type, roomName, playerId, betAmount }
      const { betAmount } = data;
      const player = rooms[roomName].players[playerId];
      if (player && rooms[roomName].roundActive) {
        // set player's bet
        player.bet = betAmount;
      }
      broadcastRoom(roomName);

    } else if (type === "hit") {
      // data => { type, roomName, playerId }
      const player = rooms[roomName].players[playerId];
      if (player && rooms[roomName].roundActive && !player.done) {
        // deal a card
        player.hand.push(rooms[roomName].deck.pop());
        // check if bust
        if (calculateHandValue(player.hand) > 21) {
          player.done = true;
        }
      }
      broadcastRoom(roomName);
      checkAllPlayersDone(roomName);

    } else if (type === "stand") {
      // data => { type, roomName, playerId }
      const player = rooms[roomName].players[playerId];
      if (player && rooms[roomName].roundActive) {
        player.done = true;
      }
      broadcastRoom(roomName);
      checkAllPlayersDone(roomName);
    }
  });

  ws.on("close", () => {
    if (ws.roomName && ws.playerId) {
      delete rooms[ws.roomName].players[ws.playerId];
      broadcastRoom(ws.roomName);
    }
    console.log("Client disconnected.");
  });
});
