// socket-bridge/server.js
const express = require('express');
const http = require('http');
const path = require('path');
const mysql = require('mysql2/promise');
const { Server } = require('socket.io');
const cors = require('cors');
const { randomUUID } = require('crypto');
const gameRounds = {}; 

const PORT = 8080;
const ALLOWED_ORIGINS = [
  'http://localhost:4001',
  'http://localhost:8080',
  'http://localhost:3000'
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
  methods: ['GET', 'POST']
}));

// ✅ Serve static files (so /gigz.html works)
app.use(express.static(path.join(__dirname, 'public')));

// Simple healthcheck route
app.get('/', (req, res) => res.send('✅ Socket bridge running'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST']
  }
});

function verifyToken(token) {
  return token && token === CONTROLLER_SECRET;
}

// 🧠 Global variable to store the latest active Game ID
let latestGameId = null;

// ✅ API to set the latest active game ID
app.post('/api/set-latest-game-id', express.json(), (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  latestGameId = id;
  console.log('🔗 Latest Game ID updated to:', id);

  // 🔁 Broadcast to all connected controllers
  io.emit('latest-game-id-updated', { id });

  res.json({ success: true, id });
});

// ✅ Optional: endpoint for controller to check current active game
app.get('/api/get-latest-game-id', (req, res) => {
  res.json({ id: latestGameId });
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
  const { role, gameId } = socket.handshake.auth || {};
  console.log(`🟢 New client connected: ${socket.id} (${role || "unknown"})`);

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
    io.to(room).emit("controller:selected_quiz", { gameId });
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
socket.on("controller:selected_quiz", ({ gameId }) => {
  console.log("🎯 [controller] selected quiz:", gameId);

  if (!gameId) {
    console.warn("⚠️ Missing gameId in controller:selected_quiz");
    return;
  }

  const roomName = `game:${gameId}`;

  // ✅ Send to the specific game room
  io.to(roomName).emit("controller:selected_quiz", { gameId });

  // 🌐 Also broadcast globally (backup for any client not yet in room)
  io.emit("controller:selected_quiz_global", { gameId });

  console.log(`📢 Broadcasted controller:selected_quiz to room: ${roomName} + global`);
});

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
  const { gameId, scheduledStart } = req.body;
  if (!gameId) return res.status(400).json({ error: "Missing gameId" });

  global.activeGame = {
    gameId,
    scheduledStart: scheduledStart || new Date().toISOString(),
    started: false
  };

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


server.listen(PORT, () => {
  console.log(`🚀 Socket.IO bridge running on http://localhost:${PORT}`);
});
