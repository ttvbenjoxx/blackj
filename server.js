/********************************************************************
 * server.js
 * 
 * 1. Uses Express to serve index.html, style.css, script.js from
 *    the same folder.
 * 2. There's NO actual WebSocket server logic here, because you're
 *    connecting to "wss://renderwebsocket-u5u4.onrender.com"
 *    (which presumably is your old scoreboard or some other server).
 ********************************************************************/
const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 3000;
const app = express();

// Serve all files (index.html, style.css, script.js) from this folder
app.use(express.static(__dirname));

// Optional root route (just in case)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log("HTTP server is running on port " + PORT);
  console.log("Serving files from " + __dirname);
});
