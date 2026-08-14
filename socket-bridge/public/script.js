let socket;
window.currentGameId = null;
// ✅ Ensure global scope setup
window.teams = window.teams || [];
console.log("🌍 Global teams array initialized:", window.teams);
// Tracks if the round is fully scored and locked
window.nextEnabledByPage = {};
window.roundScores = window.roundScores || {};    // { roundIndex: { teamId: boolean } }
window.currentRoundIndex = window.currentRoundIndex || 1;
window.canProceed = false; // ✅ replaces canProceedRef
window.socketBridge = io("http://192.168.1.77:8080"); // global socket to communicate game ID updates

window.roundLocked = window.roundLocked || {};
window.lastLockedRound = -1;
window.currentRoundIndex = 0;

// === DOM Elements ===
const saveScoresBtn = document.getElementById("saveScores");
const resetScoresBtn = document.getElementById("resetScores");
const teamElements = document.querySelectorAll('#scoreboard .team');
const addTeamBtn = document.getElementById("addTeamBtn");
const addTeamModal = document.getElementById("addTeamModal");
const closeBtn = document.querySelector(".close");
const cancelTeamBtn = document.getElementById("cancelTeamBtn");
const connectBtn = document.getElementById("connectBtn");
let nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const skipBtn = document.getElementById("skipBtn");
const endBtn = document.getElementById("endBtn");
let currentPageType = null;

// === NAVIGATION ===
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const LOCKED_PAGES = ["question"];
const roundIndex = window.currentRoundIndex;
const questionIndex = 0; // or whatever makes sense in your system
const correct = true; // marking as scored


// navItems.forEach(item => {
//   item.addEventListener('click', e => {
//     e.preventDefault();
//     const targetId = item.getAttribute('data-target');
//     pages.forEach(p => p.classList.remove('active'));
//     document.getElementById(targetId).classList.add('active');
//   });
// });

// ===============================
// 📌 Load saved answers for a team & round
// ===============================
async function loadTeamRoundAnswers(teamId, roundIndex) {
  try {
    const res = await fetch(`/api/team-answers/${teamId}/${roundIndex}`);
    const data = await res.json();
    return data.answers || {};  
  } catch (e) {
    console.error("Failed to load answers:", e);
    return {};
  }
}

// ===============================
// 🛠 Initialize round scores safely
// ===============================
function initRoundScores(roundIndex) {
  if (!window.roundScores[roundIndex]) {
    window.roundScores[roundIndex] = {};
    window.teams.forEach(team => {
      window.roundScores[roundIndex][team.id] = false; // initially not scored
    });
  }
}

// ===============================
// 🏆 SCORING MODAL LOGIC
// ===============================
let currentRoundIndex = 0;
let currentScoringTeam = null;

// Open the scoring modal
function openScoringModal(team) {
  currentScoringTeam = team;

  const modal = document.getElementById("scoringModal");
  const teamNameEl = document.getElementById("scoringTeamName");
  const questionsList = document.getElementById("questionsList");

  // Clear previous content
  teamNameEl.innerHTML = `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    ">
      <span>${team.scored ? `Edit Score: ${team.name}` : `Scoring: ${team.name}`}</span>
      <button id="teamLeftBtn">Team Left</button>
    </div>
  `;
  questionsList.innerHTML = "";
  
    // ✅ Attach listener immediately to the new button
const teamLeftBtn = document.getElementById("teamLeftBtn");

if (teamLeftBtn) {
  teamLeftBtn.onclick = async () => {
    if (!currentScoringTeam) return;

    const team = window.teams.find(t => t.id === currentScoringTeam.id);
    if (!team) return;

    if (!confirm(`Mark team "${team.name}" as LEFT?`)) return;

    // ✅ Use same DELETE logic
    markTeamLeft(team);

    console.log(`Team "${team.name}" marked as LEFT and removed`);
  };
}

  const roundQuestions = ["Question 1", "Question 2", "Question 3"];
  const roundIndex = currentRoundIndex; // Always use current round

  if (team.score === undefined) team.score = 0;

  // Score display
  const scoreDisplay = document.createElement("div");
  scoreDisplay.className = "team-score";
  scoreDisplay.innerHTML = `Score: <span class="score">${team.score}</span>`;
  questionsList.appendChild(scoreDisplay);

  // Increment score helper
  const updateScore = async (delta) => {
    team.score += delta;
    if (team.score < 0) team.score = 0;
    scoreDisplay.querySelector(".score").innerText = team.score;

    await updateTeamScore(team.id, team.score);
    broadcastScore(team);
  };

  // Load previous answers for this round only
  loadTeamRoundAnswers(team.id, roundIndex).then((savedAnswers) => {
    roundQuestions.forEach((qText, index) => {
      const item = document.createElement("div");
      item.className = "question-item";

      item.innerHTML = `
        <span>${qText}</span>
        <button class="mark correct">✔</button>
        <button class="mark incorrect">✖</button>
      `;

      const correctBtn = item.querySelector(".correct");
      const wrongBtn = item.querySelector(".incorrect");

      correctBtn.disabled = false;
      wrongBtn.disabled = false;

      // Highlight previous selection if any
      if (savedAnswers[index] !== undefined) {
        if (savedAnswers[index] === true) correctBtn.classList.add("selected");
        else wrongBtn.classList.add("selected");
      }

      // ✅ Correct button click
      correctBtn.onclick = async () => {
        correctBtn.classList.add("selected");
        wrongBtn.classList.remove("selected");

        await updateScore(1); // increment score
        await saveTeamAnswer(team.id, roundIndex, index, true); // pass roundIndex
        renderTeams();
      };

      // ✅ Incorrect button click
      wrongBtn.onclick = async () => {
        wrongBtn.classList.add("selected");
        correctBtn.classList.remove("selected");

        await saveTeamAnswer(team.id, roundIndex, index, false); // pass roundIndex
        renderTeams();
      };

      questionsList.appendChild(item);
    });
  });

  // ------------------------------
  // When modal closes, mark team scored
  // ------------------------------
  const closeModal = () => {
    modal.classList.remove("show");

    // ✅ Only mark scored if not already scored
    if (!team.scored) {
      markTeamScored(team.id);
    }

    currentScoringTeam = null;
  };

  // Attach close handlers (assuming you have a close button)
  const closeBtn = modal.querySelector(".close-modal");
  if (closeBtn) closeBtn.onclick = closeModal;

  // Optional: close on overlay click
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  modal.classList.add("show");
}


// ------------------------------
// Initialize round properly
// ------------------------------
function initializeRound(roundIndex) {
  window.currentRoundIndex = roundIndex;
  window.roundLocked[roundIndex] = false;

  window.roundScores[roundIndex] = {};
  window.teams.forEach(t => window.roundScores[roundIndex][t.id] = false);

  updateNextBtnState();
}

// ------------------------------
// Listen to page change
// ------------------------------
// ✅ Socket handlers just update pageType
socket?.on("display:page_type", ({ pageType }) => {
  window.currentPageType = pageType;
  updateNextBtnState();
});

// ===============================
// 🏆 HANDLE TEAM SCORING
// ===============================
async function saveTeamAnswer(teamId, questionIndex, correct) {
  try {
    const roundIndex = window.currentRoundIndex;

    // POST answer to backend
    const res = await fetch("/api/team-answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: teamId, round_index: roundIndex, question_index: questionIndex, correct })
    });
    const data = await res.json();
    if (!data.success) return console.error("❌ Failed to save answer");

    // Load all answers for this team in this round
    const answers = await loadTeamRoundAnswers(teamId, roundIndex);

    // Mark team scored if all questions answered
    const totalQuestions = 3; // or dynamically
    if (Object.keys(answers).length === totalQuestions) {
      markTeamScored(teamId);
    }
  } catch (err) {
    console.error("❌ SaveTeamAnswer error:", err);
  }
}


// Broadcast the updated score to other clients
function broadcastScore(team) {
  const gameId = localStorage.getItem("currentGameId");
  const roundIndex = window.currentRoundIndex;

  if (socket && socket.connected) {
    socket.emit("controller:update_score", {
      gameId,
      roundIndex,
      scores: { [team.id]: true } // track as boolean
    });

    console.log(`📡 Broadcasted scored for ${team.name} | Round ${roundIndex}`);
  }
}

async function updateTeamScore(teamId, score) {
  try {
    const res = await fetch(`/api/teams/${teamId}/score`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: Number(score) })
    });

    const data = await res.json();
    if (!res.ok || !data?.success) {
      console.error("Failed to update score:", data);
      return null;
    }

    return data.team;
  } catch (err) {
    console.error("Network error updating score:", err);
    return null;
  }
}

function isCurrentRoundScored() {
  const round = window.roundScores[window.currentRoundIndex];
  if (!round) return false;
  return Object.values(round).every(v => v === true);
}

// === FETCH & CONNECT CONTROLLER ===
async function fetchLatestGameId() {
  try {
    const res = await fetch("http://192.168.1.77:8080/api/get-latest-game-id");
    if (!res.ok) throw new Error("No latest game found.");
    const data = await res.json();
    console.log("✅ Latest Game ID:", data.id);
    localStorage.setItem("currentGameId", data.id);
    return data.id;
  } catch {
    console.warn("⚠️ No Game ID yet.");
    return null;
  }
}

async function connectController(gameId) {
  const token = "secret123";
  console.log("🎮 Connecting controller:", gameId);

  // 1️⃣ Notify the bridge about the latest game
  await fetch("http://192.168.1.77:8080/api/set-latest-game-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: gameId })
  });

  // 2️⃣ Connect the controller socket
  socket = io("http://192.168.1.77:8080", {
    auth: { role: "controller", token, gameId }
  });

socket.on("connect", () => {
  console.log("✅ Controller connected:", socket.id);
  socket.emit("joinRoom", { gameId }); // join the same game room
});

// Listener for page updates
socket.on("display:page_type", ({ pageType }) => {
  console.log("📡 Controller received page type:", pageType);

  window.currentPageType = pageType;

  // Optional: keep PAGE_FLOW index in sync
  const index = PAGE_FLOW.indexOf(pageType);
  if (index !== -1) {
    resetTeamCards();
    currentPageIndex = index;
  }

  updateNextBtnState();
});

socket.on("quiz:all-teams-scored", ({ roundIndex }) => {
  console.log("📡 Controller received all-teams-scored for round", roundIndex);

  // Update local state so Next button is enabled
  window.roundLocked[roundIndex] = false; // Unlock this round in Controller
  updateNextBtnState();
});

  socket.on("disconnect", () => console.log("🔌 Controller disconnected"));
  socket.on("error", err => console.error("❌ Socket error:", err));;

    // ✅ Listen for page type from React display
// Whenever page type changes

  // 3️⃣ Listen for game ID updates from the bridge
socket.on("latest-game-id-updated", ({ id }) => {
  console.log("🔄 Controller received new Game ID:", id);
  window.currentGameId = id;
  localStorage.setItem("currentGameId", id);

  // Update UI
  const display = document.getElementById("currentGameId");
  if (display) display.textContent = id;

  const input = document.getElementById("gameIdInput");
  if (input) input.value = id;

  // 🧩 Automatically connect to the new Game Room
  console.log("🔗 Auto-joining new game room:", id);
  socket.emit("joinRoom", { gameId: id });

  // 🧠 Optionally tell the server the controller is now controlling this game
  socket.emit("controller:update_game_id", { gameId: id });
});

}

// === SELECT QUIZ FROM CONTROLLER ===
function selectQuizFromController(gameId) {
    if (socket && socket.connected) {
        socket.emit("controller:selected_quiz", { gameId });
        console.log("📡 Selected quiz broadcasted to quizzes_tab:", gameId);
    }
}

function onControllerQuizClick(gameId) {
  console.log("🎯 Controller clicked quiz:", gameId);
  
  // Notify quizzes tab via socket
  if (socket && socket.connected) {
    socket.emit("controller:selected_quiz", { gameId });
    console.log("📡 Sent 'controller:selected_quiz' to quizzes tab:", gameId);
  } else {
    console.warn("⚠️ Controller not connected to socket!");
  }
}


// === MANUAL CONNECT & CONTROLLER BUTTONS ===
connectBtn?.addEventListener("click", () => {
  const gameId = document.getElementById("gameIdInput").value.trim();
  if (!gameId) return alert("Enter a Game ID first!");
  localStorage.setItem("currentGameId", gameId);
  connectController(gameId);
});


prevBtn?.addEventListener("click", () => socket?.emit("controller:prev", { at: Date.now() }) || alert("Connect first!"));
skipBtn?.addEventListener("click", () => socket?.emit("controller:skip", { at: Date.now() }) || alert("Connect first!"));
endBtn?.addEventListener("click", () => socket?.emit("controller:end", { at: Date.now() }) || alert("Connect first!"));

// nextBtn.disabled = true;

// ===============================
// 🔹 PRE-GAME PAGES (before Round 1)
// ===============================
const PRE_GAME_PAGES = ["rules", "section", "round-intro"];
const ANSWER_PAGES = ["answer-intro", "reveal-answer-1", "reveal-answer-2", "reveal-answer-3"];

// ===============================
// 🔹 PAGE FLOW CONFIGURATION
// ===============================
const PAGE_FLOW = [
  "rules",
  "section",
  "round-intro",
  "question",
  "answer-intro",
  "reveal-answer-1",
  "reveal-answer-2",
  "reveal-answer-3"
];

const enablePages = [
  "rules",
  "section",
  "round-intro",
  "answer-intro",
  "reveal-answer-1",
  "reveal-answer-2",
  "reveal-answer-3"
];

// ===============================
// 🔹 INITIAL PAGE & STATE
// ===============================
let currentPageIndex = 0;
window.currentPageType = PAGE_FLOW[currentPageIndex];
window.currentRoundIndex = 0; // make sure this exists
window.teams = window.teams || [];
window.roundScores = window.roundScores || {};

// Next enabled by default for non-question pages
updateNextBtnState();

// ===============================
// ✅ GET OR REFRESH NEXT BUTTON
// ===============================
function getNextBtn() {
  return document.getElementById("nextBtn") || document.querySelector(".fixed-next-button");
}

function isLastRound() {
  const totalRounds = window._allRounds?.length || 0;
  return window.currentRoundIndex === totalRounds - 1;
}

function updateNextBtnState(canProceedParam) {
  const nextBtn = getNextBtn();
  if (!nextBtn) return;

  const pageType = window.currentPageType;
  const canProceed = canProceedParam ?? window.canProceed ?? false;

  let enable = false;

  if (["intro", "rules", "section", "round-intro", "answer-intro", "scoreboard"]
      .includes(pageType)) {
    enable = true;
  }

  if (pageType === "question" || pageType.startsWith("reveal-answer")) {
    enable = canProceed;

    // 🏁 Special label for Round 15, last answer revealed
    if (window.currentRoundIndex === 14) { // 0-indexed, Round 15
      const lastRevealPage = "reveal-answer-3"; // last answer page
      if (pageType === lastRevealPage && enable) {
        nextBtn.textContent = "Show Final Results 🏆";
      } else {
        nextBtn.textContent = "Next ➡️";
      }
    } else {
      nextBtn.textContent = "Next ➡️";
    }
  }

  nextBtn.disabled = !enable;
  nextBtn.style.opacity = enable ? "1" : "0.5";

  console.log(
    `➡️ Next button: ${enable ? "ENABLED" : "DISABLED"} |`,
    `Round ${window.currentRoundIndex + 1}`,
    `Page: ${pageType}`
  );
}

// ------------------------------
// Go to next page
// ------------------------------
function goToNextPage() {
  const nextBtn = getNextBtn();
  if (!nextBtn || nextBtn.disabled) return;

  const currentPage = window.currentPageType;

  // If we're on question page, prepare next round after answer-intro
  if (currentPage === "question") {
    console.log("📡 Moving from question page to answer-intro...");
  }

  // Move to next page in PAGE_FLOW
  const nextIndex = PAGE_FLOW.indexOf(currentPage) + 1;
  if (nextIndex < PAGE_FLOW.length) {
    window.currentPageType = PAGE_FLOW[nextIndex];
    console.log("➡️ Navigated to page:", window.currentPageType);
  }

  // Reset team cards only when moving to a new round's question page
  if (PAGE_FLOW[nextIndex] === "question") {
    currentRoundIndex++;
    resetTeamCards();
  }

  updateNextBtnState();
}

// ===============================
// 🔹 REMOVE TEAM HANDLER
// ===============================
async function removeTeam(teamId) {
  const team = window.teams.find(t => t.id === teamId);
  if (!team) return;

  try {
    // Delete team from database
    const response = await fetch(`/api/teams/${teamId}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to delete team");
    }

    // Remove team from frontend array
    window.teams = window.teams.filter(t => t.id !== teamId);

    console.log("🗑️ Team removed:", team.name);

    // Refresh Next button state
    updateNextBtnState();

    // Re-render teams in DOM
    renderTeams();

  } catch (err) {
    console.error("❌ Error removing team:", err);
    alert(`Failed to remove team "${team.name}".`);
  }
}

// === POPULATE QUIZ LIST IN CONTROLLER APP ===
async function populateQuizList() {
  try {
    const response = await fetch('http://192.168.1.77:4001/api/quizzes');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    let quizzes = await response.json();

    // Sort newest first
    quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const quizList = document.getElementById('quizList');
    quizList.innerHTML = '';

    if (!Array.isArray(quizzes) || !quizzes.length) {
      quizList.innerHTML = '<p style="color:#bbb;">No quizzes found.</p>';
      return;
    }

    quizzes.forEach(q => {
      const title = q.location || q.title || `Quiz #${q.game_id || 'N/A'}`;
      const createdAt = q.created_at ? new Date(q.created_at).toLocaleString() : 'Unknown';
      const status = q.status || 'Inactive';
      const normalizedStatus = status.toLowerCase();

      const isFinished = normalizedStatus === 'finished';
      const isActive = normalizedStatus === 'active';

      const div = document.createElement('div');
      div.className = 'quiz-item';
      div.dataset.id = q.game_id;

      div.style = `
        border: 1px solid #555;
        padding: 10px;
        margin-bottom: 8px;
        cursor: ${isFinished ? 'not-allowed' : 'pointer'};
        border-radius: 6px;
        background: linear-gradient(90deg, #6a1b9a, #8e24aa);
        color: #fff;
        transition: background 0.2s;
        opacity: ${isActive ? 1 : 0.5};
      `;

      div.innerHTML = `
        <strong>📍 ${title}</strong><br>
        <small>Created: ${createdAt} | Status: ${isFinished ? 'Finished' : status}</small>
      `;

      div.addEventListener('click', async () => {

        if (isFinished) {
          console.log(`🛑 Quiz ${q.game_id} is finished and cannot be reused automatically.`);

          alert(
            "This quiz has already been completed and is currently unavailable for reuse."
          );

          return;
        }
        
        const quizId = q.game_id;
        if (!quizId) return alert("Invalid quiz selected.");
        console.log("🎮 Activating quiz:", quizId);

        try {
          // Activate the quiz
          const activeGameId = await handleQuizActivation(quizId);

          // Ensure DOM updates are applied before binding buttons
          requestAnimationFrame(() => {
            // Join socket room
            if (socket && socket.connected) {
              // socket.emit("joinRoom", { gameId: activeGameId });
              // socket.emit("controller:selected_quiz", { gameId: activeGameId });
              console.log("📡 Controller joined and notified room:", activeGameId);
            }

            // Rebind control buttons to the active socket
            // bindControlButtons(socket);
            console.log("✅ Buttons fully active for newly created quiz:", activeGameId);
          });

        } catch (err) {
          console.error("❌ Failed to activate quiz:", err);
        }
      });

      div.addEventListener('mouseover', () => div.style.background = 'rgba(255,255,255,0.2)');
      // div.addEventListener('mouseout', () => div.style.background = 'rgba(255,255,255,0.08)');
      quizList.appendChild(div);
    });

  } catch (err) {
    console.error('❌ Failed to load quizzes:', err);
    document.getElementById('quizList').innerHTML =
      `<p style="color:red;">Failed to load quizzes. Make sure server is running at http://192.168.1.77:4001</p>`;
  }
}

// === ACTIVATE QUIZ & UPDATE CONTROLLER ===
let lastActivatedGameId = null;
async function handleQuizActivation(quizId) {
  if (quizId === lastActivatedGameId) return quizId; // skip duplicates
  lastActivatedGameId = quizId;

  try {
    if (!quizId) throw new Error("Invalid quizId");

    const res = await fetch(`http://192.168.1.77:4001/api/quiz/${quizId}/activate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) throw new Error(`Activation failed: ${res.status}`);
    const data = await res.json();

    const gameIdFromServer = data.game?.id || data.game?.game_id || data.id || data.game_id;
    if (!gameIdFromServer) throw new Error("Server did not return a valid Game ID");

    // Update controller state
    window.currentGameId = gameIdFromServer;
    localStorage.setItem("currentGameId", window.currentGameId);


    // =============================================
   // UPDATE ACTIVE GAME ON CONTROLLER SERVER
  // =============================================
    await fetch("http://192.168.1.77:8080/api/set-active-game", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            gameId: gameIdFromServer
        })
    });

    console.log("✅ Active game updated on Controller:", gameIdFromServer);

    // Highlight active quiz card
    document.querySelectorAll('.quiz-item').forEach(card => {
      if (card.dataset.id == quizId) {
        card.style.opacity = 1;
        card.innerHTML = card.innerHTML.replace(/Status: .+<\/small>/, 'Status: Active</small>');
      } else {
        card.style.opacity = 0.5;
      }
    });

    // Join socket room automatically if socket exists
// Join socket room automatically if socket exists
  if (socket && socket.connected) {
    // Always join the room
    socket.emit("joinRoom", { gameId: window.currentGameId });

    // Emit controller:selected_quiz regardless — needed for both laptop and SBC
    socket.emit("controller:selected_quiz", { gameId: window.currentGameId });

    // Update lastActivatedGameId after sending event
    lastActivatedGameId = window.currentGameId;

    // Optional: notify other listeners
    socket.emit("latest-game-id-updated", { id: window.currentGameId });
    console.log("📡 Notified quizzes app of selected quiz:", window.currentGameId);
  }

    return window.currentGameId;
  } catch (err) {
    console.error("❌ Failed to activate quiz:", err);
    alert(`Failed to activate quiz. Check console.\nError: ${err.message}`);
    throw err;
  }
}


// 🎯 Listen for active quiz updates from Controller App
// const socketBridge = io("http://localhost:8080");

// 🎯 Listen for active quiz updates from bridge (use the same socket)
// if (typeof socket !== "undefined") {
//   socket.on("latest-game-id-updated", async ({ id }) => {
//     console.log("🎮 Active quiz updated from Controller:", id);

//     if (id && window.currentGameId !== id) {
//       window.currentGameId = id;
//       await loadQuizById(id);
//     }
//   });
// }

// === INIT ON PAGE LOAD ===
document.addEventListener("DOMContentLoaded", async () => {
  populateQuizList();

  let gameId = localStorage.getItem("currentGameId") || await fetchLatestGameId();
  const input = document.getElementById("gameIdInput");
  if (input) input.value = gameId || "";

  if (gameId) connectController(gameId);

  // Force Next enabled for pre-game pages
});

// controller.js
// Generate and Activate a New Quiz
/********* Helper: Convert Date to Local MySQL datetime string *********/
function toLocalDateTimeString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
         `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/********* Generate and Activate a New Quiz *********/
async function generateNewQuiz() {
  try {
    console.log("🚀 Creating + Activating new quiz...");

    // 1️⃣ Collect form values
const day = document.getElementById("day")?.value?.trim();
const location = document.getElementById("quizLocation")?.value?.trim();

// ❗ Hard check — STOP if missing
if (!day) {
  alert("Please select a DAY before starting the quiz.");
  return;
}

if (!location) {
  alert("Please select a LOCATION before starting the quiz.");
  return;
}

    const teamAScore = parseInt(document.getElementById("teamAScore")?.value) || 0;
    const teamBScore = parseInt(document.getElementById("teamBScore")?.value) || 0;
    const teamCScore = parseInt(document.getElementById("teamCScore")?.value) || 0;

    if (!day) {
      alert("Please select a quiz day.");
      return;
    }

    // 2️⃣ Handle scheduled start time (local)
    let scheduledStartInput = document.getElementById("scheduledStart")?.value; // yyyy-mm-ddThh:mm
    let scheduledStart;

    if (scheduledStartInput) {
      scheduledStart = scheduledStartInput.replace("T", " ") + ":00";

      // Build correct "day" datetime using selected date + scheduled time
      const timePart = scheduledStartInput.split("T")[1] || "00:00";
      day = `${day} ${timePart}:00`;
    } else {
      // No start time → use 00:00:00
      scheduledStart = `${day} 00:00:00`;
      day = `${day} 00:00:00`;
    }

    // 3️⃣ Create new quiz
    const createRes = await fetch("http://192.168.1.77:4001/api/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day,
        location,
        scheduled_start_at: scheduledStart,
        team_a_score: teamAScore,
        team_b_score: teamBScore,
        team_c_score: teamCScore,
        rounds: []
      })
    });

    if (!createRes.ok) throw new Error("Failed to create quiz");
    const quiz = await createRes.json();
    const newGameId = quiz.gameId || quiz.id;
    if (!newGameId) throw new Error("Quiz ID missing from server");

    console.log("🎉 Quiz created:", newGameId);

    window.currentGameId = newGameId;
    localStorage.setItem("currentGameId", newGameId);

    const gameIdInput = document.getElementById("gameIdInput");
    if (gameIdInput) gameIdInput.value = newGameId;

    if (typeof populateQuizList === "function") {
      await populateQuizList();
    }

    await handleQuizActivation(newGameId);
    socket.emit("join_game_room", newGameId);

    socket.emit("controller:start_countdown", {
      gameId: newGameId,
      startTime: new Date(scheduledStart).getTime()
    });

    setTimeout(() => {
      const quizCard = document.querySelector(`.quiz-item[data-id='${newGameId}']`);
      if (quizCard) {
        quizCard.style.border = "3px solid #4caf50";
        quizCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);

    showQuizMessage("✅ Quiz created, activated & countdown started!");

    function showQuizMessage(msg) {
      const box = document.getElementById("quizMessage");
      box.textContent = msg;
      box.style.display = "block";
      setTimeout(() => (box.style.display = "none"), 4000);
    }

  } catch (err) {
    console.error("❌ Failed to generate/start quiz:", err);
    alert("Failed to generate/start quiz. Check console for details.");
  }
}

/********* Start Quiz Now (Controller App) *********/
document.getElementById("startNowBtn")?.addEventListener("click", async () => {
  try {
    console.log("🚀 Start Quiz Now button clicked");

    // 1️⃣ Collect form values (Controller App doesn't have day/location)
    const teamAScore = Number(document.getElementById("teamAScore")?.value) || 0;
    const teamBScore = Number(document.getElementById("teamBScore")?.value) || 0;
    const teamCScore = Number(document.getElementById("teamCScore")?.value) || 0;

    // 2️⃣ Handle scheduled start time
    const scheduledStartInput = document.getElementById("scheduledStart")?.value;
    const scheduledStart = scheduledStartInput
      ? `${scheduledStartInput.replace("T", " ")}:00`
      : new Date().toISOString().slice(0, 19).replace("T", " ");

    // 3️⃣ Create NEW game instance with placeholders
    const gameRes = await fetch("http://192.168.1.77:4001/api/game-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day: new Date().toISOString().slice(0, 19).replace("T", " "), // placeholder
        location: "TBA",                                                // placeholder
        scheduled_start_at: scheduledStart,
        team_a_score: teamAScore,
        team_b_score: teamBScore,
        team_c_score: teamCScore,
        status: "inactive"
      })
    });

    if (!gameRes.ok) throw new Error("Failed creating new game instance");

    const gameData = await gameRes.json();
    const newGameId = gameData?.id;
    if (!newGameId) throw new Error("Game ID missing after creation");
    console.log("🎯 New game created with ID:", newGameId);

    // 4️⃣ Map round DB IDs
    const roundIdMap = {};
    (gameData.rounds || []).forEach(r => roundIdMap[r.round_number] = r.id);

    // 5️⃣ Fetch all rounds
    const allRounds = [];
    for (let i = 1; i <= 15; i++) {
      if ([6, 12, 15].includes(i)) continue;
      const res = await fetch(`http://192.168.1.77:4001/api/rounds/${i}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.questions?.length) continue;
      allRounds.push({
        roundId: i,
        round_db_id: roundIdMap[i],
        title: `Round ${i}`,
        category: data.category || "General",
        questions: data.questions
      });
    }

    // 6️⃣ Music rounds (6 & 12)
    for (const musicRound of [6, 12]) {
      const musicRes = await fetch(`http://192.168.1.77:4001/api/music-round?round_type=${musicRound}`);
      if (!musicRes.ok) continue;
      const musicData = await musicRes.json();
      if (!musicData?.questions?.length) continue;
      allRounds.push({
        roundId: musicRound,
        round_db_id: roundIdMap[musicRound],
        title: `Round ${musicRound}`,
        category: "Music Round",
        questions: musicData.questions.map(q => ({
          questionText: q.text,
          correct_answer: q.correct_answer
        }))
      });
    }

    // 7️⃣ Family Feud
    const feudRes = await fetch("http://192.168.1.77:4001/api/round/feud");
    if (feudRes.ok) {
      const feudData = await feudRes.json();
      if (feudData?.question_text) {
        allRounds.push({
          roundId: 10,
          round_db_id: roundIdMap[10],
          title: "Round 10",
          category: "Family Feud",
          questions: [{
            questionText: feudData.question_text,
            answers: [feudData.answer1, feudData.answer2, feudData.answer3, feudData.answer4]
          }]
        });
      }
    }

    // 8️⃣ Movie round (15)
    const movieRes = await fetch("http://192.168.1.77:4001/api/movie-round");
    if (movieRes.ok) {
      const movieData = await movieRes.json();
      if (movieData?.questions?.length) {
        allRounds.push({
          roundId: 15,
          round_db_id: roundIdMap[15],
          title: "Round 15",
          category: "Name That Movie",
          questions: movieData.questions.map(q => ({
            questionText: q.question_text,
            correct_answer: q.correct_answer
          }))
        });
      }
    }

    // 9️⃣ Save quiz to quiz app
    const quizRes = await fetch("http://192.168.1.77:4001/api/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: newGameId,
        day: scheduledStart,  // save local start time as temporary
        location: "TBA",
        scheduled_start_at: scheduledStart,
        team_a_score: teamAScore,
        team_b_score: teamBScore,
        team_c_score: teamCScore,
        quiz_title: `Quiz ${newGameId}`,
        rounds: allRounds
      })
    });

    if (!quizRes.ok) throw new Error("Failed saving quiz");

    // 🔟 Activate quiz
    const activateRes = await fetch(`http://192.168.1.77:4001/api/quizzes/${newGameId}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (!activateRes.ok) throw new Error("Quiz activation failed");
    console.log("⚡ Quiz activated:", newGameId);

    // 1️⃣1️⃣ Update state & notify
    window.currentGameId = newGameId;
    localStorage.setItem("currentGameId", newGameId);
    const gameIdInput = document.getElementById("gameIdInput");
    if (gameIdInput) gameIdInput.value = newGameId;

    socket.emit("controller:update_game_id", { gameId: newGameId });
    socket.emit("quiz:start", { gameId: newGameId });

    // ✅ Switch Controller UI to Scoreboard
    showSection("scoreboard");

    // 1️⃣2️⃣ Store rounds globally + render table
    window._allRounds = allRounds;
    if (typeof renderQuizTableNoAnswers === "function") renderQuizTableNoAnswers(allRounds);

    // 1️⃣3️⃣ Highlight card, refresh list, start countdown
    setTimeout(async () => {
      const card = document.querySelector(`.quiz-card[data-id='${newGameId}']`);
      if (card) {
        card.style.border = "3px solid #4caf50";
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.click();
      }

      socket.emit("controller:reload_quizzes", { gameId: newGameId });
      socket.emit("controller:selected_quiz", { gameId: newGameId });
      socket.emit("latest-game-id-updated", { id: newGameId });
      socket.emit("controller:start_countdown", { gameId: newGameId, startTime: new Date(scheduledStart).getTime() });

      if (typeof populateQuizList === "function") await populateQuizList();
    }, 300);

    // ✅ Show success
    const box = document.getElementById("quizMessage");
    if (box) {
      box.textContent = "✅ New quiz generated! Quiz app will reload and activate automatically!";
      box.style.display = "block";
      setTimeout(() => (box.style.display = "none"), 4000);
    }

  } catch (err) {
    console.error("❌ Failed to generate and activate quiz:", err);
    alert("Failed to generate and activate quiz. Check console.");
  }
});

function showSection(sectionId) {
  document.querySelectorAll("section.page").forEach(sec => {
    sec.classList.remove("active");
    sec.style.display = "none";
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add("active");
    target.style.display = "block";
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    console.log("✅ Switched to section:", sectionId);
  }
}

// ===============================
// TEAM MANAGEMENT (QUIZ-BASED)
// ===============================
window.currentGameId = localStorage.getItem("currentGameId") || null;
window.teams = [];
console.log("✅ Team Management Loaded");

// ===============================
// 🔎 FETCH CURRENT GAME ID
// ===============================
async function fetchCurrentGameId() {
  if (window.currentGameId) return window.currentGameId;

  try {
    const res = await fetch("/api/get-latest-game-id");
    const data = await res.json();
    if (!data?.id) throw new Error("No active quiz");

    window.currentGameId = data.id;
    localStorage.setItem("currentGameId", data.id);
    return data.id;
  } catch (err) {
    console.error("❌ Failed to fetch current game:", err);
    // alert("No active quiz. Please create/start a quiz first.");
    return null;
  }
}

// ===============================
// 🧾 LOAD TEAMS FOR THIS GAME
// ===============================
async function loadTeams() {
  const gameId = window.currentGameId;
  if (!gameId) {
    window.teams = [];
    renderTeams();
    updateNextBtnState(PAGE_FLOW[currentPageIndex]);
    return;
  }

  try {
    const res = await fetch(`/api/teams?gameId=${gameId}`);
    const data = await res.json();

    window.teams = Array.isArray(data)
      ? data.map(t => ({
          id: t.id,
          name: t.team_name,
          score: t.score || 0,
          scored: false, // initialize scored
        }))
      : [];

    renderTeams();
    updateNextBtnState(PAGE_FLOW[currentPageIndex]); // ✅ update button
  } catch (err) {
    console.error("❌ Failed to load teams:", err);
    window.teams = [];
    renderTeams();
    updateNextBtnState(PAGE_FLOW[currentPageIndex]);
  }
}


// ===============================
// 💾 SAVE SINGLE ANSWER MARK
// ===============================
async function saveAnswerMark(teamId, questionId, correct) {
  try {
    await fetch("/api/round/score-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        gameId: window.currentGameId,
        answers: [{ questionId, correct }]
      })
    });
  } catch (err) {
    console.error("❌ Failed to save score:", err);
  }
}

// ------------------------------
// 🔹 RESET TEAM CARDS
// ------------------------------
function resetTeamCards() {
  console.log("🔹 Resetting all team cards for next round");

  window.teams.forEach(team => {
    // Reset only the scored flag, leave the left flag intact
    team.scored = false;

    const teamCard = document.querySelector(`.team-card[data-team-id='${team.id}']`);
    if (teamCard) {
      // Remove scored class only
      teamCard.classList.remove("scored");

      // If team is left, keep red, otherwise original color
      if (team.left) {
        teamCard.classList.add("team-left"); // red for left teams
      } else {
        teamCard.classList.remove("team-left");
      }
    }
  });

  // Reset roundScores for current round
  const roundIndex = currentRoundIndex;
  if (window.roundScores[roundIndex]) {
    Object.keys(window.roundScores[roundIndex]).forEach(teamId => {
      // Only reset scores for active teams
      const team = window.teams.find(t => t.id === parseInt(teamId));
      if (team && !team.left) {
        window.roundScores[roundIndex][teamId] = false;
      }
    });
  }

  // 🔹 Refresh Next button state
  updateNextBtnState();
}

/// ------------------------------
// Mark team as scored & refresh Next button
// ------------------------------
function markTeamScored(teamId, roundIndex) {
  const roundIdx = roundIndex != null ? roundIndex : window.currentRoundIndex;

  // Initialize roundScores
  window.roundScores = window.roundScores || {};
  if (!window.roundScores[roundIdx]) {
    window.roundScores[roundIdx] = {};
    window.teams.forEach(t => (window.roundScores[roundIdx][t.id] = false));
  }

  // Already scored? Do nothing
  if (window.roundScores[roundIdx][teamId]) return;

  // Mark this team as scored
  window.roundScores[roundIdx][teamId] = true;

  // Update local team object
  const team = window.teams.find(t => t.id === teamId);
  if (team) team.scored = true;

  // Store current round globally
  window.currentRoundIndex = roundIdx;

  // 🔹 Check if all teams scored
  const allTeamsScored =
  window.roundScores[roundIdx] &&
  window.teams
    .filter(t => !t.left) // 👈 ignore teams marked as Left
    .every(t => window.roundScores[roundIdx][t.id] === true);

  // Update global canProceed
  window.canProceed = allTeamsScored;

  // 🔹 Update Next button immediately
  updateNextBtnState(window.canProceed);

  // 🔓 Emit event if all teams scored
  if (allTeamsScored) {
    window.roundUnlocked = window.roundUnlocked || {};
    window.roundUnlocked[roundIdx] = true;

    if (socket && socket.connected) {
      socket.emit("quiz:all-teams-scored", { roundIndex: roundIdx, gameId: window.currentGameId });
      console.log(`🔓 All teams scored for round ${roundIdx} — notifying server`);
    }
  }
};


// ===============================
// 🔘 NEXT BUTTON HANDLER
// ===============================
// On page load
document.addEventListener("DOMContentLoaded", () => {
  const nextBtn = document.getElementById("nextBtn");
  window.finalRevealCount = 0; // 0 → 3


  const updateNextBtnState = () => {
    if (!nextBtn) return;

    const roundIndex = window.currentRoundIndex;
    const currentPage = window.currentPageType;

    let enableNext = false;

    switch (currentPage) {
      case "rules":
      case "section":
      case "round-intro":
      case "answer-intro":
        enableNext = true;
        break;

      case "question": {
        enableNext = false;

        if (!window.roundScores || !window.teams) break;

  const allTeamsScored =
        window.roundScores[roundIndex] &&
        window.teams
        .filter(t => !t.left) // 👈 ignore teams that left
        .every(t => window.roundScores[roundIndex][t.id] === true);

        // 🟢 NORMAL ROUNDS
        if (window.currentRoundType === "normal") {
          enableNext = allTeamsScored;
        }

        // 🟣 SPECIAL ROUNDS
        if (window.currentRoundType === "special") {
          enableNext = window.specialRoundUnlocked === true;
        }

        // 🏁 LAST ROUND → Show Top 3
        if (enableNext && isLastRound()) {
          nextBtn.textContent = "Show Top 3 Teams 🏆";
        } else {
          nextBtn.textContent = "Next ➡️";
        }

        break;
      }

      case "final-results": {
      enableNext = true;

      if (window.finalRevealCount < 3) {
        nextBtn.textContent = "Reveal Next 🏆";
      } else {
        nextBtn.textContent = "Continue ➡️";
      }
      break;
    }


      default:
        enableNext = false;
    }

    nextBtn.disabled = !enableNext;
    nextBtn.style.opacity = enableNext ? "1" : "0.5";

    console.log(
      `Next button is now ${enableNext ? "ENABLED ✅" : "DISABLED ⚠️"} for page: ${currentPage}, round: ${roundIndex}`
    );
  };

  // Initial check
  updateNextBtnState();

// Listen for Next button click
nextBtn.addEventListener("click", () => {
  if (nextBtn.disabled) return;

  const roundIndex = window.currentRoundIndex;
  const gameId = window.currentGameId;
  const currentPage = window.currentPageType;

  // 🏆 FINAL RESULTS – REVEAL FLOW
if (currentPage === "final-results") {
  if (window.finalRevealCount < 3) {
    window.finalRevealCount++;

    console.log(`🏆 Revealing winner ${window.finalRevealCount}`);
    socket?.emit("controller:next", { gameId });

    updateNextBtnState();
    return; // ⛔ no navigation yet
  }

  // All revealed → navigate
  console.log("🏁 Final reveal done, continuing");
  socket?.emit("controller:next", { gameId }); // or navigate event
  return;
}

  // 📡 NORMAL NEXT
  console.log(
    "📡 Next clicked on controller, emitting to quiz",
    { roundIndex, gameId, currentPage }
  );
  socket?.emit("controller:next", { roundIndex, gameId });
});

  // Update whenever a team is scored
  window.addEventListener("teamScored", updateNextBtnState);

  // 🔹 Server-side safety unlock
  socket.on("quiz:all-teams-scored", (data = {}) => {
    const roundIndex = data.roundIndex ?? window.currentRoundIndex;

    window.roundScores = window.roundScores || [];
    if (!window.roundScores[roundIndex]) window.roundScores[roundIndex] = {};

    window.teams.forEach(t => {
      window.roundScores[roundIndex][t.id] = true;
    });

    updateNextBtnState();
  });

  // Call this when moving to a new round
  window.goToRound = (roundIndex) => {
    window.currentRoundIndex = roundIndex;
    if (!window.roundScores[roundIndex]) {
      window.roundScores[roundIndex] = {};
      window.teams.forEach(t => window.roundScores[roundIndex][t.id] = false);
    }
    updateNextBtnState();
  };
});

function startRound(roundIndex) {
  window.currentRoundIndex = roundIndex;

  // Reset all cards for the new round
  resetTeamCards();

  renderTeams(); // re-render cards with fresh state
}

// 🔹 ATTACH SCORE BUTTON LISTENERS
document.querySelectorAll(".score-button").forEach(btn => {
  btn.addEventListener("click", e => {
    const teamId = e.target.dataset.teamId;
    markTeamScored(teamId);
  });
});

function renderTeams() {
  const teamList = document.getElementById("teamList");
  if (!teamList) return;

  // Clean leftover drag styles
  document.querySelectorAll(".team-card").forEach(card => {
    card.style.left = "";
    card.style.top = "";
    card.style.zIndex = "";
  });

  // Clear UI completely
  teamList.innerHTML = "";

  // Empty state
  if (!teams.length) {
    teamList.innerHTML = `<div class="empty">No teams yet.</div>`;
    return;
  }

  // Render cards
  teams.forEach(team => {
    const card = document.createElement("div");
    card.className = "team-card";
    card.dataset.teamId = team.id;

    // Restore drag position if exists
    if (team.x) card.style.left = team.x;
    if (team.y) card.style.top = team.y;


    card.classList.remove("team-left", "scored"); // reset

    // 🔹 Apply visual states conditionally
    if (team.left) {
      card.classList.add("team-left"); // red/grey if they left
    } else if (team.scored) {
      card.classList.add("scored");    // grey if scored
    }

    card.innerHTML = `
      <div class="team-header">
        <span>${team.name}</span>
      </div>
      <button class="remove-team-btn">🗑</button>
    `;

    // Attach scoring logic
    const scoreBtn = card.querySelector(".score-button");
    if (scoreBtn) {
    scoreBtn.addEventListener("click", () => {
      if (!team.scored) {
        // 🔹 Define the proper variables here
        const roundIndex = window.currentRoundIndex;
        const questionIndex = 0; // adjust if you track multiple questions per round
        const correct = true; // marking as scored

        // 🔹 Call saveTeamAnswer with correct team id
        saveTeamAnswer(team.id, roundIndex, questionIndex, correct);

        // Optional: mark visually
        team.scored = true;
        card.classList.add("scored");
      }
    });
    }

    enableDragging(card);
    teamList.appendChild(card);
  });
}

//Rejoin Team Function
function rejoinTeam(teamId) {
  const team = window.teams.find(t => t.id === teamId);
  if (!team) return;

  // ✅ Clear Left state
  team.left = false;

  // ✅ Allow them to be scored again
  team.scored = false;

  // 🔹 Update the card directly
  const card = document.querySelector(`.team-card[data-team-id='${team.id}']`);
  if (card) {
    card.classList.remove("team-left"); // remove red
    if (team.scored) {
      card.classList.add("scored");     // grey if scored
    } else {
      card.classList.remove("scored");  // remove grey if unscored
    }
  }

  // 🔹 Refresh Next button state
  updateNextBtnState();

  console.log(`Team "${team.name}" has rejoined`);
}

function showTop3Teams() {
  // Convert object → sortable array
  const sortedTeams = Object.entries(teamScores)
    .map(([team, score]) => ({ team, score }))
    .sort((a, b) => b.score - a.score);

  // Get top 3
  const top3 = sortedTeams.slice(0, 3);

  // Send to TV / display app
  sendTop3ToDisplay(top3);

  // Optional: lock further scoring
  scoringLocked = true;
}


// ===============================
// 📌 ENABLE DRAGGING + CLICK
// ===============================
function enableDragging(card) {
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let moved = false;
  let clickedDeleteButton = false;

  const startDrag = (clientX, clientY) => {
    dragging = true;
    moved = false;
    card.classList.add("dragging");

    offsetX = clientX - card.offsetLeft;
    offsetY = clientY - card.offsetTop;

    card.style.zIndex = "999";
  };

  const moveDrag = (clientX, clientY) => {
    if (!dragging) return;

    const newLeft = clientX - offsetX;
    const newTop = clientY - offsetY;

    if (
      !moved &&
      (Math.abs(newLeft - card.offsetLeft) > 3 ||
       Math.abs(newTop - card.offsetTop) > 3)
    ) {
      moved = true;
    }

    card.style.left = `${newLeft}px`;
    card.style.top = `${newTop}px`;
  };

  const endDrag = () => {
    if (!dragging) return;

    dragging = false;
    card.classList.remove("dragging");

    const teamId = parseInt(card.dataset.teamId);
    const team = window.teams.find(t => t.id === teamId);

    if (team) {
      team.x = card.style.left;
      team.y = card.style.top;
    }

    // ✅ Only trigger card click if:
    // - user didn't drag
    // - click did NOT originate from Delete button
    if (!moved && !clickedDeleteButton) {
      card.dispatchEvent(
        new CustomEvent("cardclick", { bubbles: true })
      );
    }

    // Reset for next interaction
    clickedDeleteButton = false;
  };

  // ===============================
  // 🖱️ Mouse Events
  // ===============================
  card.addEventListener("mousedown", (e) => {

    // Remember if click started on Delete button
    clickedDeleteButton = !!e.target.closest(".remove-team-btn");

    // Don't start dragging from Delete button
    if (clickedDeleteButton) return;

    startDrag(e.clientX, e.clientY);
  });

  document.addEventListener("mousemove", (e) => {
    moveDrag(e.clientX, e.clientY);
  });

  document.addEventListener("mouseup", endDrag);

  // ===============================
  // 📱 Touch Events
  // ===============================
  card.addEventListener("touchstart", (e) => {

    clickedDeleteButton = !!e.target.closest(".remove-team-btn");

    // Don't start dragging from Delete button
    if (clickedDeleteButton) return;

    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);

  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    if (!dragging) return;

    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);

  }, { passive: false });

  document.addEventListener("touchend", endDrag);
}

// ===============================
// MARK TEAM LEFT / Remove
// ===============================
async function markTeamLeft(team) {
  const roundIndex = window.currentRoundIndex;

  // 1. Mark team as left for this session
  team.left = true;

  // 2. Mark as resolved so Next button becomes clickable
  if (!window.roundScores[roundIndex]) {
    window.roundScores[roundIndex] = {};
  }

  // Treat as already "handled" for scoring logic
  window.roundScores[roundIndex][team.id] = true;

  // 3. Prevent further scoring
  team.scored = true;

  // 4. Re-render UI (team stays visible but greyed out)
  renderTeams();

  // 5. Update Next button state immediately
  updateNextBtnState();

  console.log(`Team "${team.name}" marked as LEFT (soft remove)`);
}

// ===============================
// 📌 SETUP CLICK HANDLING ON TEAM CARDS
// ===============================
function setupTeamCardClicks() {
  const teamList = document.getElementById("teamList");

  // Listen for our custom 'cardclick' event instead of normal click
  teamList.addEventListener("cardclick", async (e) => {
    const card = e.target.closest(".team-card");
    if (!card) return;

    const teamId = parseInt(card.dataset.teamId);
    const team = window.teams.find(t => Number(t.id) === Number(teamId));
    if (!team) return;

    // Open scoring modal
    window.currentScoringTeam = team;
    openScoringModal(team);

  });
  
    // ===============================
    // 🔹 TEAM LEFT HANDLER
    // ===============================
const teamLeftBtn = document.getElementById("teamLeftBtn");

if (teamLeftBtn) {
  teamLeftBtn.onclick = () => {
    if (!currentScoringTeam) return;

    if (!confirm(`Mark team "${currentScoringTeam.name}" as LEFT?`)) return;

    // Soft mark as left
    markTeamLeft(currentScoringTeam.id);
  };
}

  // Listen for normal clicks for remove buttons
teamList.addEventListener("click", async (e) => {
  const card = e.target.closest(".team-card");
  if (!card) return;

  const teamId = parseInt(card.dataset.teamId);
  const team = window.teams.find(t => t.id === teamId);
  if (!team) return;

  if (e.target.classList.contains("remove-team-btn")) {
    if (!confirm(`Remove team "${team.name}"?`)) return;

    await removeTeam(teamId);
    return;
  }
});
}

// ===============================
// ➕ INIT TEAMS
// ===============================
async function initTeams() {
  const addTeamBtn = document.getElementById("addTeamBtn");
  const saveTeamBtn = document.getElementById("saveTeamBtn");
  const cancelTeamBtn = document.getElementById("cancelTeamBtn");
  const addTeamModal = document.getElementById("addTeamModal");
  const addTeamClose = addTeamModal.querySelector(".close");

  // Open Add Team Modal
  addTeamBtn.addEventListener("click", async () => {
    const gameId = await fetchCurrentGameId();
    if (!gameId) return;

    window.currentGameId = gameId;
    localStorage.setItem("currentGameId", gameId);

    addTeamModal.classList.add("show");
    document.getElementById("newTeamName").value = "";
    document.getElementById("newTeamName").focus();
  });

  // Close Add Team Modal
  const closeAddTeamModal = () => addTeamModal.classList.remove("show");
  cancelTeamBtn.addEventListener("click", closeAddTeamModal);
  addTeamClose.addEventListener("click", closeAddTeamModal);
  window.addEventListener("click", e => {
    if (e.target === addTeamModal) closeAddTeamModal();
  });

  // Save team
  saveTeamBtn.addEventListener("click", async () => {
    const name = document.getElementById("newTeamName").value.trim();
    if (!name) return alert("Enter a team name.");

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_name: name, gameId: window.currentGameId })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || "Unknown error");

      window.teams.push({ id: result.id, name, score: 0, scored: false });
      renderTeams();
      closeAddTeamModal();
    } catch (err) {
      console.error("❌ Failed to save team:", err);
      alert("Failed to save team. See console for details.");
    }
  });

  // Load teams and attach click handling
  await fetchCurrentGameId();
  await loadTeams();
  setupTeamCardClicks();

// Scoring modal close
const scoringModalEl = document.getElementById("scoringModal");
const scoringCloseBtn = scoringModalEl.querySelector(".close");

scoringCloseBtn.addEventListener("click", () => {
  const team = window.currentScoringTeam;
  
  if (team && team.id) {
    // ✅ Only add scored class if the team is actually scored and NOT just reset
    if (team.scored) {
      const card = document.querySelector(`.team-card[data-team-id='${team.id}']`);
      if (card) card.classList.add("scored");
    }
    updateNextBtnState();
  }
  
  scoringModalEl.classList.remove("show");
  window.currentScoringTeam = null;
});

// Close on background click
window.addEventListener("click", (e) => {
  if (e.target === scoringModalEl) {
    const team = window.currentScoringTeam;
    
    if (team && team.id) {
      // Check if team card should be marked as scored
      const card = document.querySelector(`.team-card[data-team-id='${team.id}']`);
      if (card && team.scored) {
        card.classList.add("scored");
      }
      
      // ✅ Always check Next button state when closing
      updateNextBtnState();
    }
    
    scoringModalEl.classList.remove("show");
    window.currentScoringTeam = null;
  }
});
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", initTeams);

// ===============================
// ✅ UPDATE TEAM SCORE API CALL
// ===============================
async function updateTeamScore(teamId, score) {
  try {
    await fetch(`/api/teams/${teamId}/score`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score })
    });
  } catch (err) {
    console.error("❌ Failed to update team score:", err);
  }
}

// ------------------------------
// INIT ON DOM READY
// ------------------------------
document.addEventListener("DOMContentLoaded", initTeams);

// ===============================
// SOCKET: ADD TEAM BROADCAST
// ===============================
socket?.on("controller:add_team", ({ id, teamName }) => {
  if (!window.teams.some(t => t.id === id)) {
    window.teams.push({ id, name: teamName, score: 0 });
    renderTeams();
  }
});

// ===============================
// 🎮 SOCKET: ADD TEAM REMOTELY
// ===============================
document.addEventListener("controllerSocketReady", (e) => {
  window.socket = e.detail;

  window.socket.on("controller:add_team", (data) => {
    if (!data?.teamName) return;
    if (!window.teams.some(t => t.name === data.teamName)) {
      window.teams.push({ id: data.id || Date.now(), name: data.teamName, score: 0 });
      renderTeams();
    }
  });
});

// ===============================
// 🚀 RUN
// ===============================
document.addEventListener("DOMContentLoaded", initTeams);

document.getElementById("showFinalScoresBtn").addEventListener("click", async () => {
  console.log("📤 Sending request to show final scores...");

  try {
    const res = await fetch("http://192.168.1.77:8080/api/show-final-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();

    if (data.success) {
      console.log("✅ Final scores broadcasted successfully!");
    } else {
      console.warn("⚠️ Something went wrong:", data.message);
    }
  } catch (err) {
    console.error("❌ Error sending final scores request:", err);
  }
});

/********* Ready to Start Quiz (Controller App) *********/
document.getElementById("readyStartBtn")?.addEventListener("click", async () => {
  try {
    console.log("🚀 Ready to Start Quiz button clicked");

    // 1️⃣ Collect form values
    const day = document.getElementById("day")?.value || "";
    const location = document.getElementById("quizLocation")?.value || "";
    const scheduledStart = document.getElementById("scheduledStart")?.value;
    if (!scheduledStart) throw new Error("Scheduled start time is required");

    const teamAScore = parseInt(document.getElementById("teamAScore")?.value) || 0;
    const teamBScore = parseInt(document.getElementById("teamBScore")?.value) || 0;
    const teamCScore = parseInt(document.getElementById("teamCScore")?.value) || 0;

    // 2️⃣ Create new game / quiz instance
    const createRes = await fetch("http://192.168.1.77:4001/api/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day,
        location,
        team_a_score: teamAScore,
        team_b_score: teamBScore,
        team_c_score: teamCScore,
        scheduled_start_at: scheduledStart,
        rounds: [] // you can add rounds later
      })
    });

    if (!createRes.ok) throw new Error("Failed to create quiz");
    const quiz = await createRes.json();
    const newGameId = quiz.gameId || quiz.id;
    console.log("🎉 Quiz created:", newGameId);

    // 3️⃣ Update controller state
    window.currentGameId = newGameId;
    localStorage.setItem("currentGameId", newGameId);
    const gameIdInput = document.getElementById("gameIdInput");
    if (gameIdInput) gameIdInput.value = newGameId;

    // 4️⃣ Refresh quiz list
    if (typeof populateQuizList === "function") await populateQuizList();

    // 5️⃣ Activate quiz
    const activateRes = await fetch(`http://192.168.1.77:4001/api/quizzes/${newGameId}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!activateRes.ok) throw new Error("Failed to activate quiz");
    console.log("⚡ Quiz activated:", newGameId);

    // 6️⃣ Notify display + players
    socket.emit("controller:update_game_id", { gameId: newGameId });
    socket.emit("join_game_room", newGameId);

    // 7️⃣ Start countdown based on scheduled start
    socket.emit("controller:start_countdown", {
      gameId: newGameId,
      scheduledStart: scheduledStart // pass ISO string
    });
    console.log("⏱ Countdown emitted for game:", newGameId, "scheduled at:", scheduledStart);

    // 8️⃣ Highlight newly created quiz card
    setTimeout(() => {
      const quizCard = document.querySelector(`.quiz-item[data-id='${newGameId}']`);
      if (quizCard) {
        quizCard.style.border = "3px solid #4caf50";
        quizCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);

    // 9️⃣ Show success message
    const box = document.getElementById("quizMessage");
    if (box) {
      box.textContent = "✅ Quiz created & activated! Countdown started based on schedule.";
      box.style.display = "block";
      setTimeout(() => (box.style.display = "none"), 4000);
    }

  } catch (err) {
    console.error("❌ Failed to generate/start quiz:", err);
    alert("Failed to generate/start quiz. Check console for details.");
  }
});

// =============================================
// ✅ FETCH SCHEDULED START TIME
// =============================================
async function fetchScheduledStart(gameId) {
  try {
    const res = await fetch(`http://192.168.1.77:8080/api/latest-countdown?gameId=${gameId}`);
    const data = await res.json();
    return data.scheduledStart ? new Date(data.scheduledStart).getTime() : null;
  } catch (err) {
    console.error("❌ Failed to fetch scheduled start time:", err);
    return null;
  }
}

// =============================================
// 🔍 FETCH LATEST GAME ID
// =============================================
async function fetchLatestGameId() {
  try {
    const res = await fetch("http://192.168.1.77:8080/api/get-latest-game-id");
    const data = await res.json();

    if (data?.id) {
      window.activeGameId = data.id;
      const scheduled = await fetchScheduledStart(data.id);
      window.activeScheduledStart = scheduled || new Date().toISOString();
      console.log("🎯 Active game loaded:", window.activeGameId);
    } else {
      console.log("⚠️ No active game available");
    }
  } catch (err) {
    console.error("❌ Failed to fetch latest game:", err);
  }
}

// Initialize socket connection
function initSocket(gameId) {
  socket = io("http://192.168.1.77:8080", { auth: { role: "controller", gameId } });

  socket.on("connect", () => {
    console.log("🎮 Controller socket connected:", socket.id);
    socket.emit("join_game_room", gameId);
    socket.emit("join_game_room", "global");
  });
}

// Set active game & start quiz
async function startQuizFromController(gameId) {
  try {
    // 1️⃣ Set active game
    await fetch("http://192.168.1.77:8080/api/set-active-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId })
    });
    console.log("✅ Active game set:", gameId);

    // 2️⃣ Start quiz now
    const res = await fetch("http://192.168.1.77:8080/api/start-quiz-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId })
    });

    const data = await res.json();
    if (data.success) {
      console.log("🔥 START QUIZ sent successfully:", gameId);

      // 3️⃣ Emit Socket.IO signal (optional redundancy)
      socket.emit("quiz:start_now", { gameId });
    } else {
      console.error("❌ Failed to start quiz:", data);
    }
  } catch (err) {
    console.error("❌ Error starting quiz:", err);
  }
}

// =============================================
// 🚀 ON PAGE LOAD
// =============================================
document.addEventListener("DOMContentLoaded", async () => {
  const startBtn = document.getElementById("startQuizBtn");
  if (!startBtn) return;

  // Fetch or set current gameId
  let gameId = localStorage.getItem("currentGameId");
  if (!gameId) {
    const res = await fetch("http://192.168.1.77:8080/api/get-latest-game-id");
    const data = await res.json();
    if (!data?.id) return console.warn("No active game ID found");
    gameId = data.id;
    localStorage.setItem("currentGameId", gameId);
  }
  window.currentGameId = gameId;

  // --- Connect socket once ---
  window.socket = io("http://192.168.1.77:8080", { auth: { role: "quiz", gameId } });

  window.socket.on("connect", () => {
    console.log("🎮 Controller socket connected:", window.socket.id);
    window.socket.emit("join_game_room", gameId);
    window.socket.emit("join_game_room", "global");
  });

  // Queue START NOW signals if React not ready
  window._startQuizQueue = window._startQuizQueue || [];

  window.socket.on("quiz:start_now", ({ gameId }) => {
    console.log("🎬 Legacy wrapper received START NOW for game", gameId);

    const trigger = () => {
      if (window.triggerStartQuiz) {
        window.triggerStartQuiz();
        return true;
      }
      return false;
    };

    if (!trigger()) {
      console.warn("⚠️ React CountdownPage not ready, queueing START NOW");
      window._startQuizQueue.push(trigger);
    }
  });

  function bindNextButton(socketInstance) {
  const btn = document.getElementById("nextBtn");
  if (!btn || !socketInstance) return;

  // Remove old listeners safely
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);

  newBtn.addEventListener("click", () => {
    if (newBtn.disabled) {
      console.log("⛔ Next blocked — teams not fully scored");
      return;
    }

    console.log("▶️ Controller Next clicked");
    socketInstance.emit("controller:next", { at: Date.now() });
  });
}


function bindControlButtons(socketInstance) {
  if (!socketInstance) return;

  const btnIds = ["nextBtn", "prevBtn", "skipBtn", "endBtn"];

  btnIds.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;

    // ✅ DO NOT touch nextBtn at all
    if (id === "nextBtn") return;

    // Clone others to remove old listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    const action = id.replace("Btn", "");
    newBtn.addEventListener("click", () =>
      socketInstance.emit(`controller:${action.toLowerCase()}`, { at: Date.now() })
    );
  });
}

// --- Start Quiz Now button ---
startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  startBtn.textContent = "Starting...";

  try {
    const gameId = window.currentGameId;
    if (!gameId) return alert("⚠️ No quiz selected!");

    // Step 1: Set as active in backend
    await fetch("http://192.168.1.77:8080/api/set-active-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId })
    });

    // Step 2: Start quiz
    const res = await fetch("/api/start-quiz-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId })
    });
    const data = await res.json();
    if (!data?.success) return console.error("❌ Start failed:", data);

    console.log("🔥 Start Quiz Now signal sent!");

    // Step 3: Refresh quiz list
    await populateQuizList();

    // Step 4: Auto-activate the newly created quiz
    await handleQuizActivation(gameId);

    // Step 5: Auto-join game room
    if (window.socket && window.socket.connected) {
      window.socket.emit("joinRoom", { gameId });
      window.currentGameId = gameId;
      localStorage.setItem("currentGameId", gameId);

      // Step 6: Rebind control buttons AFTER activation and DOM update
      await new Promise(r => setTimeout(r, 50)); // tiny delay
      bindControlButtons(window.socket);
      console.log("✅ Buttons are now fully active for the new quiz!");

    // Step 7: Switch to scoreboard
    console.log("📊 Switching to scoreboard...");

    window.location.hash = "scoreboard";

    // Give the browser a moment to process the hash
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 8: Reload the page
    console.log("🔄 Reloading page to initialize scoreboard...");

    window.location.reload();
    }

  } catch (err) {
    console.error("❌ Error starting quiz:", err);
  } finally {
    startBtn.disabled = false;
    startBtn.textContent = "Start Quiz Now";
  }
});

// --- Listen for active quiz updates from Controller App ---
if (typeof socket !== "undefined") {
  socket.on("latest-game-id-updated", async ({ id }) => {
    if (!id || window.currentGameId === id) return;

    window.currentGameId = id;

    // Bind buttons immediately for newly activated quiz
    bindControlButtons(socket);
    console.log("🎉 Buttons rebound after latest-game-id update:", id);

    // Optional: load quiz content in UI if needed
    await loadQuizById(id);
  });
}
});

// -------------------------
// Fetch latest active quiz
// -------------------------
async function getLatestActiveQuizId() {
  try {
    const response = await fetch("http://192.168.1.77:4001/api/quizzes");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    let quizzes = await response.json();

    // Sort newest first
    quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Pick the first active quiz
    const activeQuiz = quizzes.find(q => q.status === "active") || quizzes[0];
    if (!activeQuiz) return null;

    return activeQuiz.game_id;
  } catch (err) {
    console.error("❌ Failed to fetch latest quiz:", err);
    return null;
  }
}

