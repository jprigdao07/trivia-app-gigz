// socket-bridge/server.js
console.log("🚀 CONTROLLER SERVER STARTED - session-summary build");
const express = require('express');
const http = require('http');
const path = require('path');
const mysql = require('mysql2/promise');
const { Server } = require('socket.io');
const cors = require('cors');
const { randomUUID } = require('crypto');
const gameRounds = {}; 

const ALLOWED_ORIGINS = [
  'http://localhost:4001',
  'http://localhost:8080',
  "https://localhost:8080",
  'http://localhost:3000',
  'http://192.168.1.77:8080',
  'http://192.168.1.77:3000',
  'http://192.168.1.77:4001',
  "https://192.168.1.77:8081"
];
const CONTROLLER_SECRET = 'secret123';

// MySQL Connection Pool
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'trivia_quiz_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection()
  .then(() => console.log('✅ Connected to MySQL database.'))
  .catch(err => {
    console.error('❌ Error connecting to the database:', err);
    process.exit(1);
  });

const app = express();

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none"); // ✅ allow script embedding
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups"); // ✅ relax isolation
  next();
});

app.use(express.json());
app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Serve static files (so /gigz.html works)
app.use(express.static(path.join(__dirname, 'public')));

// Simple healthcheck route
app.get('/', (req, res) => res.send('✅ Socket bridge running'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
    },
    transports: ["websocket", "polling"]
});


const { io: Client } = require("socket.io-client");

const clusterSocket = Client("http://192.168.1.88:5000", {
  transports: ["websocket"]
});


console.log("🚀 Creating connection to SBC Cluster Server...");

clusterSocket.on("connect", () => {
  console.log("✅ Connected to SBC Cluster Server");
  console.log("Socket ID:", clusterSocket.id);
});

clusterSocket.on("disconnect", reason => {
  console.log("❌ Disconnected:", reason);
});

clusterSocket.on("connect_error", err => {
  console.error("❌ Connection Error");
  console.error(err.message);
});

clusterSocket.on("error", err => {
  console.error("❌ Socket Error:", err);
});

function verifyToken(token) {
  return token && token === CONTROLLER_SECRET;
}

// 🧠 Global variable to store the latest active Game ID
let latestGameId = null;

// Timer used to automatically clear the active game at midnight
let latestGameCleanupTimer = null;


// =============================================
// 🕛 SCHEDULE SERVER MIDNIGHT CLEANUP
// =============================================
function scheduleLatestGameCleanup() {

  // Cancel previous timer if there is one
  if (latestGameCleanupTimer) {
    clearTimeout(latestGameCleanupTimer);
  }

  const now = new Date();

  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const delay = midnight - now;

  console.log(
    `🕛 Server cleanup scheduled in ${Math.round(delay / 1000)} seconds`
  );

  latestGameCleanupTimer = setTimeout(() => {

    console.log("🗑 Midnight reached");

    latestGameId = null;

    console.log("✅ latestGameId cleared");

    io.emit("latest-game-id-updated", {
      id: null
    });

  }, delay);

}

// =============================================
// 🕛 SCHEDULE SERVER CLEANUP (TEST MODE) Server
// =============================================
// function scheduleLatestGameCleanup() {

//     if (latestGameCleanupTimer) {
//         clearTimeout(latestGameCleanupTimer);
//     }

//     console.log("🧪 TEST MODE: Server cleanup scheduled in 20 seconds");

//     latestGameCleanupTimer = setTimeout(() => {

//         console.log("🗑 TEST MODE: Server cleanup");

//         latestGameId = null;

//         console.log("✅ latestGameId cleared");

//         // Don't broadcast null during testing.
//         // io.emit("latest-game-id-updated", { id: null });

//     }, 30000);
// }

// ✅ API to set the latest active game ID
app.post('/api/set-latest-game-id', express.json(), (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  latestGameId = id;
  console.log('🔗 Latest Game ID updated to:', id);

  scheduleLatestGameCleanup();

  console.log('🔗 Latest Game ID updated to:', id);

  // 🔁 Broadcast to all connected controllers
  io.emit('latest-game-id-updated', { id });

  res.json({ success: true, id });
});

// ✅ Optional: endpoint for controller to check current active game
app.get('/api/get-latest-game-id', (req, res) => {

  console.log("========== GET ACTIVE GAME ==========");
  console.log(global.activeGame);
  console.log("latestGameId:", latestGameId);
  console.log("====================================");

      res.json({
        id: global.activeGame?.gameId ?? null,
        scheduledStart: global.activeGame?.scheduledStart ?? null
    });
});

// ✅ Start Countdown API → triggers the event for the correct room
app.post("/api/start-countdown", (req, res) => {
  console.log("🔥 start-countdown RECEIVED:", req.body);
  const { gameId } = req.body;
  const startTime = Date.now(); // ✅ use server-side timestamp

  if (!gameId) {
    return res.status(400).json({ error: "Missing gameId" });
  }

  console.log("🕹️ Broadcasting countdown for game", gameId, "at", new Date(startTime).toLocaleTimeString());

  io.to(`game:${gameId}`).emit("controller:start_countdown", {
    gameId,
    scheduledStart: new Date(startTime).toISOString(), // React expects this
    startTime
  });

  return res.json({ success: true, gameId, startTime });
});

// 🧩 --- SOCKET.IO HANDLING --- 🧩
io.on("connection", (socket) => {
  console.log("Handshake auth:", socket.handshake.auth);

  const { role, gameId } = socket.handshake.auth || {};
  console.log(`🟢 New client connected: ${socket.id} (${role || "unknown"})`);

    console.log("Client connected:", socket.id);


if (role === "quiz-server") {

    console.log("📦 Quiz Server connected.");

    socket.on("master:session_uploaded", (data) => {

        console.log("🎉 RECEIVED master:session_uploaded");
        console.log(data);

        console.log("Clients:", io.engine.clientsCount);

        io.fetchSockets().then((sockets) => {
            console.log("Connected sockets:");

            sockets.forEach(s => {
                console.log(
                    s.id,
                    s.handshake.auth.role,
                    s.handshake.auth.gameId
                );
            });
        });

        console.log("📡 About to broadcast session-upload-success");

        console.log("📡 About to broadcast session-upload-success");

        io.fetchSockets().then((sockets) => {

            sockets.forEach(s => {

                console.log(
                    "📤 Sending session-upload-success to:",
                    s.id,
                    s.handshake.auth?.role,
                    s.handshake.auth?.gameId
                );

                s.emit("session-upload-success", data);

            });

            console.log("📡 session-upload-success broadcast completed");

            });

        console.log("📢 Broadcasted upload confirmation.");

        console.log("📡 session-upload-success broadcast completed");

    });

    socket.on("master:session_upload_failed", (data) => {

        console.log("❌ RECEIVED master:session_upload_failed");


        console.log("📛 Failure sender socket:", socket.id);
        console.log("📛 Failure sender role:", socket.handshake.auth?.role);
        console.log("📛 Failure sender gameId:", socket.handshake.auth?.gameId);
        console.log("📛 Failure payload:", data);

        io.emit("session-upload-failed", data);

    });

}

  // =========================================
  // RELAY QUIZ PACKAGE TO SLAVES
  // =========================================
  socket.on("master:quiz_data", (payload) => {

    console.log("📡 Relaying quiz package to slaves");

    socket.broadcast.emit("master:quiz_data", payload);

  });


  socket.on("ping-test", () => {
    console.log("✅ Ping received from controller:", socket.id);
  });


// =============================================
// 🔍 RECEIVE QUIZ VALIDATION STATUS FROM SLAVE
// =============================================
socket.on("slave:quiz_ready", (payload) => {

  console.log("📥 SLAVE QUIZ VALIDATION RESPONSE");

  console.log("Device ID:", payload.deviceId);
  console.log("Game ID:", payload.gameId);
  console.log("Status:", payload.status);
  console.log("Quiz Version:", payload.quizVersion);

  // =============================================
  // 📡 FORWARD TO SBC CLUSTER SERVER
  // =============================================
  console.log("📡 ABOUT TO FORWARD QUIZ SYNC UPDATE");


  console.log("clusterSocket.connected =", clusterSocket.connected);
  console.log("clusterSocket.id =", clusterSocket.id);

  clusterSocket.emit("quiz-sync-update", {
    deviceId: payload.deviceId,
    gameId: payload.gameId,
    status: payload.status,
    quizVersion: payload.quizVersion,
    reason: payload.reason,
    expectedVersion: payload.expectedVersion
  });

  console.log(
    "📡 QUIZ SYNC UPDATE SENT TO CLUSTER SERVER:",
    payload.deviceId
  );

  if (payload.status === "ok") {

    console.log("✅ SLAVE QUIZ VALIDATION PASSED");

  } else {

    console.error("❌ SLAVE QUIZ VALIDATION FAILED");
    console.error("Reason:", payload.reason);
    console.error("Expected Version:", payload.expectedVersion);
    console.error("Actual Version:", payload.quizVersion);

  }

});

  // ✅ Always join global room (for cross-game events)
  socket.join("global");
  console.log(`🌍 ${socket.id} joined global room`);

  if (role === "quiz" && gameId) {
    socket.join(`game:${gameId}`);
    console.log(`🎮 Quiz joined room: game:${gameId}`);
    socket.emit("joinedRoom", { gameId });
  }

  if (role === "controller") {
    console.log(`🎛️ Controller connected with gameId: ${gameId}`);
  }

  // --- Join Room Handler ---
  socket.on("joinRoom", ({ gameId }) => {
    if (!gameId) return;
    socket.join(`game:${gameId}`);
    console.log(`📢 ${socket.id} joined game room: game:${gameId}`);
  });

  socket.on('display:page_type', ({ pageType }) => {
  const { gameId, role } = socket.handshake.auth || {};

  if (!gameId) {
    console.warn('⚠️ display:page_type missing gameId');
    return;
  }

  console.log('📄 Page type:', pageType, 'Game:', gameId);

  // Send to all other clients in this game (controller + displays)
  socket.to(`game:${gameId}`).emit('display:page_type', {
    pageType
  });
});

  // --- Controller selected quiz ---
  socket.on("controller:selected_quiz", ({ gameId }) => {
    if (!gameId) return;
    console.log("🎯 [controller] selected quiz:", gameId);
    const room = `game:${gameId}`;
    // io.emit("controller:selected_quiz", { gameId });
    // io.to(room).emit("controller:selected_quiz", { gameId });
    io.emit("controller:selected_quiz", { gameId });
    io.emit("controller:selected_quiz_global", { gameId });
    console.log(`📢 Broadcasted controller:selected_quiz to room: ${room} + global`);
  });

  // ♻️ Controller requests quizzes app to reload
socket.on("controller:reload_quizzes", ({ gameId }) => {
  console.log("♻️ [controller] requested quizzes reload for:", gameId);

  // Broadcast to all quizzes (global + specific room)
  io.to(`game:${gameId}`).emit("controller:reload_quizzes", { gameId });
  io.to("global").emit("controller:reload_quizzes", { gameId });

  console.log(`📢 Broadcasted controller:reload_quizzes to game:${gameId} + global`);
});

  // --- Global latest-game-id-updated broadcast ---
  socket.on("latest-game-id-updated", ({ id }) => {
    if (!id) return;
    latestGameId = id;
    io.emit("latest-game-id-updated", { id });
    console.log("📢 Re-broadcasted latest-game-id-updated to all clients:", id);
  });

  // --- Countdown Start ---
socket.on("controller:start_countdown", ({ gameId }) => {
  console.log("🚀 Broadcasting controller:start_countdown:", gameId);
  io.to(`game:${gameId}`).emit("controller:start_countdown", { gameId });
});

  socket.on("disconnect", () => {
    console.log(`❎ Client disconnected: ${socket.id}`);
  });

  // 🎮 Controller events → forward to game room
  socket.on('controller:next', (payload) => {
    if (gameId) io.to(`game:${gameId}`).emit('controller:next', payload);
  });
  socket.on('controller:prev', (payload) => {
    if (gameId) io.to(`game:${gameId}`).emit('controller:prev', payload);
  });
  socket.on('controller:skip', (payload) => {
    if (gameId) io.to(`game:${gameId}`).emit('controller:skip', payload);
  });
  socket.on('controller:end', (payload) => {
    if (gameId) io.to(`game:${gameId}`).emit('controller:end', payload);
  });

// 🎯 Controller selected a quiz → broadcast globally (for testing)
// socket.on("controller:selected_quiz", ({ gameId }) => {
//   console.log("🎯 [controller] selected quiz:", gameId);

//   if (!gameId) {
//     console.warn("⚠️ Missing gameId in controller:selected_quiz");
//     return;
//   }

//   const roomName = `game:${gameId}`;

//   // ✅ Send to the specific game room
//   io.to(roomName).emit("controller:selected_quiz", { gameId });

//   // 🌐 Also broadcast globally (backup for any client not yet in room)
//   io.emit("controller:selected_quiz_global", { gameId });

//   console.log(`📢 Broadcasted controller:selected_quiz to room: ${roomName} + global`);
// });

// 🏆 Controller sends updated scores
socket.on("controller:update_score", ({ gameId, roundIndex, scores }) => {
  if (!gameId) return;

  const room = `game:${gameId}`;

  // Initialize server-side tracking
  if (!gameRounds[gameId]) gameRounds[gameId] = {};
  if (!gameRounds[gameId][roundIndex]) gameRounds[gameId][roundIndex] = {};

  // Merge incoming scores
  Object.assign(gameRounds[gameId][roundIndex], scores);

  // Check if all teams scored (server-side)
  const allTeamsScored = Object.values(gameRounds[gameId][roundIndex]).every(scored => scored === true);

  // Emit updated scores to clients
  io.to(room).emit("updateScores", gameRounds[gameId][roundIndex]);

  // Notify quiz clients if all teams scored
  if (allTeamsScored) {
    io.to(room).emit("quiz:all-teams-scored", { roundIndex, gameId });
    console.log(`🔓 All teams scored for game ${gameId}, round ${roundIndex}`);
  }
});

// 🎯 Controller requests new quiz
socket.on("quiz:generate_new", ({ gameId }) => {
  console.log("🎯 Controller requested to generate a new quiz with ID:", gameId);

  // ✅ Tell the specific quiz client(s) to auto-generate a new quiz
  io.to(`game:${gameId}`).emit("quiz:generate_new", { gameId });
});

// ✅ Quiz confirms new quiz creation
socket.on("quiz:new_created", ({ gameId }) => {
  console.log("✅ Quiz has created a new game:", gameId);

  // Notify the controller that quiz is ready
  io.to(`game:${gameId}`).emit("quiz:new_created", { gameId });
});

  // --- Join room ---
  socket.on("joinRoom", ({ gameId }) => {
    if (!gameId) return;
    socket.join(`game:${gameId}`);
    console.log(`📢 ${socket.id} joined game room: game:${gameId}`);
  });

  // 🔌 On disconnect
  socket.on('disconnect', () => {
    console.log('❎ Client disconnected:', socket.id);
  });

  // === Controller adds a new team ===
  socket.on("controller:add_team", ({ gameId, teamName }) => {
    console.log(`👥 New team added to game ${gameId}: ${teamName}`);

    // ✅ Broadcast to all quizzes connected under this gameId
    io.to(gameId).emit("quiz:update_teams", { gameId, teamName });
  });
  
// socket.on("start-countdown", (data) => {
//   console.log("🔁 Broadcasting countdown start:", data);
//   io.emit("start-countdown", data); // Send to all displays
// });

socket.on("master:session_uploaded", (payload) => {

    console.log("");
    console.log("========================================");
    console.log("📦 MASTER SESSION UPLOADED RECEIVED");
    console.log("Game ID:", payload?.gameId);
    console.log("Uploaded At:", payload?.uploadedAt);
    console.log("Master:", payload?.master);
    console.log("Sender Socket ID:", socket.id);
    console.log("========================================");

    io.emit("session-uploaded", payload);

    console.log("📡 session-uploaded BROADCAST SENT");
    console.log("Game ID:", payload?.gameId);
    console.log("Uploaded At:", payload?.uploadedAt);
});


socket.on("master:session_upload_failed", (payload) => {

    console.log("");
    console.log("========================================");
    console.log("🔴 MASTER SESSION UPLOAD FAILED");
    console.log("Game ID:", payload?.gameId);
    console.log("Socket ID:", socket.id);
    console.log("========================================");

    io.emit("session-upload-failed", payload);

    console.log("📡 session-upload-failed BROADCAST");
    console.log("Game ID:", payload?.gameId);
});


socket.on("controller:session_complete", ({ gameId }) => {

    console.log("");
    console.log("========================================");
    console.log("📦 [controller] SESSION COMPLETE RECEIVED");
    console.log("Game ID:", gameId);
    console.log("Sender Socket ID:", socket.id);
    console.log("Sender Role:", socket.handshake.auth?.role);
    console.log("========================================");

    io.emit("controller:session_complete", {
        gameId
    });

    console.log("📡 controller:session_complete BROADCAST");
    console.log("Game ID:", gameId);
});
});

// =====================================================
// ➕ ADD TEAM (quiz_id must belong to games table)
// =====================================================
app.post('/api/teams', async (req, res) => {
  try {
    const { team_name, gameId } = req.body; // <-- accept UUID
    const createdAt = new Date();

    if (!gameId || !gameId.trim()) {
      return res.status(400).json({ success: false, message: "gameId is required" });
    }

    if (!team_name || !team_name.trim()) {
      return res.status(400).json({ success: false, message: "team_name is required" });
    }

    // Map UUID to numeric id
    const [quiz] = await db.execute(`SELECT auto_id FROM games WHERE id = ?`, [gameId]);
    if (quiz.length === 0) {
      return res.status(400).json({ success: false, message: "gameId does not exist" });
    }
    const quiz_id = quiz[0].auto_id;

    // Prevent duplicate team names
    const [existing] = await db.execute(
      `SELECT id FROM teams WHERE quiz_id = ? AND LOWER(team_name) = LOWER(?)`,
      [quiz_id, team_name.trim()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Team name already exists for this quiz" });
    }

    const [result] = await db.execute(
      `INSERT INTO teams (team_name, score, quiz_id, created_at)
       VALUES (?, 0, ?, ?)`,
      [team_name.trim(), quiz_id, createdAt]
    );

    res.json({ success: true, id: result.insertId });

  } catch (err) {
    console.error('❌ Error adding team:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/teams/:id', async (req, res) => {
  try {
    const teamId = req.params.id;

    // Delete team from database
    const [result] = await db.execute(`DELETE FROM teams WHERE id = ?`, [teamId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting team:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// 📋 GET TOP 3 TEAMS
// =====================================================
app.get("/api/top-teams", async (req, res) => {
  try {
    const { gameId } = req.query;
    if (!gameId) return res.status(400).json({ success: false, message: "gameId required" });

    const [quiz] = await db.execute("SELECT auto_id FROM games WHERE id = ?", [gameId]);
    if (!quiz.length) return res.status(400).json({ success: false, message: "Invalid gameId" });

    const quiz_id = quiz[0].auto_id;

    const [teams] = await db.execute(
      `SELECT team_name, score 
       FROM teams 
       WHERE quiz_id = ? 
       ORDER BY score DESC, team_name ASC 
       LIMIT 3`,
      [quiz_id]
    );

    res.json({ success: true, topTeams: teams });

  } catch (err) {
    console.error("❌ Error fetching top teams:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =====================================================
// 📋 GET TEAMS BY gameId (UUID from games table)
// =====================================================
app.get('/api/teams', async (req, res) => {
  try {
    const { gameId } = req.query; // <-- accept UUID

    if (!gameId || !gameId.trim()) {
      return res.status(400).json({ error: "gameId is required" });
    }

    // Map UUID to numeric quiz_id
    const [quiz] = await db.execute(`SELECT auto_id FROM games WHERE id = ?`, [gameId]);
    if (quiz.length === 0) {
      return res.status(400).json({ error: "gameId does not exist" });
    }
    const quiz_id = quiz[0].auto_id;

    // Fetch teams linked to this quiz
    const [teams] = await db.execute(
      `SELECT id, team_name, score, is_active, order_index
       FROM teams
       WHERE quiz_id = ?
       ORDER BY id ASC`,
      [quiz_id]
    );

    res.json(teams);

  } catch (err) {
    console.error("❌ Error fetching teams:", err);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});


// =====================================================
// 🧮 UPDATE TEAM SCORE
// =====================================================
// PUT /api/teams/:id/score
app.put('/api/teams/:id/score', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const score = Number(req.body.score);

    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: "Invalid team id" });
    }
    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({ success: false, error: "Invalid score" });
    }

    const updatedAt = new Date().toISOString(); // use ISO string

    // Execute update
    const [result] = await db.execute(
      `UPDATE teams SET score = ?, updated_at = ? WHERE id = ?`,
      [score, updatedAt, id]
    );

    // result.affectedRows or result.rowCount depends on driver; handle both
    const affected = result && (result.affectedRows ?? result.affectedRows === 0 ? result.affectedRows : result.rowCount);

    if (!affected) {
      console.warn(`⚠️ No rows updated for team id ${id}. Result:`, result);
      return res.status(404).json({ success: false, error: "Team not found or score unchanged" });
    }

    // Optionally return the new row
    const [rows] = await db.execute(`SELECT id, team_name, score FROM teams WHERE id = ?`, [id]);
    const updatedTeam = rows && rows[0] ? rows[0] : { id, score };

    res.json({ success: true, message: "Score updated", team: updatedTeam });
  } catch (err) {
    console.error("❌ Error updating score:", err);
    res.status(500).json({ success: false, error: "Failed to update score" });
  }
});

// =====================================================
// 📝 SAVE TEAM ANSWER
// =====================================================
app.post("/api/team-answers", async (req, res) => {
  try {
    const { team_id, round_index, question_index, correct } = req.body;

    if (!team_id || round_index === undefined || question_index === undefined) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

await db.execute(`
  INSERT INTO team_answers (team_id, round_index, question_index, correct, created_at, updated_at)
  VALUES (?, ?, ?, ?, NOW(), NOW())
  ON DUPLICATE KEY UPDATE
    correct = VALUES(correct),
    updated_at = NOW()
`, [team_id, round_index, question_index, correct]);


    res.json({ success: true, message: "Answer saved!" });
  } catch (err) {
    console.error("❌ Error saving answer:", err);
    res.status(500).json({ success: false, error: "Failed to save answer" });
  }
});

// =====================================================
// 📝 GET TEAM ANSWERS FOR ROUND
// =====================================================
app.get("/api/team-answers/:teamId/:roundIndex", async (req, res) => {
  try {
    const { teamId, roundIndex } = req.params;

    const [rows] = await db.execute(`
      SELECT question_index, correct 
      FROM team_answers 
      WHERE team_id = ? AND round_index = ?
    `, [teamId, roundIndex]);

    res.json({ answers: rows }); // must return JSON
  } catch (err) {
    console.error("❌ Error loading answers:", err);
    res.status(500).json({ error: "Failed to load answers" });
  }
});

// =====================================================
// 📦 GET SESSION SUMMARY
// =====================================================
app.get("/api/session-summary", async (req, res) => {

  try {

    const { gameId } = req.query;

    if (!gameId) {
      return res.status(400).json({
        success: false,
        message: "gameId is required"
      });
    }

    // Find the game
    const [games] = await db.execute(
      "SELECT * FROM games WHERE id = ?",
      [gameId]
    );

    if (!games.length) {
      return res.status(404).json({
        success: false,
        message: "Game not found"
      });
    }

    const game = games[0];

    // Numeric quiz_id used by teams table
    const quizId = game.auto_id;

    // Get all teams
    const [teams] = await db.execute(
      `SELECT
          id,
          team_name,
          score,
          is_active,
          order_index
       FROM teams
       WHERE quiz_id = ?
       ORDER BY score DESC`,
      [quizId]
    );

    // Top 3
    const topTeams = teams.slice(0, 3);

    res.json({

      success: true,

      session: {

        gameId: game.id,

        completedAt: new Date().toISOString(),

        game: {
          day: game.day,
          location: game.location
        },

        topTeams,

        teams

      }

    });

  } catch (err) {

    console.error("❌ Error building session summary:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});

// =====================================================
// 📦 QUIZ DATA (teams + scores) — quiz specific
// =====================================================
app.get("/api/quiz-data", async (req, res) => {
  try {
    const { quiz_id } = req.query;

    if (!quiz_id) {
      return res.status(400).json({ error: "quiz_id is required" });
    }

    const [teams] = await db.execute(
      `SELECT id, team_name, score 
       FROM teams 
       WHERE quiz_id = ?
       ORDER BY id ASC`,
      [quiz_id]
    );

    res.json({
      quiz_id,
      teams,
      scores: teams.map(t => ({
        team_name: t.team_name,
        score: t.score,
      })),
    });

  } catch (err) {
    console.error("❌ Error fetching quiz data:", err);
    res.status(500).json({ error: "Failed to fetch quiz data" });
  }
});


// ✅ POST route to broadcast scores manually (triggered by “Show Final Scores” button)
app.post("/api/show-final-scores", async (req, res) => {
  try {
    const [teams] = await db.query("SELECT team_name, location, score FROM teams");
    console.log("📢 Broadcasting final scores:", teams.length);
    io.emit("showFinalScores", { teams }); // Send event to quizzes_tab
    res.json({ success: true, message: "Final scores broadcasted.", teams });
  } catch (err) {
    console.error("❌ Error broadcasting final scores:", err);
    res.status(500).json({ message: "Error broadcasting final scores" });
  }
});

// POST /api/set-active-game
app.post("/api/set-active-game", (req, res) => {

  console.log("========== SET ACTIVE GAME ==========");
  console.log(req.body);
  console.log(global.activeGame);
  console.log("=====================================");

  const { gameId, scheduledStart } = req.body;
  if (!gameId) return res.status(400).json({ error: "Missing gameId" });

  global.activeGame = {
    gameId,
    scheduledStart: scheduledStart || new Date().toISOString(),
    started: false
  };

  latestGameId = gameId;

  console.log("latestGameId:", latestGameId);

  console.log("latestGameId AFTER SET:", latestGameId);

  console.log("🎯 Active game set:", global.activeGame);
  res.json({ success: true, activeGame: global.activeGame });
});

// POST /api/start-quiz-now
app.post("/api/start-quiz-now", (req, res) => {
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: "Missing gameId" });

  if (!global.activeGame || global.activeGame.gameId !== gameId) {
    return res.status(400).json({ error: "Game is not active" });
  }

  global.activeGame.started = true;

  // Send to specific game room
  io.to(gameId).emit("quiz:start_now", { gameId });
  io.to("global").emit("quiz:start_now", { gameId });

  console.log("🎬 START QUIZ triggered for", gameId);
  res.json({ success: true });
});

// GET /api/active-game
app.get("/api/active-game", (req, res) => {
  if (!global.activeGame) return res.json({ gameId: null, scheduledStart: null });
  res.json(global.activeGame);
});


// =============================================
// ✅ GET LATEST COUNTDOWN
// =============================================
app.get("/api/latest-countdown", async (req, res) => {
  try {
    const { gameId } = req.query;
    if (!gameId) return res.status(400).json({ error: "gameId is required" });

    const [rows] = await db.execute(
      `SELECT scheduled_start_at FROM games WHERE id = ? LIMIT 1`,
      [gameId]
    );

    if (rows.length === 0) return res.json({ scheduledStart: null });

    res.json({ scheduledStart: rows[0].scheduled_start_at });
  } catch (err) {
    console.error("❌ Error in /api/latest-countdown:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// =====================================================
// 📊 GET DASHBOARD DATA
// =====================================================
app.get('/api/dashboard', async (req, res) => {

  try {

    // =================================================
    // 1. ACTIVE QUIZZES
    // =================================================
    const [activeQuizRows] = await db.execute(`
      SELECT COUNT(*) AS total
      FROM games
      WHERE LOWER(status) IN ('active', 'live')
    `);


    // =================================================
    // 2. TOTAL TEAMS
    // =================================================
    const [teamRows] = await db.execute(`
      SELECT COUNT(*) AS total
      FROM teams
      WHERE is_active = 1
    `);


    // =================================================
    // 3. LIVE LOCATIONS
    // =================================================
    const [locationRows] = await db.execute(`
      SELECT COUNT(DISTINCT TRIM(location)) AS total
      FROM games
      WHERE LOWER(status) IN ('active', 'live')
        AND location IS NOT NULL
        AND TRIM(location) <> ''
    `);


    // =================================================
    // 4. TOTAL QUIZ SESSIONS
    // =================================================
    const [sessionRows] = await db.execute(`
      SELECT COUNT(*) AS total
      FROM sessions
    `);


    // =================================================
    // 5. RECENT GAMES + TEAM COUNT
    // =================================================
    const [recentGames] = await db.execute(`
      SELECT
        g.id,
        g.auto_id,
        g.status,
        g.created_at,
        g.day,
        g.location,
        g.scheduled_start_at,

        COUNT(t.id) AS team_count

      FROM games g

      LEFT JOIN teams t
        ON t.quiz_id = g.auto_id

      GROUP BY
        g.id,
        g.auto_id,
        g.status,
        g.created_at,
        g.day,
        g.location,
        g.scheduled_start_at

      ORDER BY g.created_at DESC

      LIMIT 10
    `);


    // =================================================
    // 6. RESPONSE
    // =================================================
    res.json({

      success: true,

      stats: {

        activeQuizzes:
          Number(activeQuizRows[0]?.total || 0),

        totalTeams:
          Number(teamRows[0]?.total || 0),

        liveLocations:
          Number(locationRows[0]?.total || 0),

        totalSessions:
          Number(sessionRows[0]?.total || 0)

      },

      recentQuizzes: recentGames.map(game => ({

        id: game.id,

        auto_id: game.auto_id,

        status: game.status,

        created_at: game.created_at,

        day: game.day,

        location: game.location,

        scheduled_start_at:
          game.scheduled_start_at,

        teamCount:
          Number(game.team_count || 0)

      }))

    });

  } catch (err) {

    console.error(
      '❌ Error fetching dashboard data:',
      err
    );

    res.status(500).json({

      success: false,

      message:
        'Failed to fetch dashboard data',

      error:
        err.message

    });

  }

});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Socket.IO bridge running on http://localhost:${PORT}`);
});
