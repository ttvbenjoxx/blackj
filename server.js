/********************************************************************
 * server.js
 * A simple Node + Express + ws server for a “Blackjack-like” setup.
 * 
 * - Stores multiple rooms in memory.
 * - Each room has players (credits, bet, etc.).
 * - Clients send JSON messages to join a room, place a bet, etc.
 * - Server broadcasts updated room state to everyone in that room.
 ********************************************************************/

const express = require("express");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const app = express();
const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Serve any static files (like index.html) from a "public" folder
app.use(express.static(__dirname + "/public"));

// Create a WebSocket server on top of our HTTP server
const wss = new WebSocket.Server({ server });

// In-memory rooms (like your scoreboard object)
let rooms = {
  "Room 1": { players: {}, started: false },
  "Room 2": { players: {}, started: false },
  "Room 3": { players: {}, started: false }
};

/**
 * Broadcast the updated room state to everyone in that room
 */
function broadcastRoom(roomName) {
  const room = rooms[roomName];
  const data = {
    type: "room_update",
    roomName,
    room
  };
  // Send to all connected clients in that room
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.roomName === roomName) {
      client.send(JSON.stringify(data));
    }
  });
}

wss.on("connection", (ws) => {
  console.log("Client connected via WebSocket.");

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.error("Invalid JSON message:", e);
      return;
    }

    // Handle different message types
    if (data.type === "join") {
      // data => { type: "join", roomName, playerId, name }
      const { roomName, playerId, name } = data;
      if (!rooms[roomName]) {
        rooms[roomName] = { players: {}, started: false };
      }
      // Add this player to the room with 1000 credits, etc.
      rooms[roomName].players[playerId] = {
        name: name || "Player",
        credits: 1000,
        bet: 0,
        hand: []
      };

      // Attach roomName/playerId to the ws for broadcasting
      ws.roomName = roomName;
      ws.playerId = playerId;

      // Broadcast updated room state
      broadcastRoom(roomName);

    } else if (data.type === "bet") {
      // data => { type: "bet", roomName, playerId, betAmount }
      const { roomName, playerId, betAmount } = data;
      if (rooms[roomName] && rooms[roomName].players[playerId]) {
        rooms[roomName].players[playerId].bet = betAmount;
      }
      broadcastRoom(roomName);

    } else if (data.type === "hit") {
      // e.g. { type: "hit", roomName, playerId }
      // Add your “draw card” logic here, then broadcast.
    } else if (data.type === "stand") {
      // e.g. { type: "stand", roomName, playerId }
      // Add your “stand” logic here, then broadcast.
    }
  });

  // When a client disconnects
  ws.on("close", () => {
    if (ws.roomName && ws.playerId) {
      const { roomName, playerId } = ws;
      delete rooms[roomName].players[playerId];
      broadcastRoom(roomName);
    }
    console.log("Client disconnected.");
  });
});
