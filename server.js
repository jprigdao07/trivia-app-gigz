require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require("multer");
const path = require("path");
const sharp = require('sharp');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4001 ;
const server = http.createServer(app);
// const io = new Server(server, { cors: { origin: "*" } });
const { v4: uuidv4 } = require('uuid');


const ALLOWED_ORIGINS = [
  'http://localhost:8080',       // controller on PC
  'http://127.0.0.1:8080',       // controller on PC
  'http://192.168.1.77:8080', // controller from phone or SBC
  'http://192.168.1.77:4001'
];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT']
  }
});


app.set('io', io);

const livereload = require("livereload");
const connectLivereload = require("connect-livereload");

// Create livereload server watching your frontend files
const liveReloadServer = livereload.createServer();
liveReloadServer.watch(path.join(__dirname, 'public'));

// Inject the livereload script into served HTML
app.use(connectLivereload());

// Notify browser on changes
liveReloadServer.server.once("connection", () => {
  setTimeout(() => {
    liveReloadServer.refresh("/");
  }, 100);
});

// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });

// server.listen(PORT, () => {
//   console.log(`🚀 Server running on http://localhost:${PORT}`);
// });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});

// app.use((req, res, next) => {
//   res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
//   res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
//     res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
//   next();
// });

// app.use(express.static('public'));


// CORS Configuration
// app.use(cors({
//   origin: "http://127.0.0.1:5500", // Allow frontend URL
//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"]
// }));

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // relax
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none'); // allow scripts
  next();
});

app.get('/test-headers', (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.send('Headers set');
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
app.use('/video', express.static(path.join(__dirname, 'public/video')));

// Serve static files or other routes
app.use(express.static('public'));

// ✅ Increase request body size limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Allow controller app (port 8080) to access
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:8080",
      "http://localhost:4001",
      "http://127.0.0.1:8080",
      "http://127.0.0.1:4001",
      "http://192.168.1.77:8080",
      "http://192.168.1.77:4001"
    ];

    // allow non-browser requests (Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));


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

  // 🔥 Make uploads folder public
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer Storage Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

//Dashboard
app.get("/dashboard-data", async (req, res) => {
  try {
    // Total quizzes
    const [[{ totalQuizzes }]] = await db.execute(
      "SELECT COUNT(*) AS totalQuizzes FROM games"
    );

    // Active quizzes
    const [[{ activeQuizzes }]] = await db.execute(
      "SELECT COUNT(*) AS activeQuizzes FROM games WHERE status = 'active'"
    );

    // Inactive quizzes
    const [[{ inactiveQuizzes }]] = await db.execute(
      "SELECT COUNT(*) AS inactiveQuizzes FROM games WHERE status = 'inactive'"
    );

    // Quiz activity over time (last 7 days, grouped by date)
    const [activityRows] = await db.execute(`
      SELECT 
        DATE(created_at) AS quizDate,
        COUNT(*) AS createdQuizzes,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeQuizzes
      FROM games
      GROUP BY DATE(created_at)
      ORDER BY quizDate ASC
      LIMIT 7
    `);

    res.json({
      // ✅ numbers
      totalQuizzes,
      activeQuizzes,
      inactiveQuizzes,

      // ✅ chart data
      activity: activityRows,

      // keep your existing metrics if needed
      activePlayers: 25,
      revenueDaily: 120.50,
      revenueWeekly: 840.00,
      revenueMonthly: 3200.00,
      revenueYearly: 40000.00
    });
  } catch (err) {
    console.error("Error fetching dashboard data:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// GET questions (dynamic search)
app.get('/questions', async (req, res) => {
  try {
    const { id, category, query } = req.query;

    let sql = `
      SELECT 
        q.id, 
        q.category_id, 
        q.multiple_choice, 
        q.question_text, 
        q.correct_answer, 
        q.wrong_answer, 
        q.tags, 
        i.image_file 
      FROM questions q
      LEFT JOIN images i ON q.id = i.question_id
    `;
    
    const conditions = [];
    const params = [];

    if (id) {
      conditions.push("q.id = ?");
      params.push(id);
    }

    if (category) {
      conditions.push("q.category_id = ?");
      params.push(category);
    }

    if (query) {
      conditions.push(`(
        q.question_text LIKE ? OR 
        q.correct_answer LIKE ? OR 
        q.wrong_answer LIKE ? OR 
        q.tags LIKE ?
      )`);
      params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    const [rows] = await db.query(sql, params);
    res.json({ success: true, questions: rows });
  } catch (error) {
    console.error("❌ Error fetching questions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve static files from the "uploads" folder
app.use('/uploads', express.static('uploads'));

// GET images with additional details from questions table
app.get('/images', async (req, res) => {
  try {
    const category = req.query.category?.trim(); // use ?category=character
    const query = req.query.query?.trim();       // optional search

    let sql = `
      SELECT 
        images.id AS image_id, 
        images.image_file, 
        images.question_id, 
        questions.question_text, 
        images.first_name, 
        images.middle_name, 
        images.last_name,
        images.name,
        images.wrong_answer_right, 
        images.tags_1, 
        images.sports, 
        images.entertainment, 
        images.other, 
        images.movie, 
        images.tv, 
        images.cartoon
      FROM images 
      LEFT JOIN questions ON images.question_id = questions.id
      WHERE 1=1
    `;

    const values = [];

    // Filter by image_category if provided
    if (category) {
      sql += ` AND images.image_category = ?`;
      values.push(category);
    }

    // Optional fuzzy search across names, tags, and question text
    if (query) {
      sql += `
        AND (
          images.image_category LIKE ? OR 
          images.first_name LIKE ? OR
          images.middle_name LIKE ? OR
          images.last_name LIKE ? OR
          images.name LIKE ? OR
          images.tags_1 LIKE ? OR
          questions.question_text LIKE ?
        )
      `;
      const wildcard = `%${query}%`;
      values.push(wildcard, wildcard, wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    const [results] = await db.query(sql, values);

    res.json({
      success: true,
      images: results
    });

  } catch (error) {
    console.error("❌ Error fetching images:", error);
    res.status(500).json({ success: false, error: "Failed to fetch images" });
  }
});

app.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    const {
      categoryName, multipleChoice, questionText, correctAnswer, wrongAnswer, tagsQuestions,
      charperCategory, namePlace, wrongAnswerrightSec, firstName, midName, lastName, rightsecTags
    } = req.body;

// ✅ Handle category properly
let categoryId = null;

if (!isNaN(categoryName)) {
  // Case 1: Frontend sent numeric ID
  categoryId = parseInt(categoryName);
  const [exists] = await db.query(
    `SELECT id FROM categories WHERE id = ? LIMIT 1`, 
    [categoryId]
  );
  if (exists.length === 0) {
    return res.status(400).json({ success: false, error: `Category ID not found: ${categoryId}` });
  }
} else {
  // Case 2: Frontend sent slug or full name
  const [row] = await db.query(
    `SELECT id FROM categories WHERE category_slug = ? OR name = ? LIMIT 1`, 
    [categoryName, categoryName]
  );
  if (row.length === 0) {
    return res.status(400).json({ success: false, error: `Invalid category: ${categoryName}` });
  }
  categoryId = row[0].id;
}


    // ✅ Handle checkboxes
    const checkboxFields = ["sports", "entertainment", "other", "movie", "telev", "cart"];
    let checkboxValues = {};
    checkboxFields.forEach(field => {
      checkboxValues[field] = req.body[field] === "1" ? 1 : 0;
    });

    // ✅ Insert question
    const questionSql = `
      INSERT INTO questions
      (category_id, multiple_choice, question_text, correct_answer, wrong_answer, tags) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const questionValues = [
      categoryId,
      multipleChoice,
      questionText,
      correctAnswer,
      wrongAnswer,
      tagsQuestions
    ];
    const [questionResult] = await db.query(questionSql, questionValues);
    const questionId = questionResult.insertId;

    console.log("✅ Question inserted with ID:", questionId);

    // ✅ Insert image if uploaded
    let imageId = null;
    let imageFile = null;

    if (req.file) {
      imageFile = `uploads/${req.file.filename}`;

      const imageSql = `
        INSERT INTO images (
          image_file, image_category, question_id, name,
          first_name, middle_name, last_name,
          wrong_answer_right, tags_1,
          sports, entertainment, other, movie, tv, cartoon
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const imageValues = [
        imageFile, charperCategory, questionId, namePlace,
        firstName, midName, lastName, wrongAnswerrightSec, rightsecTags,
        checkboxValues.sports, checkboxValues.entertainment, checkboxValues.other,
        checkboxValues.movie, checkboxValues.telev, checkboxValues.cart
      ];
      const [imageResult] = await db.query(imageSql, imageValues);
      imageId = imageResult.insertId;
    }

    // ✅ RETURN the new question object properly
    res.json({
      id: questionId,
      text: questionText,
      type: multipleChoice ? "mc" : "text",
      correctAnswer,
      wrongAnswer,
      tags: tagsQuestions,
      options: [],
      imageId,
      imagePath: imageFile ? `/${imageFile}` : null
    });

      } catch (error) {
        console.error("❌ Error inserting question or image:", error);
        res.status(500).json({
          success: false,
          error: error.sqlMessage || "Failed to upload image",
          details: error.message
        });
      }
    });

//Upload Only Image
app.post('/upload-only-image', upload.single('image'), async (req, res) => {
  try {
      if (!req.file) {
          console.error("❌ No image uploaded!");
          return res.status(400).json({ success: false, error: "No image uploaded!" });
      }

      const imageFile = `uploads/${req.file.filename}`;
      console.log("✅ Image uploaded:", imageFile);

      // ✅ Insert into `images` table
      const sql = `INSERT INTO images (image_file) VALUES (?)`;
      const values = [imageFile];

      const [result] = await db.query(sql, values);

      res.json({
          success: true,
          message: "🎉 Image uploaded successfully!",
          imageId: result.insertId,
          imagePath: imageFile
      });

  } catch (error) {
      console.error("❌ Error uploading image:", error);
      res.status(500).json({
          success: false,
          error: error.message || "Failed to upload image"
      });
  }
});

// Upload Only Image to images_music table
app.post('/upload-only-image-music', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ No image uploaded!");
      return res.status(400).json({ success: false, error: "No image uploaded!" });
    }

    const imageFile = `uploads/${req.file.filename}`;
    console.log("✅ Image uploaded:", imageFile);

    // ✅ Insert only image into `images_music` table
    const sql = `INSERT INTO images_music (image_file) VALUES (?)`;
    const values = [imageFile];

    const [result] = await db.query(sql, values);

    res.json({
      success: true,
      message: "🎉 Image uploaded to images_music successfully!",
      imageId: result.insertId,
      imagePath: imageFile
    });

  } catch (error) {
    console.error("❌ Error uploading image:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to upload image"
    });
  }
});

// 📤 Upload Song Endpoint (Fixed)
app.post("/upload_song", upload.fields([
  { name: "musicFile", maxCount: 1 },
  { name: "imageFileMusic", maxCount: 1 }
]), async (req, res) => {
  try {
    console.log("📥 Uploading song with optional image...");

    const musicFile = req.files?.musicFile?.[0];
    const imageFile = req.files?.imageFileMusic?.[0];

    if (!musicFile) {
      return res.status(400).json({ success: false, error: "Music file is required." });
    }

    const {
      round_type = "",
      artistName = "",
      songTitle = "",
      wrongName = "",
      wrongTitle = "",
      wrongAnswerMusic = "",
      featuring = "",
      musicTags = "",
      bandName = "",
      songField = "",
      rightsecTagsMusic = ""
    } = req.body;

    // ✅ Validate round type
    if (![6, 12].includes(parseInt(round_type))) {
      return res.status(400).json({ error: "This upload is only allowed for round_type 6 or 12." });
    }

    // ✅ Validate required fields
    if (!artistName.trim() || !songTitle.trim()) {
      return res.status(400).json({ success: false, error: "artistName and songTitle are required." });
    }

    // ✅ Insert into music_questions (Include band_name now)
    const musicQuestionsSQL = `
      INSERT INTO music_questions 
        (artist_name, song_title, wrong_name, wrong_title, wrong_answer_music, featuring, music_tags, uploaded_song, band_name, round_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const musicQuestionsValues = [
      artistName.trim(),
      songTitle.trim(),
      wrongName || null,
      wrongTitle || null,
      wrongAnswerMusic || null,
      featuring || null,
      musicTags || null,
      musicFile.filename,
      bandName || artistName || null,  // ✅ Use bandName if available, else artistName
      round_type
    ];

    const [musicResult] = await db.execute(musicQuestionsSQL, musicQuestionsValues);

    const musicQuestionId = musicResult.insertId;
    console.log("✅ music_questions insert success, ID:", musicQuestionId);

    if (!musicQuestionId || musicQuestionId <= 0) {
      throw new Error("❌ Failed to retrieve inserted music_question_id");
    }

    // ✅ Insert into images_music if imageFile is uploaded
    if (imageFile) {
      const imagesMusicSQL = `
        INSERT INTO images_music 
          (image_file, band_name, song_title_right, music_tags_right, music_question_id)
        VALUES (?, ?, ?, ?, ?)
      `;

      const imagesMusicValues = [
        imageFile.filename,
        bandName || artistName || null,
        songField || songTitle || null,
        rightsecTagsMusic || musicTags || null,
        musicQuestionId
      ];

      const [imageResult] = await db.execute(imagesMusicSQL, imagesMusicValues);
      console.log("✅ images_music insert success, Linked to Question ID:", musicQuestionId);
    }

    res.json({
      success: true,
      message: "🎵 Song uploaded successfully for Round " + round_type,
      music_question_id: musicQuestionId,
      musicFile: musicFile.filename,
      imageFile: imageFile?.filename || null
    });

  } catch (error) {
    console.error("🔥 Upload Error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, error: "Duplicate entry!" });
    }

    res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
  }
});


//Feud round
app.post("/add-feud-question", async (req, res) => {
  try {
    const { questionText, answers, alternateAnswer, tags } = req.body;

    // Ensure required fields are present
    if (!questionText || answers.length < 4) {
      return res.status(400).json({ success: false, error: "Invalid data: Ensure the question and four answers are provided." });
    }

    // Extract individual answers
    const answer1 = answers[0]?.text || null;
    const answer2 = answers[1]?.text || null;
    const answer3 = answers[2]?.text || null;
    const answer4 = answers[3]?.text || null;

    // Determine correct answer (optional, modify logic if needed)

    // Insert question into `feud_questions` table
    const sql = `
      INSERT INTO feud(question_text, question_type, answer1, answer2, answer3, answer4, alternate_answer, tags) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      questionText,
      "feud", // Default question type
      answer1,
      answer2,
      answer3,
      answer4,
      alternateAnswer || null,
      tags || null
    ];

    // Execute query
    const [result] = await db.execute(sql, values);
    console.log("✅ Feud question saved successfully!", result);

    res.json({ success: true, message: "Feud question added successfully!" });

  } catch (error) {
    console.error("🔥 Error adding feud question:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// ✅ Update Question API
app.put("/update-question/:id", async (req, res) => {
  const questionId = parseInt(req.params.id, 10);
  const updatedData = req.body;

  console.log("🔄 Received Update Request:");
  console.log("📌 ID:", questionId);
  console.log("📥 Raw Body:", JSON.stringify(updatedData, null, 2));

  // Check if required fields are missing
if (!updatedData.question_text || !updatedData.correct_answer) {
  console.warn("⚠️ Missing required fields!");
  return res.status(400).json({ success: false, error: "Missing question_text or correct_answer" });
}

const sql = `
  UPDATE questions
  SET question_text = ?, correct_answer = ?, wrong_answer = ?, tags = ?, multiple_choice = ?
  WHERE id = ?
`;

const values = [
  updatedData.question_text,
  updatedData.correct_answer,
  updatedData.wrong_answer || null,
  updatedData.tags || null,
  updatedData.multiple_choice ? 1 : 0,
  questionId
];

  console.log("📝 SQL Query:", sql);
  console.log("🔢 Query Values:", values);

  try {
    const [result] = await db.execute(sql, values);
    console.log("🔄 Query Result:", result);

    if (result.affectedRows === 0) {
      console.warn("⚠️ No rows updated! Does the ID exist?", questionId);
      return res.status(404).json({ success: false, error: "Question not found." });
    }

    console.log("✅ Question updated successfully!");
    res.json({ success: true, message: "Question updated successfully." });

  } catch (error) {
    console.error("🔥 Error updating question:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// ✅ Update Quiz Question API (updates quiz_questions table, not master questions)
app.put("/update-quiz-question/:id", async (req, res) => {
  const questionId = parseInt(req.params.id, 10);
  const { question_text, correct_answer, wrong_answer } = req.body;

  console.log("🔄 [quiz_questions] Update Request:", questionId, req.body);

  // 🛑 Validate input
  if (!questionId || isNaN(questionId)) {
    return res.status(400).json({ success: false, error: "Invalid question ID" });
  }
  if (!question_text?.trim() || !correct_answer?.trim()) {
    return res.status(400).json({ success: false, error: "Missing required fields: question_text and correct_answer" });
  }

  const sql = `
    UPDATE quiz_questions
    SET question_text = ?, correct_answer = ?, wrong_answer = ?
    WHERE id = ?
  `;

  const values = [
    question_text.trim(),
    correct_answer.trim(),
    wrong_answer?.trim() || null,
    questionId
  ];

  try {
    const [result] = await db.execute(sql, values);
    console.log("📝 SQL Executed:", sql, values);
    console.log("📊 Update Result:", result);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Question not found" });
    }

    res.json({
      success: true,
      message: "Quiz question updated successfully",
      updated: { id: questionId, question_text, correct_answer, wrong_answer: wrong_answer || null }
    });
  } catch (err) {
    console.error("🔥 Error updating quiz question:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});


// Insert into quiz_questions
app.post("/api/quiz-questions", async (req, res) => {
  const { round_id, question_text, correct_answer, wrong_answer } = req.body;

  if (!round_id || !question_text || !correct_answer) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  const sql = `
    INSERT INTO quiz_questions (round_id, question_text, correct_answer, wrong_answer, created_at)
    VALUES (?, ?, ?, ?, NOW())
  `;

  const values = [round_id, question_text, correct_answer, wrong_answer || ""];

  try {
    const [result] = await db.execute(sql, values);
    console.log("✅ Inserted quiz_question:", result);

    res.json({
      success: true,
      id: result.insertId,
      round_id,
      question_text,
      correct_answer,
      wrong_answer: wrong_answer || ""
    });
  } catch (error) {
    console.error("🔥 Error inserting quiz_question:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// ✅ Search quiz questions with category from rounds
app.get("/api/quiz-questions", async (req, res) => {
  const { search } = req.query;

  try {
    let sql = `
      SELECT q.id, q.round_id, q.question_text, q.correct_answer, q.wrong_answer, q.created_at,
             r.category AS category
      FROM quiz_questions q
      LEFT JOIN rounds r ON q.round_id = r.id
    `;
    let values = [];

    if (search) {
      sql += ` WHERE q.question_text LIKE ? OR q.correct_answer LIKE ? OR q.wrong_answer LIKE ?`;
      values = [`%${search}%`, `%${search}%`, `%${search}%`];
    }

    sql += " ORDER BY q.created_at DESC";

    const [rows] = await db.execute(sql, values);
    res.json(rows);
  } catch (error) {
    console.error("🔥 Error fetching quiz questions:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});


// 📸 Update Image Question - Backend (Only "Wrong Answers" & "Tags")
app.put('/update-image/:id', async (req, res) => {
  const imageId = parseInt(req.params.id, 10);
  if (!imageId) {
    console.log("⚠️ Invalid Image ID received.");
    return res.status(400).json({ success: false, error: "Invalid Image ID" });
  }

  console.log("🆔 Received Image ID:", imageId);
  console.log("🛠️ Received Data:", req.body);

  const { wrong_answer_right, tags_1 } = req.body;
  if (!wrong_answer_right && !tags_1) {
    console.log("⚠️ No valid updates provided.");
    return res.status(400).json({ success: false, error: "No updates provided." });
  }

  const query = "UPDATE images SET wrong_answer_right = ?, tags_1 = ? WHERE id = ?";
  const values = [wrong_answer_right || "", tags_1 || "", imageId];

  console.log("📝 Final SQL Query:", query);
  console.log("🔢 Query Values:", values);

  try {
    const [result] = await db.query(query, values);

    if (result.affectedRows === 0) {
      console.log("⚠️ No rows affected.");
      return res.status(404).json({ success: false, error: "Image not found or no changes made." });
    }

    console.log("✅ Image updated successfully!");
    
    // ✅ Force JSON response
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({ success: true, message: "✅ Image updated successfully!" });
  } catch (err) {
    console.error("❌ Database Error:", err);
    return res.status(500).json({ success: false, error: "Database error." });
  }
});

// 📸 Update Image Music - Backend (Only "Band Name", "Song Title", "Music Tags", and "Image File")
app.put('/update-image-music/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { band_name, song_title_right, music_tags_right } = req.body;

    console.log("📥 PUT /update-image-music/:id");
    console.log("🆔 ID:", id);
    console.log("📦 Payload:", { band_name, song_title_right, music_tags_right });

    const updateQuery = `
      UPDATE images_music
      SET band_name = ?, song_title_right = ?, music_tags_right = ?
      WHERE id = ?
    `;

    const [result] = await db.query(updateQuery, [
      band_name,
      song_title_right,
      music_tags_right,
      id
    ]);

    console.log("🔧 SQL Result:", result);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Image Music not found or no changes made.' });
    }

    res.json({ success: true, message: 'Image Music updated successfully.' });
  } catch (error) {
    console.error("❌ Error updating image music:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.delete('/delete-image/:id', async (req, res) => {
  try {
      const imageId = req.params.id;

      console.log("🛠️ Received DELETE request for image ID:", imageId);

      if (!imageId) {
          return res.status(400).json({ success: false, message: "Invalid image ID!" });
      }

      // ✅ Check if the image exists in the database
      const [rows] = await db.query("SELECT image_file FROM images WHERE id = ?", [imageId]);

      if (rows.length === 0) {
          return res.status(404).json({ success: false, message: "Image not found!" });
      }

      const imagePath = path.join(__dirname, "uploads", rows[0].image_file);

      // ✅ Delete the image file if it exists
      if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log("🗑️ Image file deleted:", imagePath);
      } else {
          console.warn("⚠️ Image file not found, but entry will still be removed from the database.");
      }

      // ✅ Delete the image from the database
      await db.query("DELETE FROM images WHERE id = ?", [imageId]);

      console.log("✅ Image deleted successfully!");
      return res.json({ success: true, message: "Image deleted successfully!" });

  } catch (error) {
      console.error("❌ Server error deleting image:", error);
      return res.status(500).json({ success: false, error: "Server error while deleting image" });
  }
});

// GET music questions (with optional ID)
app.get('/music_questions', async (req, res) => {
  try {
    const { id } = req.query;

    let query = `
      SELECT 
        id,
        artist_name,
        song_title,
        wrong_name,
        wrong_title,
        wrong_answer_music,
        featuring,
        music_tags,
        uploaded_song
      FROM music_questions
    `;
    const queryParams = [];

    if (id) {
      query += " WHERE id = ?";
      queryParams.push(id);
    }

    const [rows] = await db.query(query, queryParams);
    res.json({ success: true, musicQuestions: rows });
  } catch (error) {
    console.error("❌ Error fetching music questions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ NEW: Search music questions by song_title or artist_name
app.get('/music_questions/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, error: "Missing search query." });
    }

    const searchQuery = `
      SELECT 
        id,
        artist_name,
        song_title,
        wrong_name,
        wrong_title,
        wrong_answer_music,
        featuring,
        music_tags,
        uploaded_song
      FROM music_questions
      WHERE song_title LIKE ? OR artist_name LIKE ?
    `;
    const [rows] = await db.query(searchQuery, [`%${query}%`, `%${query}%`]);

    res.json({ success: true, musicQuestions: rows });
  } catch (error) {
    console.error("❌ Error searching music questions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ UPDATE: Update basic song fields by ID (editSong)
app.put('/update-song/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { artistName, songTitle, featuring, musicTags, wrongName, wrongTitle, wrongAnswerMusic } = req.body;

    const updateQuery = `
      UPDATE music_questions
      SET
        artist_name = ?,
        song_title = ?,
        featuring = ?,
        music_tags = ?,
        wrong_name = ?,
        wrong_title = ?,
        wrong_answer_music = ?
      WHERE id = ?
    `;

    const [result] = await db.query(updateQuery, [
      artistName,
      songTitle,
      featuring,
      musicTags,
      wrongName,
      wrongTitle,
      wrongAnswerMusic,
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Song not found." });
    }

    res.json({ success: true, message: "Song updated successfully." });
  } catch (error) {
    console.error("❌ Error updating song:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET images_music (with optional ID)
app.get('/images_music', async (req, res) => {
  try {
    const { id } = req.query;

    let query = `
      SELECT 
        id,
        band_name,
        song_title_right,
        music_tags_right,
        image_file
      FROM images_music
    `;
    const queryParams = [];

    if (id) {
      query += " WHERE id = ?";
      queryParams.push(id);
    }

    const [rows] = await db.query(query, queryParams);
    res.json({ success: true, imagesMusic: rows });
  } catch (error) {
    console.error("❌ Error fetching images_music:", error);
    res.status(500).json({ success: false, error: "Error fetching images music data." });
  }
});

// ✅ Search images_music by band_name or song_name
app.get('/images_music/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ success: false, error: "Search query cannot be empty." });
    }

const searchQuery = `
  SELECT 
    id,
    band_name,
    song_title_right,
    music_tags_right,
    image_file
  FROM images_music
  WHERE LOWER(band_name) LIKE LOWER(?) OR LOWER(song_title_right) LIKE LOWER(?)
`;

    const searchParam = `%${query.trim()}%`; // Trim the query to avoid unwanted spaces
    const [rows] = await db.query(searchQuery, [searchParam, searchParam]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No images found matching your search criteria." });
    }

    res.json({ success: true, imagesMusic: rows });
  } catch (error) {
    console.error("❌ Error searching images_music:", error);
    res.status(500).json({ success: false, error: "Error searching images music data." });
  }
});

app.delete('/delete-question/:id', async (req, res) => {
  try {
    const questionId = req.params.id;
    console.log("🗑️ Received DELETE request for question ID:", questionId);

    if (!questionId) {
      return res.status(400).json({ success: false, message: "Invalid question ID!" });
    }

    // Check if question exists
    const [rows] = await db.query("SELECT * FROM questions WHERE id = ?", [questionId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Question not found!" });
    }

    // Delete the question
    await db.query("DELETE FROM questions WHERE id = ?", [questionId]);
    console.log("✅ Question deleted successfully!");
    return res.json({ success: true, message: "Question deleted successfully!" });

  } catch (error) {
    console.error("❌ Server error deleting question:", error);
    return res.status(500).json({ success: false, error: "Server error while deleting question" });
  }
});

app.delete('/delete-song/:id', async (req, res) => {
  try {
    const songId = req.params.id;
    console.log("🎵🗑️ Received DELETE request for song ID:", songId);

    if (!songId) {
      return res.status(400).json({ success: false, message: "Invalid song ID!" });
    }

    // Check if song exists
    const [rows] = await db.query("SELECT * FROM music_questions WHERE id = ?", [songId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Song not found!" });
    }

    // Delete the song
    await db.query("DELETE FROM music_questions WHERE id = ?", [songId]);
    console.log("✅ Song deleted successfully!");
    return res.json({ success: true, message: "Song deleted successfully!" });

  } catch (error) {
    console.error("❌ Server error deleting song:", error);
    return res.status(500).json({ success: false, error: "Server error while deleting song" });
  }
});

app.delete('/delete-image-song/:id', async (req, res) => {
  try {
      const imageId = req.params.id;
      console.log("🛠️ Received DELETE request for image ID:", imageId);

      if (!imageId) {
          return res.status(400).json({ success: false, message: "Invalid image ID!" });
      }

      // ✅ Query from the correct table
      const [rows] = await db.query("SELECT image_file FROM images_music WHERE id = ?", [imageId]);

      if (rows.length === 0) {
          return res.status(404).json({ success: false, message: "Image not found!" });
      }

      const imageFileName = path.basename(rows[0].image_file); // Clean file path
      const imagePath = path.join(__dirname, "uploads", imageFileName);

      if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log("🗑️ Image file deleted:", imagePath);
      } else {
          console.warn("⚠️ Image file not found, but DB entry will be removed.");
      }

      await db.query("DELETE FROM images_music WHERE id = ?", [imageId]);

      console.log("✅ Image deleted from images_music!");
      return res.json({ success: true, message: "Image deleted successfully!" });

  } catch (error) {
      console.error("❌ Server error deleting image:", error);
      return res.status(500).json({ success: false, error: "Server error while deleting image" });
  }
});

//GET Feud Fields and Search 
app.get('/feud-questions', async (req, res) => {
  try {
    const { id } = req.query;

    let query = `
      SELECT 
        id,
        question_text,
        question_type,
        answer1,
        answer2,
        answer3,
        answer4,
        alternate_answer,
        tags
      FROM feud
    `;
    const queryParams = [];

    if (id) {
      query += " WHERE id = ?";
      queryParams.push(id);
    }

    const [rows] = await db.query(query, queryParams);

    const formatted = rows.map(row => ({
      question_id: row.id,
      question_text: row.question_text,
      alternate_answer: row.alternate_answer,
      tags: row.tags,
      answers: [
        { text: row.answer1, points: 40 },
        { text: row.answer2, points: 30 },
        { text: row.answer3, points: 20 },
        { text: row.answer4, points: 10 }
      ].filter(a => a.text) // filter out empty answers
    }));

    res.json({ success: true, feudQuestions: formatted });
  } catch (error) {
    console.error("❌ Error fetching feud questions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.get('/feud-questions/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, error: "Missing search query." });
    }

    const searchQuery = `
      SELECT 
        id,
        question_text,
        question_type,
        answer1,
        answer2,
        answer3,
        answer4,
        alternate_answer,
        tags
      FROM feud
      WHERE question_text LIKE ? OR tags LIKE ?
    `;
    const [rows] = await db.query(searchQuery, [`%${query}%`, `%${query}%`]);

    res.json({ success: true, feudQuestions: rows });
  } catch (error) {
    console.error("❌ Error searching feud questions:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT endpoint to update feud question
app.put("/update-feud-question/:id", async (req, res) => {
  const {
    question_text,
    question_type,
    answers,
    alternate_answer,
    tags
  } = req.body;

  const id = req.params.id;

  // Basic validation
  if (!id || !question_text || !answers || answers.length !== 4) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields. Please provide the question text and exactly four answers."
    });
  }

  // Prepare the answers
  const [answer1, answer2, answer3, answer4] = answers.map(a => a.text);

  const fieldsToUpdate = [];
  const values = [];
  let index = 1;

  fieldsToUpdate.push(`question_text = ?`);
  values.push(question_text);

  if (question_type) {
    fieldsToUpdate.push(`question_type = ?`);
    values.push(question_type);
  }

  fieldsToUpdate.push(`answer1 = ?`);
  values.push(answer1);

  fieldsToUpdate.push(`answer2 = ?`);
  values.push(answer2);

  fieldsToUpdate.push(`answer3 = ?`);
  values.push(answer3);

  fieldsToUpdate.push(`answer4 = ?`);
  values.push(answer4);

  if (alternate_answer) {
    fieldsToUpdate.push(`alternate_answer = ?`);
    values.push(alternate_answer);
  }

  if (tags) {
    fieldsToUpdate.push(`tags = ?`);
    values.push(tags);
  }

  const query = `
    UPDATE feud 
    SET ${fieldsToUpdate.join(', ')} 
    WHERE id = ?
  `;

  values.push(id); 

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();
  
    const [result] = await conn.execute(query, values);
  
    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, error: "Question not found." });
    }
  
    await conn.commit();
    res.json({ success: true, message: "Feud question updated successfully." });
  
  } catch (err) {
    console.error("Error updating feud question:", err);
    if (conn) await conn.rollback();
    res.status(500).json({ success: false, error: "Internal server error." });
  } finally {
    if (conn) conn.release();
  }
});


// ✅ File filter
// ✅ File filter
const fileFilter = (req, file, cb) => {
  const allowedVideoTypes = /video\/(mp4|avi|mov|mkv)/;
  const allowedImageTypes = /image\/(jpeg|png|jpg|gif)/;

  if (allowedVideoTypes.test(file.mimetype) || allowedImageTypes.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("❌ File type not allowed"), false);
  }
};

// ✅ Multer middleware
const uploadMovie = multer({
  storage,
  fileFilter
}).fields([
  { name: 'movieFile', maxCount: 1 },
  { name: 'imageFileMovie', maxCount: 1 }
]);

// 📥 Submit Movie Endpoint
app.post('/submit-movie', uploadMovie, async (req, res) => {
  console.log("📥 /submit-movie route hit");
  console.log("🧾 req.body:", req.body);
  console.log("📂 req.files:", req.files);

  try {
    const movieFile = req.files?.movieFile?.[0];
    const imageFile = req.files?.imageFileMovie?.[0];

    const {
      movieTitle = "",
      movieTagsMov = "",
      wrongAnswerMov = "",
      movieTitleRight = "",
      rightsecTagsMovie = ""
    } = req.body;

    const trimmedMovieTitle = movieTitle.trim();
    const trimmedRightTitle = movieTitleRight.trim();
    const trimmedTags = movieTagsMov.trim();
    const trimmedWrongAnswers = wrongAnswerMov.trim();
    const trimmedRightTags = rightsecTagsMovie.trim();

    // ✅ Validate required fields
    if (!movieFile || !trimmedMovieTitle) {
      return res.status(400).json({
        success: false,
        error: "🎬 Movie file and title are required."
      });
    }

    // 🎬 Insert into `movies` table
    const insertMovieSQL = `
      INSERT INTO movies (movie_file, movie_title, wrong_answers, tags)
      VALUES (?, ?, ?, ?)
    `;

    const [movieResult] = await db.execute(insertMovieSQL, [
      movieFile.filename,
      trimmedMovieTitle,
      trimmedWrongAnswers || null,
      trimmedTags || null
    ]);

    const insertedMovieId = movieResult.insertId;
    console.log("✅ Inserted into `movies`:", movieResult);

    // 🖼️ Insert image if provided
    if (imageFile) {
      const insertImageSQL = `
        INSERT INTO movie_images (movie_id, movie_title_right, tags_right, image_file_movie)
        VALUES (?, ?, ?, ?)
      `;

      const [imageResult] = await db.execute(insertImageSQL, [
        insertedMovieId,
        trimmedRightTitle || null,
        trimmedRightTags || null,
        imageFile.filename
      ]);

      console.log("✅ Inserted into `movie_images`:", imageResult);
    }

    return res.status(200).json({
      success: true,
      message: "🎉 Movie uploaded successfully!",
      data: {
        movieFile: movieFile.filename,
        imageFile: imageFile?.filename || null
      }
    });

  } catch (error) {
    console.error("🔥 Upload error:", error);

    const errorMessage = error.code === "ER_DUP_ENTRY"
      ? "Duplicate entry!"
      : "❌ Internal server error";

    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Upload route for Submit Image Only (Movies section)
// Rename route to match frontend POST request
app.post('/submit-image', upload.single('imageFileMovie'), async (req, res) => {
  try {
    const movieId = req.body.movieId || null;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const imagePath = req.file.path;

    const [result] = await db.execute(
      'INSERT INTO movie_images (movie_id, image_file_movie) VALUES (?, ?)',
      [movieId, imagePath]
    );

    res.json({ success: true, message: 'Image inserted successfully', insertedId: result.insertId });
  } catch (err) {
    console.error('Error saving to DB:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
});


// Crop video endpoint
app.post("/api/crop-video", upload.single("video"), (req, res) => {
  const { start, end } = req.body;
  const inputPath = req.file.path;
  const outputPath = path.join("outputs", `${Date.now()}-cropped.mp4`);
  const duration = (parseFloat(end) - parseFloat(start)).toFixed(2);

  const cmd = `ffmpeg -ss ${start} -i ${inputPath} -t ${duration} -c copy ${outputPath}`;

  exec(cmd, (error) => {
    fs.unlinkSync(inputPath); // delete original upload

    if (error) {
      console.error("FFmpeg error:", error);
      return res.status(500).send("Video processing failed.");
    }

    res.sendFile(path.resolve(outputPath), () => {
      fs.unlinkSync(outputPath); // delete cropped file after sending
    });
  });
});

// GET /movies - fetch all movies or a specific one by ID
app.get('/movies', async (req, res) => {
  try {
    const { id } = req.query;

    let query = `
      SELECT 
        m.id,
        m.movie_file,
        m.movie_title,
        m.wrong_answers,
        m.tags,
        i.movie_title_right,
        i.tags_right,
        i.image_file_movie
      FROM movies m
      LEFT JOIN movie_images i ON m.id = i.movie_id
    `;
    const queryParams = [];

    if (id) {
      query += " WHERE m.id = ?";
      queryParams.push(id);
    }

    const [rows] = await db.query(query, queryParams);

    const formatted = rows.map(row => ({
      id: row.id,
      title: row.movie_title,
      wrong_answers: row.wrong_answers?.split(',') || [],
      tags: row.tags?.split(',') || [],
      movie_file: row.movie_file,
      image: {
        title_right: row.movie_title_right,
        tags_right: row.tags_right?.split(',') || [],
        file: row.image_file_movie
      }
    }));

    res.json({ success: true, movies: formatted });
  } catch (error) {
    console.error("❌ Error fetching movies:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /movies/search - search by title or tags (case-insensitive)
app.get('/movies/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, error: "Missing search query." });
    }

    const searchQuery = `
      SELECT 
        m.id,
        m.movie_file,
        m.movie_title,
        m.wrong_answers,
        m.tags,
        i.movie_title_right,
        i.tags_right,
        i.image_file_movie
      FROM movies m
      LEFT JOIN movie_images i ON m.id = i.movie_id
      WHERE LOWER(m.movie_title) LIKE LOWER(?) OR LOWER(m.tags) LIKE LOWER(?)
    `;

    const likeQuery = `%${query}%`;
    const [rows] = await db.query(searchQuery, [likeQuery, likeQuery]);

    console.log(`🔍 Search query: "${query}", matched rows: ${rows.length}`);

    const formatted = rows.map(row => ({
      id: row.id,
      title: row.movie_title,
      wrong_answers: row.wrong_answers?.split(',') || [],
      tags: row.tags?.split(',') || [],
      movie_file: row.movie_file,
      image: {
        title_right: row.movie_title_right,
        tags_right: row.tags_right?.split(',') || [],
        file: row.image_file_movie
      }
    }));

    res.json({ success: true, movies: formatted });
  } catch (error) {
    console.error("❌ Error searching movies:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Update Movie LEFT (Video)
app.post('/update-movie-left', upload.single('movieFile'), async (req, res) => {
  try {
    let { selectedMovieId, movieTitleLeft, leftsecTagsMovie, wrongAnswerMovie } = req.body;

    console.log("📌 Received Movie ID:", selectedMovieId);

    // ✅ Check if Movie ID is provided and numeric
    if (!selectedMovieId || isNaN(selectedMovieId)) {
      return res.status(400).json({ success: false, error: "A valid numeric Movie ID is required." });
    }

    selectedMovieId = parseInt(selectedMovieId, 10);

    // ✅ Check file validity if uploaded
    if (req.file) {
      const allowedExtensions = ['.mp4', '.avi', '.mov'];
      const fileExtension = path.extname(req.file.originalname).toLowerCase();

      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ success: false, error: "Invalid file type. Only video files are allowed." });
      }
    }

    // ✅ Build the update query
    let updateQuery = `
      UPDATE movies
      SET movie_title = ?, tags = ?, wrong_answers = ?
    `;
    const queryParams = [movieTitleLeft, leftsecTagsMovie, wrongAnswerMovie];

    if (req.file) {
      updateQuery += `, movie_file = ?`;
      queryParams.push(req.file.filename);
    }

    updateQuery += ` WHERE id = ?`;
    queryParams.push(selectedMovieId);

    console.log('Executing query:', updateQuery);
    console.log('With parameters:', queryParams);

    // ✅ Execute the query
    const [result] = await db.query(updateQuery, queryParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Movie not found." });
    }

    res.json({ success: true, message: "✅ Movie (left) updated successfully." });
  } catch (error) {
    console.error("❌ Error updating movie (left):", error);
    res.status(500).json({ success: false, error: "Server error. Please try again later." });
  }
});

// ✅ Update Movie RIGHT (Image)
app.post('/update-movie-right', upload.single('imageFileMovie'), async (req, res) => {
  try {
    const selectedMovieId = req.body.selectedMovieIdRight || req.body.selectedMovieId;
    const { movieTitleRight, rightsecTagsMovie } = req.body;

    if (!selectedMovieId) {
      return res.status(400).json({ success: false, error: "Movie ID is required." });
    }

    // Check if the record exists
    const [existing] = await db.query(
      `SELECT * FROM movie_images WHERE movie_id = ?`,
      [selectedMovieId]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, error: "Movie image record not found." });
    }

    let updateQuery = `
      UPDATE movie_images
      SET movie_title_right = ?, tags_right = ?
    `;
    const queryParams = [movieTitleRight, rightsecTagsMovie];

    if (req.file) {
      updateQuery += `, image_file_movie = ?`;
      queryParams.push(req.file.filename);
    }

    updateQuery += ` WHERE movie_id = ?`;
    queryParams.push(selectedMovieId);

    const [result] = await db.query(updateQuery, queryParams);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Movie image record not updated." });
    }

    res.json({ success: true, message: "✅ Movie (right) updated successfully." });
  } catch (error) {
    console.error("❌ Error updating movie (right):", error);
    res.status(500).json({ success: false, error: "Server error. Please try again later." });
  }
});

// DELETE a movie and its associated images
app.delete('/delete-movie/:movieId', async (req, res) => {
  const movieId = req.params.movieId;

  try {
    // 1. Check if the movie exists
    const [movieCheck] = await db.execute('SELECT * FROM movies WHERE id = ?', [movieId]);
    if (movieCheck.length === 0) {
      return res.status(404).json({ success: false, error: 'Movie not found' });
    }

    // 2. Get associated image filenames
    const [images] = await db.execute(
      'SELECT image_file_movie FROM movie_images WHERE movie_id = ?',
      [movieId]
    );

    // 3. Delete image files from the filesystem
    for (const row of images) {
      if (row.image_file_movie) {
        const imagePath = path.join(__dirname, 'uploads', row.image_file_movie);
        try {
          await fs.promises.unlink(imagePath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            console.error(`⚠️ Error deleting image file: ${imagePath}`, err);
          }
        }
      }
    }

    // 4. Delete associated image records
    await db.execute('DELETE FROM movie_images WHERE movie_id = ?', [movieId]);

    // 5. Delete the movie record
    await db.execute('DELETE FROM movies WHERE id = ?', [movieId]);

    return res.json({ success: true, message: '🎬 Movie and associated images deleted successfully.' });
  } catch (err) {
    console.error('🔥 Error deleting movie and images:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// DELETE a movie image by its movie ID
app.delete('/delete-movie-image/:movieId', async (req, res) => {
  const movieId = req.params.movieId;

  try {
    // 1. Check if an image exists for the movie
    const [existing] = await db.execute(
      'SELECT image_file_movie FROM movie_images WHERE movie_id = ?',
      [movieId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'No image found for this movie ID' });
    }

    // 2. Delete image file from filesystem
    for (const row of existing) {
      if (row.image_file_movie) {
        const imagePath = path.join(__dirname, 'uploads', row.image_file_movie);
        try {
          await fs.promises.unlink(imagePath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            console.error(`⚠️ Error deleting image file: ${imagePath}`, err);
          }
        }
      }
    }

    // 3. Delete image record from DB
    await db.execute('DELETE FROM movie_images WHERE movie_id = ?', [movieId]);

    return res.json({ success: true, message: '🖼️ Movie image deleted successfully.' });
  } catch (error) {
    console.error('❌ Error deleting image:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

//Wager Round
const uploadWager = upload.fields([
  { name: 'imageFileWagerLeft', maxCount: 1 },
  { name: 'imageFileWagerRight', maxCount: 1 }
]);

app.post('/submit-wager', uploadWager, async (req, res) => {
  console.log("📥 /submit-wager hit");
  console.log("🧾 req.body:", req.body);
  console.log("📂 req.files:", req.files);

  try {
    const imageLeft = req.files?.imageFileWagerLeft?.[0];
    const imageRight = req.files?.imageFileWagerRight?.[0];
    const correctAnswer = req.body.correctAnswerWager?.trim();
    const wrongAnswer = req.body.wrongAnswerWager?.trim();
    const wagerTags = req.body.rightsecTagsWager;

    // Validate at least one image is uploaded
    if (!imageLeft && !imageRight) {
      return res.status(400).json({ success: false, error: "❗ At least one image is required." });
    }

    let leftImageId, rightImageId, fullImageId;
    const uploadsDir = path.join(__dirname, 'uploads');

    // ✅ Insert left image
    if (imageLeft) {
      const [result] = await db.execute(
        "INSERT INTO wager_images (file_path, type) VALUES (?, ?)",
        [imageLeft.filename, 'half']
      );
      leftImageId = result.insertId;
    }

    // ✅ Insert right image
    if (imageRight) {
      const [result] = await db.execute(
        "INSERT INTO wager_images (file_path, type) VALUES (?, ?)",
        [imageRight.filename, 'half']
      );
      rightImageId = result.insertId;
    }

    // ✅ If both halves exist, merge them into one full image
    let combinedFileName = null;
    if (imageLeft && imageRight) {
      combinedFileName = `${Date.now()}-full.jpg`;
      const combinedPath = path.join(uploadsDir, combinedFileName);

      // Combine the two images side by side
      await sharp({
        create: {
          width: 2000, // Adjust size based on your images
          height: 1000,
          channels: 3,
          background: '#ffffff'
        }
      })
      .composite([
        { input: path.join(uploadsDir, imageLeft.filename), left: 0, top: 0 },
        { input: path.join(uploadsDir, imageRight.filename), left: 1000, top: 0 }
      ])
      .toFile(combinedPath);

      // ✅ Insert full image record
      const [fullResult] = await db.execute(
        "INSERT INTO wager_images (file_path, type) VALUES (?, ?)",
        [combinedFileName, 'full']
      );
      fullImageId = fullResult.insertId;
    }

    // ✅ Insert wager submission
    const [submissionResult] = await db.execute(
      `INSERT INTO wager_submissions 
       (correct_answer, wrong_answer, image_id_left, image_id_right, image_id_full, wager_tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [correctAnswer, wrongAnswer, leftImageId, rightImageId, fullImageId, wagerTags]
    );

    return res.status(200).json({
      success: true,
      message: "🎉 Wager submission uploaded successfully!",
      fullImage: combinedFileName || null
    });

  } catch (error) {
    console.error("🔥 Wager upload error:", error);
    return res.status(500).json({ success: false, error: "❌ Internal server error" });
  }
});

// GET wager submissions search
app.get('/wager-submissions/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ success: false, error: "Query is required." });
    }

    let sql = `
      SELECT 
        ws.id,
        ws.correct_answer,
        ws.wrong_answer,
        ws.wager_tags,
        imgL.file_path AS image_left,
        imgR.file_path AS image_right
      FROM wager_submissions ws
      JOIN wager_images imgL ON ws.image_id_left = imgL.id
      JOIN wager_images imgR ON ws.image_id_right = imgR.id
      WHERE LOWER(ws.correct_answer) LIKE LOWER(?) 
         OR LOWER(ws.wrong_answer) LIKE LOWER(?)
    `;

    const likeQuery = `%${query.trim()}%`;
    const [rows] = await db.query(sql, [likeQuery, likeQuery]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "No matching wager submissions found." });
    }

    res.json({ success: true, submissions: rows });
  } catch (error) {
    console.error("❌ Error searching wager submissions:", error);
    res.status(500).json({ success: false, error: "Search failed." });
  }
});

// GET wager images search
app.get('/wager-images/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ success: false, error: "Query is required." });
    }

    const sql = `
      SELECT id, file_path
      FROM wager_images
      WHERE LOWER(file_path) LIKE LOWER(?)
    `;
    const likeQuery = `%${query.trim()}%`;
    const [rows] = await db.query(sql, [likeQuery]);

    res.json({ success: true, images: rows });
  } catch (error) {
    console.error("❌ Error searching wager images:", error);
    res.status(500).json({ success: false, error: "Server error." });
  }
});

// PATCH /update-wager/:id
app.patch('/update-wager/:id', uploadWager, async (req, res) => {
  console.log("🔄 /update-wager hit");
  console.log("🧾 req.body:", req.body);
  console.log("📂 req.files:", req.files);

  const submissionId = req.params.id;

  try {
    const {
      correctAnswerWager,
      wrongAnswerWager,
      rightsecTagsWager,
      selectedWagerIdLeft,
      selectedWagerIdRight
    } = req.body;

    const imageLeft = req.files?.imageFileWagerLeft?.[0];
    const imageRight = req.files?.imageFileWagerRight?.[0];

    // Check if wager submission exists and get existing image IDs to fallback
    const [existingRows] = await db.execute(
      "SELECT image_id_left, image_id_right FROM wager_submissions WHERE id = ?",
      [submissionId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: "Wager submission not found." });
    }

    let currentLeftImageId = existingRows[0].image_id_left;
    let currentRightImageId = existingRows[0].image_id_right;


    // Else fallback to current DB value (don't overwrite with NULL)
    let leftImageId = currentLeftImageId;
    if (imageLeft) {
      // Delete old left image file if exists
      if (currentLeftImageId) {
        const [oldLeftImage] = await db.execute("SELECT file_path FROM wager_images WHERE id = ?", [currentLeftImageId]);
        if (oldLeftImage.length) {
          const rawLeftFile = oldLeftImage[0].file_path || "";
          const cleanLeftFile = path.basename(rawLeftFile).replace(/[^\w.\-]/g, "");
          const oldLeftPath = path.join(__dirname, 'uploads', cleanLeftFile);

          console.log("🗑 Deleting old left image:", oldLeftPath);
          fs.unlink(oldLeftPath, (err) => {
            if (err) console.warn("⚠️ Failed to delete old left image:", err);
          });
        }
      }
      // Insert new left image and get new ID
      const [leftResult] = await db.execute(
        "INSERT INTO wager_images (file_path) VALUES (?)",
        [imageLeft.filename]
      );
      leftImageId = leftResult.insertId;
    } else if (selectedWagerIdLeft && selectedWagerIdLeft.trim() !== "") {
      // Use selectedWagerIdLeft if provided and not empty string
      leftImageId = selectedWagerIdLeft;
    }
    // else keep currentLeftImageId

    // Same logic for right image
    let rightImageId = currentRightImageId;
    if (imageRight) {
      if (currentRightImageId) {
        const [oldRightImage] = await db.execute("SELECT file_path FROM wager_images WHERE id = ?", [currentRightImageId]);
        if (oldRightImage.length) {
          const rawRightFile = oldRightImage[0].file_path || "";
          const cleanRightFile = path.basename(rawRightFile).replace(/[^\w.\-]/g, "");
          const oldRightPath = path.join(__dirname, 'uploads', cleanRightFile);

          console.log("🗑 Deleting old right image:", oldRightPath);
          fs.unlink(oldRightPath, (err) => {
            if (err) console.warn("⚠️ Failed to delete old right image:", err);
          });
        }
      }
      const [rightResult] = await db.execute(
        "INSERT INTO wager_images (file_path) VALUES (?)",
        [imageRight.filename]
      );
      rightImageId = rightResult.insertId;
    } else if (selectedWagerIdRight && selectedWagerIdRight.trim() !== "") {
      rightImageId = selectedWagerIdRight;
    }
    // else keep currentRightImageId

    // Update wager submission with COALESCE to preserve existing text fields if not provided
      await db.execute(`
        UPDATE wager_submissions
        SET 
          correct_answer = COALESCE(?, correct_answer),
          wrong_answer = COALESCE(?, wrong_answer),
          wager_tags = COALESCE(?, wager_tags),
          image_id_left = ?,
          image_id_right = ?
        WHERE id = ?
      `, [
        correctAnswerWager?.trim() || null,
        wrongAnswerWager?.trim() || null,
        rightsecTagsWager?.trim() || null,
        leftImageId,
        rightImageId,
        submissionId
      ]);

    res.json({
      success: true,
      message: "✅ Wager submission updated successfully.",
      updated: {
        id: submissionId,
        correctAnswer: correctAnswerWager || "(unchanged)",
        wrongAnswer: wrongAnswerWager || "(unchanged)",
        wagerTags: rightsecTagsWager || "(unchanged)",
        newLeftImage: imageLeft?.filename || "(unchanged)",
        newRightImage: imageRight?.filename || "(unchanged)"
      }
    });

  } catch (error) {
    console.error("❌ Error updating wager submission:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// DELETE /delete-wager/:id
app.delete('/delete-wager/:id', async (req, res) => {
  console.log("🗑 DELETE /delete-wager hit");

  const submissionId = req.params.id;

  try {
    // Step 1: Get the image IDs and file paths for cleanup
    const [submissionRows] = await db.execute(
      `SELECT image_id_left, image_id_right FROM wager_submissions WHERE id = ?`,
      [submissionId]
    );

    if (submissionRows.length === 0) {
      return res.status(404).json({ success: false, error: "Wager submission not found." });
    }

    const { image_id_left, image_id_right } = submissionRows[0];

    // Step 2: Delete image files and their DB entries
    const deleteImage = async (imageId) => {
      if (!imageId) return;

      const [imageRows] = await db.execute(
        `SELECT file_path FROM wager_images WHERE id = ?`,
        [imageId]
      );

      if (imageRows.length > 0) {
        const rawPath = imageRows[0].file_path || "";
        const cleanFile = path.basename(rawPath).replace(/[^\w.\-]/g, "");
        const filePath = path.join(__dirname, 'uploads', cleanFile);

        console.log("🗑 Deleting image file:", filePath);
        fs.unlink(filePath, (err) => {
          if (err) console.warn("⚠️ Failed to delete image file:", err);
        });

        await db.execute(`DELETE FROM wager_images WHERE id = ?`, [imageId]);
      }
    };

    await deleteImage(image_id_left);
    await deleteImage(image_id_right);

    // Step 3: Delete the wager submission itself
    await db.execute(`DELETE FROM wager_submissions WHERE id = ?`, [submissionId]);

    res.json({
      success: true,
      message: `✅ Wager submission with ID ${submissionId} and associated images deleted successfully.`,
    });

  } catch (error) {
    console.error("❌ Error deleting wager submission:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

  // server.js or your routes file
app.get('/api/rounds/:id', async (req, res) => {
  const roundId = req.params.id;

const sql = `
  SELECT 
  c.category_name AS category,
  q.id AS question_id,
  q.question_text AS text,
  q.correct_answer,
  q.wrong_answer,
  q.tags,
  q.multiple_choice AS options,
  (
    SELECT i.image_file 
    FROM images i 
    WHERE i.question_id = q.id 
    ORDER BY i.uploaded_at DESC 
    LIMIT 1
  ) AS answerImage
FROM questions q
JOIN categories c ON q.category_id = c.id
WHERE q.category_id = ?
ORDER BY q.id ASC
`;

  try {
    const [rows] = await db.execute(sql, [roundId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No questions found for this round.' });
    }

    const { category } = rows[0];

    const questions = rows.map((q) => {
      let parsedOptions = [];

      try {
        parsedOptions = JSON.parse(q.options || '[]');
      } catch (err) {
        console.warn(`Invalid JSON for question ${q.question_id}:`, q.options);
      }

      let type = 'text';
      if (parsedOptions.length > 0) {
        type = 'mc';
      } else if (q.text.endsWith('.mp3')) {
        type = 'audio';
      } else if (q.text.endsWith('.mp4')) {
        type = 'video';
      }

      return {
        id: q.question_id,
        text: q.text,
        correct_answer: q.correct_answer,
        wrong_answer: q.wrong_answer || '',
        tags: q.tags || '',
        type,
        options: parsedOptions,
        answerImage: q.answerImage ? `/${q.answerImage}` : null, // ✅ prepend '/' for access
      };
    });

    res.json({ category, questions });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a new question (used by the Add New Question button)
app.post('/api/questions', async (req, res) => {
  const { category_id, text, type, options } = req.body;

  if (!category_id || !text) {
    return res.status(400).json({ success: false, error: 'Missing category_id or text' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO questions (category_id, question_text, multiple_choice) VALUES (?, ?, ?)',
      [
        category_id,
        text,
        type === 'mc' ? JSON.stringify(options || []) : null
      ]
    );

    const insertedId = result.insertId;

    res.json({
      id: insertedId,
      text,
      type,
      options: options || []
    });
  } catch (err) {
    console.error("❌ Error inserting question:", err);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});

//Delete Question
app.delete('/delete-question/:id', async (req, res) => {
  const questionId = parseInt(req.params.id, 10);

  if (isNaN(questionId)) {
    return res.status(400).json({ success: false, error: "Invalid question ID" });
  }

  try {
    const [result] = await db.execute('DELETE FROM questions WHERE id = ?', [questionId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Question not found" });
    }
    res.json({ success: true, message: "Question deleted" });
  } catch (err) {
    console.error("❌ Error deleting question:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// 🗑️ Delete Question from quiz_questions table
app.delete('/api/delete-question-api/:id', async (req, res) => {
  const questionId = parseInt(req.params.id, 10);

  if (isNaN(questionId)) {
    return res.status(400).json({ success: false, error: "Invalid question ID" });
  }

  try {
    const [result] = await db.execute(
      'DELETE FROM quiz_questions WHERE id = ?',
      [questionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Question not found" });
    }

    res.json({ success: true, message: "Question deleted" });
  } catch (err) {
    console.error("❌ Error deleting question:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// 📤 GET: Fetch Movie Round Data (Round 15)
app.get('/api/movie-round', async (req, res) => {
  try {
    const [movies] = await db.execute(`
      SELECT 
        m.id AS movie_id,
        m.movie_file,
        m.movie_title,
        mi.movie_title_right,
        mi.image_file_movie
      FROM movies m
      LEFT JOIN movie_images mi ON mi.movie_id = m.id
      WHERE m.movie_file IS NOT NULL
      ORDER BY m.created_at ASC
    `);

    const questions = movies.map((row) => ({
      question_text: `/uploads/${row.movie_file}`, // ✅ matches React
      type: 'video',
      correct_answer: row.movie_title_right || row.movie_title,
      movie_title: row.movie_title,
      answerImage: row.image_file_movie
        ? `/uploads/${row.image_file_movie}`
        : null
    }));

    res.json({
      category: "Movie Round",
      questions
    });

  } catch (err) {
    console.error("🔥 Failed to fetch movie round:", err);
    res.status(500).json({ error: "Failed to load movie round" });
  }
});


// ✅ UPDATED BACKEND: /api/music-round
app.get('/api/music-round', async (req, res) => {
  const roundType = req.query.round_type; // must be explicitly provided now (e.g., ?round_type=12)

  if (!roundType) {
    return res.status(400).json({ error: 'Missing round_type parameter (e.g., 6 or 12)' });
  }

  try {
    const [rows] = await db.execute(`
      SELECT 
        mq.id,
        mq.uploaded_song,
        mq.artist_name,
        mq.song_title,
        mq.song_title_right,
        mq.band_name,
        mq.music_tags,
        mq.music_tags_right,
        mq.wrong_name,
        mq.wrong_title,
        mq.wrong_answer_music,
        mq.featuring,
        mq.round_type,
        im.image_file AS answerImage, 
        im.band_name AS image_band_name
      FROM music_questions mq
      LEFT JOIN images_music im 
        ON im.music_question_id = mq.id
      WHERE mq.round_type = ?
      ORDER BY mq.uploaded_at ASC
    `, [roundType]);

    const questions = rows.map(row => ({
      text: `/uploads/${row.uploaded_song}`,
      type: 'audio',
      correct_answer: row.song_title_right || row.song_title,
      wrong_name: row.wrong_name || '',
      wrong_title: row.wrong_title || '',
      wrong_answer_music: row.wrong_answer_music || '',
      artist_name: row.artist_name || '',
      band_name: row.band_name || row.image_band_name || 'Unknown Band',
      featuring: row.featuring || '',
      tags: row.music_tags_right || row.music_tags || '',
      answerImage: row.answerImage ? `/uploads/${row.answerImage}` : null
    }));

    res.json({
      category: `Music Round ${roundType}`,
      questions
    });
  } catch (err) {
    console.error(`🎵 Failed to fetch music round (Round ${roundType}):`, err);
    res.status(500).json({ error: 'Failed to load music round' });
  }
});

//For Round 12
app.get('/api/rounds/12', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        mq.id,
        mq.uploaded_song,
        mq.artist_name,
        mq.song_title,
        mq.song_title_right,
        mq.band_name,
        mq.music_tags_right,
        im.image_file AS answerImage,
        im.band_name AS image_band_name
      FROM music_questions mq
      LEFT JOIN images_music im 
        ON im.music_question_id = mq.id
      ORDER BY mq.uploaded_at ASC
    `);

    const questions = rows.map(row => ({
      text: `/uploads/${row.uploaded_song}`,
      type: 'audio',
      correct_answer: row.song_title_right || row.song_title,
      tags: row.music_tags_right || '',
      band_name: row.band_name || row.image_band_name || 'Unknown Band',
      answerImage: row.answerImage ? `/uploads/${row.answerImage}` : null
    }));

    res.json({
      category: 'Music Round',
      questions
    });
  } catch (err) {
    console.error('🎵 Failed to fetch music round (Round 12):', err);
    res.status(500).json({ error: 'Failed to load music round' });
  }
});

// API endpoint to create game
// ✅ Create a new game with scheduled start time
app.post('/api/game-id', async (req, res) => {
  try {
    const gameId = uuidv4();
    const createdAt = new Date();

    const {
      day,               // <-- MUST be a datetime string
      location,
      team_a_score = 0,
      team_b_score = 0,
      team_c_score = 0
    } = req.body;

    // Convert to valid Date
    const scheduledStartAt = day ? new Date(day) : null;

    // 1️⃣ Insert game with SCHEDULED START TIME
    await db.execute(
      `INSERT INTO games 
        (id, status, created_at, day, location, scheduled_start_at, 
         team_a_score, team_b_score, team_c_score)
       VALUES (?, 'inactive', ?, ?, ?, ?, ?, ?, ?)`,
      [
        gameId,
        createdAt,
        day || null,
        location || null,
        scheduledStartAt,
        parseInt(team_a_score),
        parseInt(team_b_score),
        parseInt(team_c_score)
      ]
    );

    // 2️⃣ Insert 15 default rounds
    const ROUND_TEMPLATES = [
      { round_number: 1, title: 'Round 1', category: 'American History' },
      { round_number: 2, title: 'Round 2', category: 'Geography' },
      { round_number: 3, title: 'Round 3', category: 'Sports' },
      { round_number: 4, title: 'Round 4', category: 'Science & Tech' },
      { round_number: 5, title: 'Round 5', category: 'Who Am I?' },
      { round_number: 6, title: 'Round 6', category: 'Music Round' },
      { round_number: 7, title: 'Round 7', category: 'Arts & Literature' },
      { round_number: 8, title: 'Round 8', category: 'Random' },
      { round_number: 9, title: 'Round 9', category: 'Entertainment' },
      { round_number: 10, title: 'Round 10', category: 'Feud' },
      { round_number: 11, title: 'Round 11', category: 'Nature' },
      { round_number: 12, title: 'Round 12', category: 'Music Round' },
      { round_number: 13, title: 'Round 13', category: 'World History' },
      { round_number: 14, title: 'Round 14', category: 'Wager Round' },
      { round_number: 15, title: 'Round 15', category: 'Final Round' }
    ];

    const rounds = []; 

    for (const r of ROUND_TEMPLATES) {
      const [insertResult] = await db.execute(
        `INSERT INTO rounds 
          (game_id, round_number, title, category, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [gameId, r.round_number, r.title, r.category, createdAt]
      );

      rounds.push({
        id: insertResult.insertId,
        round_number: r.round_number,
        title: r.title,
        category: r.category
      });
    }

    // 3️⃣ Return scheduled start time
    res.json({
      id: gameId,
      message: 'Game created successfully!',
      scheduledStart: scheduledStartAt ? scheduledStartAt.toISOString() : null,
      rounds
    });

  } catch (err) {
    console.error('❌ Error creating game:', err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});


// ✅ Save / update results for an existing game
app.post('/api/save-results', async (req, res) => {
  const { gameId, day, location, team_a_score, team_b_score, team_c_score } = req.body;

  if (!gameId) {
    return res.status(400).json({ error: 'gameId is required' });
  }

  try {
    // ✅ Always update since frontend guarantees values
    await db.execute(
      `UPDATE games 
       SET day = ?, location = ?, 
           team_a_score = ?, team_b_score = ?, team_c_score = ?
       WHERE id = ?`,
      [day, location, team_a_score, team_b_score, team_c_score, gameId]
    );

    // 🔍 Ensure rounds still exist
    const [existingRounds] = await db.execute(`SELECT id FROM rounds WHERE game_id = ?`, [gameId]);
    if (existingRounds.length === 0) {
      const ROUND_TEMPLATES = [
        { round_number: 1, title: 'Round 1', category: 'American History' },
        { round_number: 2, title: 'Round 2', category: 'Geography' },
        { round_number: 3, title: 'Round 3', category: 'Sports' },
        { round_number: 4, title: 'Round 4', category: 'Science & Tech' },
        { round_number: 5, title: 'Round 5', category: 'Who Am I?' },
        { round_number: 6, title: 'Round 6', category: 'Music Rounds' },
        { round_number: 7, title: 'Round 7', category: 'Arts & Literature' },
        { round_number: 8, title: 'Round 8', category: 'Random' },
        { round_number: 9, title: 'Round 9', category: 'Entertainment' },
        { round_number: 10, title: 'Round 10', category: 'Feud' },
        { round_number: 11, title: 'Round 11', category: 'Nature' },
        { round_number: 12, title: 'Round 12', category: 'Music Rounds' },
        { round_number: 13, title: 'Round 13', category: 'World History' },
        { round_number: 14, title: 'Round 14', category: 'Wager Round' },
        { round_number: 15, title: 'Round 15', category: 'Final Round' },
      ];

      for (const r of ROUND_TEMPLATES) {
        await db.execute(
          `INSERT INTO rounds (id, game_id, round_number, title, category, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [uuidv4(), gameId, r.round_number, r.title, r.category]
        );
      }
    }

    res.json({ message: 'Results saved and rounds ensured successfully!' });
  } catch (err) {
    console.error('Database save-results error:', err);
    res.status(500).json({ error: 'Failed to save results' });
  }
});

// Fetch full quiz details by game_id
app.get('/api/quizzes', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        g.id AS game_id,
        'General Knowledge Quiz' AS quiz_title,
        g.created_at,
        g.day,
        g.location,
        g.team_a_score,
        g.team_b_score,
        g.team_c_score,
        g.status,
        COUNT(r.id) AS rounds_count,
        CASE WHEN EXISTS(
          SELECT 1 
          FROM rounds r2
          JOIN quiz_questions q ON q.round_id = r2.id
          WHERE r2.game_id = g.id
        ) THEN 1 ELSE 0 END AS has_rounds
      FROM games g
      LEFT JOIN rounds r ON r.game_id = g.id
      GROUP BY g.id
      ORDER BY g.created_at ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching quizzes:', err);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Create a new quiz with 15 rounds and insert all questions into quiz_questions
// Create and activate a new quiz
app.post('/api/quizzes', async (req, res) => {
  try {
    const {
      gameId,
      day,
      location,
      scheduled_start_at, // expected "YYYY-MM-DD HH:MM:SS" PH time
      team_a_score,
      team_b_score,
      team_c_score,
      rounds = []
    } = req.body;

    // ✅ Validate required fields
    if (!day || !location || !scheduled_start_at) {
      return res.status(400).json({
        error: "Missing required fields: day, location, scheduled_start_at"
      });
    }

    // ===============================
    // Convert PH time string to UTC timestamp
    // ===============================
    function phTimeToUTC(phTimeString) {
      const [datePart, timePart] = phTimeString.split(" ");
      const [year, month, dayNum] = datePart.split("-").map(Number);
      const [hour, minute, second] = timePart.split(":").map(Number);
      // PH = UTC+8, so subtract 8 hours
      return Date.UTC(year, month - 1, dayNum, hour - 8, minute, second);
    }

    const scheduledTimestamp = phTimeToUTC(scheduled_start_at);

    let finalGameId = gameId;

    // 1️⃣ Create or update game
    if (!gameId) {
      const [gameResult] = await db.execute(
        `INSERT INTO games 
         (day, location, scheduled_start_at, team_a_score, team_b_score, team_c_score, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
        [
          day,
          location,
          scheduled_start_at, // store PH time string directly
          parseInt(team_a_score) || 0,
          parseInt(team_b_score) || 0,
          parseInt(team_c_score) || 0
        ]
      );
      finalGameId = gameResult.insertId;
    } else {
      await db.execute(
        `UPDATE games
         SET day = ?, location = ?, scheduled_start_at = ?, team_a_score = ?, team_b_score = ?, team_c_score = ?, status = 'active'
         WHERE id = ?`,
        [
          day,
          location,
          scheduled_start_at,
          parseInt(team_a_score) || 0,
          parseInt(team_b_score) || 0,
          parseInt(team_c_score) || 0,
          finalGameId
        ]
      );
    }

    // 2️⃣ Insert default rounds
    const defaultRounds = Array.from({ length: 15 }, (_, i) => ({
      round_number: i + 1,
      title: `Round ${i + 1}`,
      category: [
        "American History","Geography","Sports","Science & Tech","Who Am I?",
        "Music","Arts & Literature","Random","Entertainment","Feud",
        "Nature","Music","World History","Wager Round","Name That Movie"
      ][i]
    }));

    const insertedRounds = [];
    for (const r of defaultRounds) {
      const [roundResult] = await db.execute(
        `INSERT INTO rounds (game_id, round_number, title, category, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [finalGameId, r.round_number, r.title, r.category]
      );
      insertedRounds.push({ ...r, id: roundResult.insertId, questions: [] });
    }

    // 3️⃣ Insert provided questions
    for (const round of rounds) {
      const dbRound = insertedRounds.find(r => r.round_number === round.roundId);
      if (!dbRound || !Array.isArray(round.questions)) continue;

      for (const q of round.questions) {
        const [result] = await db.execute(
          `INSERT INTO quiz_questions
           (round_id, question_text, correct_answer, wrong_answer, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [
            dbRound.id,
            q.questionText || q.text || '',
            q.correct_answer || q.correctAnswer || '',
            q.wrong_answer || (Array.isArray(q.wrong) ? q.wrong.join(',') : '')
          ]
        );
        dbRound.questions.push({
          id: result.insertId,
          questionText: q.questionText || q.text || '',
          correct_answer: q.correct_answer || q.correctAnswer || '',
          wrong_answer: q.wrong_answer || (Array.isArray(q.wrong) ? q.wrong.join(',') : '')
        });
      }
    }

    // 4️⃣ Emit selected quiz to controller
    io.emit("controller:selected_quiz", { gameId: finalGameId });

    // 5️⃣ Schedule countdown based on PH time
    const scheduleCountdown = (gameId, startTime) => {
      const delay = startTime - Date.now();

      if (delay <= 0) {
        io.emit("controller:start_countdown", { gameId, startTime: Date.now() });
        console.log(`🚀 Countdown started immediately for game ${gameId}`);
      } else {
        setTimeout(() => {
          io.emit("controller:start_countdown", { gameId, startTime });
          console.log(`⏱ Countdown started for game ${gameId}`);
        }, delay);
      }
    };

    scheduleCountdown(finalGameId, scheduledTimestamp);

    // 6️⃣ Return response with PH datetime preserved
    res.json({
      success: true,
      message: "Quiz created and activated",
      gameId: finalGameId,
      scheduled_start_at, // PH time string
      rounds: insertedRounds
    });

  } catch (err) {
    console.error("Error creating and activating quiz:", err);
    res.status(500).json({ error: "Failed to create and activate quiz" });
  }
});

// Activate a quiz
app.post("/api/quizzes/:id/activate", async (req, res) => {
  console.log("🔥 /activate endpoint was called!", req.params.id);
  try {
    const gameId = req.params.id;

    // 1️⃣ Set this quiz as "active"
    await db.execute(
      `UPDATE games SET status = 'active' WHERE id = ?`,
      [gameId]
    );

    // 2️⃣ Emit socket event so countdown starts
    io.emit("controller:start_countdown", {
      gameId,
      startTime: Date.now()
    });

    // Also notify that this quiz is now selected
    io.emit("controller:selected_quiz", {
      gameId
    });

    res.json({ success: true, message: "Quiz activated", gameId });

  } catch (err) {
    console.error("Error activating quiz:", err);
    res.status(500).json({ error: "Failed to activate quiz" });
  }
});

// Get all games sorted by creation time
app.get('/api/games', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT *
       FROM games
       ORDER BY created_at ASC` // oldest first, newest last
    );

    res.json(rows);
  } catch (err) {
    console.error('Database fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});


// Fetch quiz details, always returning a quiz object
app.get('/api/quiz-details/:id', async (req, res) => {
  const gameId = req.params.id;

  try {
    // Fetch existing rounds joined with game info
    const [dbRounds] = await db.execute(`
      SELECT 
        r.id AS round_id,
        r.round_number,
        r.title,
        r.category,
        r.created_at AS round_created_at,
        g.day,
        g.location,
        g.team_a_score,
        g.team_b_score,
        g.team_c_score
      FROM rounds r
      JOIN games g ON r.game_id = g.id
      WHERE g.id = ?
    `, [gameId]);

    if (!dbRounds || dbRounds.length === 0) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Map db rounds by round_number for easy lookup
    const dbRoundsMap = new Map();
    dbRounds.forEach(r => dbRoundsMap.set(r.round_number, r));

    // Merge templates with DB rounds so all 15 rounds are returned
    const rounds = ROUND_TEMPLATES.map(rtpl => {
      const dbRound = dbRoundsMap.get(rtpl.round_number);
      return {
        round_id: dbRound?.round_id || null,
        round_number: rtpl.round_number,
        title: rtpl.title,
        category: rtpl.category,
        created_at: dbRound?.round_created_at || null,
        day: dbRound?.day || null,
        location: dbRound?.location || null,
        team_a_score: dbRound?.team_a_score || 0,
        team_b_score: dbRound?.team_b_score || 0,
        team_c_score: dbRound?.team_c_score || 0,
        questions: [] // will populate below
      };
    });

    // Attach questions
    const questionTables = [
      { table: 'questions', map: q => ({ id: q.id, questionText: q.question_text, options: q.multiple_choice || [], correct_answer: q.correct_answer }) },
      { table: 'music_questions', map: q => ({ id: q.id, questionText: q.song_title, options: [], correct_answer: q.song_title_right }) },
      { table: 'wager_submissions', map: q => ({ id: q.id, questionText: q.question_text, options: [], correct_answer: q.correct_answer }) },
      { table: 'movies', map: q => ({ id: q.id, questionText: q.movie_title, options: [], correct_answer: q.movie_title }) },
      { table: 'feud', map: q => ({ id: q.id, questionText: q.question_text, options: [], correct_answer: q.correct_answer }) },
    ];

    for (let round of rounds) {
      if (!round.round_id) continue; // skip rounds not yet created in DB

      let allQuestions = [];
      for (let qt of questionTables) {
        const [rows] = await db.execute(
          `SELECT * FROM ${qt.table} WHERE round_id = ? ORDER BY id ASC`,
          [round.round_id]
        );
        allQuestions = allQuestions.concat(rows.map(qt.map));
      }

      // Filter duplicates and empty questions
      const seen = new Set();
      round.questions = allQuestions.filter(q => {
        const text = q.questionText?.trim();
        if (!text || seen.has(text)) return false;
        seen.add(text);
        return true;
      });
    }

    res.json({ gameId, rounds });

  } catch (err) {
    console.error('Error fetching quiz details:', err);
    res.status(500).json({ error: 'Failed to fetch quiz details' });
  }
});

// Get quiz/game details by gameId
app.get('/api/quizzes/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    // 1️⃣ Fetch game info
    const [gameRows] = await db.execute(
      `SELECT * FROM games WHERE id = ?`,
      [gameId]
    );

    if (!gameRows || gameRows.length === 0) {
      return res.status(404).json({ error: "Game not found" });
    }
    const game = gameRows[0];

    // 2️⃣ Fetch rounds
    const [roundRows] = await db.execute(
      `SELECT * FROM rounds WHERE game_id = ? ORDER BY round_number ASC`,
      [gameId]
    );

    // 3️⃣ Attach all questions for each round
    const detailedRounds = await Promise.all(
      roundRows.map(async (round) => {
        // a) Standard questions
        const [questions] = await db.execute(
          `SELECT id, question_text, correct_answer, wrong_answer, multiple_choice
           FROM questions WHERE round_id = ?`,
          [round.id]
        );

        // b) Music questions
        const [musicQuestions] = await db.execute(
          `SELECT id, song_title, song_title_right
           FROM music_questions WHERE round_id = ?`,
          [round.id]
        );

        // c) Wager submissions
        const [wagerQuestions] = await db.execute(
          `SELECT id, question_text, correct_answer
           FROM wager_submissions WHERE round_id = ?`,
          [round.id]
        );

        // d) Movie questions
        const [movieQuestions] = await db.execute(
          `SELECT id, movie_title
           FROM movies WHERE round_id = ?`,
          [round.id]
        );

        // e) Feud questions
        const [feudQuestions] = await db.execute(
          `SELECT id, question_text, correct_answer
           FROM feud WHERE round_id = ?`,
          [round.id]
        );

        // ✅ Combine all into a uniform structure
        const allQuestions = [
          ...questions.map(q => ({
            id: q.id,
            questionText: q.question_text || '',
            correctAnswer: q.correct_answer || '',
            wrongAnswer: q.wrong_answer || '',
            multipleChoice: q.multiple_choice ?? null,
            type: 'standard'
          })),
          ...musicQuestions.map(q => ({
            id: q.id,
            questionText: q.song_title || '',
            correctAnswer: q.song_title_right || '',
            type: 'music'
          })),
          ...wagerQuestions.map(q => ({
            id: q.id,
            questionText: q.question_text || '',
            correctAnswer: q.correct_answer || '',
            type: 'wager'
          })),
          ...movieQuestions.map(q => ({
            id: q.id,
            questionText: q.movie_title || '',
            correctAnswer: null,
            type: 'movie'
          })),
          ...feudQuestions.map(q => ({
            id: q.id,
            questionText: q.question_text || '',
            correctAnswer: q.correct_answer || '',
            type: 'feud'
          }))
        ];

        return { ...round, questions: allQuestions };
      })
    );

    // 4️⃣ Return full quiz
    res.json({ game, rounds: detailedRounds });

  } catch (err) {
    console.error("❌ Error fetching quiz details:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Fetch full quiz details (with all 15 rounds)
app.get('/api/quiz/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    // 1️⃣ Get game info
    const [gameRows] = await db.execute(
      `SELECT id, day, location, team_a_score, team_b_score, team_c_score
       FROM games
       WHERE id = ?`,
      [gameId]
    );
    const game = gameRows[0];
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // 2️⃣ Get all rounds for this game
    const [roundRows] = await db.execute(
      `SELECT id AS round_id, round_number, title AS round_title, category
       FROM rounds
       WHERE game_id = ?
       ORDER BY round_number`,
      [gameId]
    );

    // If no rounds, return empty
    if (!roundRows.length) {
      return res.json({ game, rounds: [] });
    }

    // 3️⃣ Fetch all questions for these rounds
    const roundIds = roundRows.map(r => r.round_id);
    const placeholders = roundIds.map(() => '?').join(',');
    const [questionRows] = await db.execute(
      `SELECT id AS question_id, round_id, question_text, correct_answer, wrong_answer
       FROM quiz_questions
       WHERE round_id IN (${placeholders})
       ORDER BY id`,
      roundIds
    );

    // 4️⃣ Map questions to rounds
    const roundsMap = {};
    roundRows.forEach(r => {
      roundsMap[r.round_id] = {
        id: r.round_id,
        round_number: r.round_number,
        title: r.round_title,
        category: r.category,
        questions: []
      };
    });

    questionRows.forEach(q => {
      if (roundsMap[q.round_id]) {
        roundsMap[q.round_id].questions.push({
          id: q.question_id,
          questionText: q.question_text,
          correctAnswer: q.correct_answer,
          wrong: q.wrong_answer ? q.wrong_answer.split(',') : [],
          source: "quiz" 
        });
      }
    });

    const rounds = Object.values(roundsMap);

    res.json({ game, rounds });
  } catch (err) {
    console.error('Error fetching quiz:', err);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// GET feud round questions
app.get('/api/round/feud', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT id, question_text, question_type, answer1, answer2, answer3, answer4
      FROM feud
      WHERE round_number = 10
      ORDER BY RAND()
      LIMIT 1
    `);

    if (!rows.length) {
      return res.status(404).json({ error: 'Feud question not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('❌ Failed to fetch feud question:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

//Wager Round API for React
app.get('/api/wager-round', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        ws.correct_answer, 
        wi_full.file_path AS fullImage,
        wi_left.file_path AS leftImage,
        wi_right.file_path AS rightImage
      FROM wager_submissions ws
      LEFT JOIN wager_images wi_full ON ws.image_id_full = wi_full.id
      LEFT JOIN wager_images wi_left ON ws.image_id_left = wi_left.id
      LEFT JOIN wager_images wi_right ON ws.image_id_right = wi_right.id
      ORDER BY ws.id DESC LIMIT 1
    `);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No wager found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Predefined 15 rounds template
const ROUND_TEMPLATES = [
  { round_number: 1, title: 'Round 1', category: 'American History' },
  { round_number: 2, title: 'Round 2', category: 'Geography' },
  { round_number: 3, title: 'Round 3', category: 'Sports' },
  { round_number: 4, title: 'Round 4', category: 'Science & Tech' },
  { round_number: 5, title: 'Round 5', category: 'Who Am I?' },
  { round_number: 6, title: 'Round 6', category: 'Music Rounds' },
  { round_number: 7, title: 'Round 7', category: 'Arts & Literature' },
  { round_number: 8, title: 'Round 8', category: 'Random' },
  { round_number: 9, title: 'Round 9', category: 'Entertainment' },
  { round_number: 10, title: 'Round 10', category: 'Feud' },
  { round_number: 11, title: 'Round 11', category: 'Nature' },
  { round_number: 12, title: 'Round 12', category: 'Music Rounds' },
  { round_number: 13, title: 'Round 13', category: 'World History' },
  { round_number: 14, title: 'Round 14', category: 'Wager Round' },
  { round_number: 15, title: 'Round 15', category: 'Final Round' },
];

// -----------------------------
// Create new quiz + 15 rounds
app.post('/api/create-new-quiz', async (req, res) => {
  try {
    const { day, location } = req.body;
    const gameId = uuidv4();
    const createdAt = new Date();

    // 1️⃣ Insert new game
    await db.execute(
      `INSERT INTO games (id, day, location, team_a_score, team_b_score, team_c_score, created_at)
       VALUES (?, ?, ?, 0, 0, 0, ?)`,
      [gameId, day, location, createdAt]
    );

    // 2️⃣ Insert all 15 rounds
    const allRoundsTemplate = [
      { round_number: 1, title: 'Round 1', category: 'American History' },
      { round_number: 2, title: 'Round 2', category: 'Geography' },
      { round_number: 3, title: 'Round 3', category: 'Sports' },
      { round_number: 4, title: 'Round 4', category: 'Science & Tech' },
      { round_number: 5, title: 'Round 5', category: 'Who Am I?' },
      { round_number: 6, title: 'Round 6', category: 'Music Rounds' },
      { round_number: 7, title: 'Round 7', category: 'Arts & Literature' },
      { round_number: 8, title: 'Round 8', category: 'Random' },
      { round_number: 9, title: 'Round 9', category: 'Entertainment' },
      { round_number: 10, title: 'Round 10', category: 'Feud' },
      { round_number: 11, title: 'Round 11', category: 'Nature' },
      { round_number: 12, title: 'Round 12', category: 'Music Rounds' },
      { round_number: 13, title: 'Round 13', category: 'World History' },
      { round_number: 14, title: 'Round 14', category: 'Wager Round' },
      { round_number: 15, title: 'Round 15', category: 'Name That Movie' }
    ];

    const roundIdMap = {}; // Map round_number => round_id

    for (const r of allRoundsTemplate) {
      const roundId = uuidv4();
      roundIdMap[r.round_number] = roundId;
      await db.execute(
        `INSERT INTO rounds (id, game_id, round_number, title, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [roundId, gameId, r.round_number, r.title, r.category, createdAt]
      );
    }

    // 3️⃣ Copy questions from master tables into quiz_questions

    // --- Regular questions table (rounds 1-5,7-11,13,14 etc.) ---
    const [regularQuestions] = await db.execute(`SELECT * FROM questions`);
    for (const q of regularQuestions) {
      await db.execute(
        `INSERT INTO quiz_questions (round_id, question_text, correct_answer, wrong_answer, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [roundIdMap[q.round_number], q.question_text, q.correct_answer, q.wrong_answer || '', createdAt]
      );
    }

    // --- Music questions (round 6 & 12) ---
    const [musicQuestions] = await db.execute(`SELECT * FROM music_questions`);
    for (const q of musicQuestions) {
      const roundNum = q.round_number; // should be 6 or 12
      await db.execute(
        `INSERT INTO quiz_questions (round_id, question_text, correct_answer, wrong_answer, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [roundIdMap[roundNum], q.text, q.correct_answer, q.wrong_answer || '', createdAt]
      );
    }

    // --- Feud questions (round 10) ---
    const [feudQuestions] = await db.execute(`SELECT * FROM feud`);
    for (const q of feudQuestions) {
      await db.execute(
        `INSERT INTO quiz_questions (round_id, question_text, correct_answer, wrong_answer, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [roundIdMap[10], q.question, q.answer, '', createdAt]
      );
    }

    // --- Movie questions (round 15) ---
    const [movieQuestions] = await db.execute(`SELECT * FROM movies`);
    for (const q of movieQuestions) {
      await db.execute(
        `INSERT INTO quiz_questions (round_id, question_text, correct_answer, wrong_answer, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [roundIdMap[15], q.question_text, q.correct_answer, '', createdAt]
      );
    }

    res.json({ success: true, gameId });

  } catch (err) {
    console.error('Error creating new quiz:', err);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// Assign quiz to a day & location
app.post("/api/assign-quiz", async (req, res) => {
  try {
    const { quizId, day, location } = req.body;

    if (!quizId || !day) {
      return res.status(400).json({ error: "quizId and day are required" });
    }

    // Example: only update day if location not provided
    const query = location 
      ? `UPDATE games SET day = ?, location = ?, status = 'active' WHERE id = ?`
      : `UPDATE games SET day = ?, status = 'active' WHERE id = ?`;

    const params = location ? [day, location, quizId] : [day, quizId];

    await db.execute(query, params);

    res.json({ success: true, message: `Quiz ${quizId} assigned to ${day}${location ? ' at ' + location : ''}` });
  } catch (err) {
    console.error("❌ Error assigning quiz:", err);
    res.status(500).json({ error: "Failed to assign quiz" });
  }
});

// ✅ PATCH /api/quiz/:quizId/activate
app.patch("/api/quiz/:quizId/activate", async (req, res) => {
  const { quizId } = req.params;
  const io = req.app.get("io");

  try {
    // Check if the game exists
    const [rows] = await db.execute(`SELECT * FROM games WHERE id = ?`, [quizId]);
    let game = rows[0];

    if (!game) {
      // If not found, create a new game record
      const createdAt = new Date();
      await db.execute(
        `INSERT INTO games (id, status, created_at) VALUES (?, 'active', ?)`,
        [quizId, createdAt]
      );
      const [newRows] = await db.execute(`SELECT * FROM games WHERE id = ?`, [quizId]);
      game = newRows[0];
      console.log(`🆕 Created new active game with ID: ${quizId}`);
    } else {
      // If found, just update the status
      await db.execute(`UPDATE games SET status = 'active' WHERE id = ?`, [quizId]);
      console.log(`♻️ Reused existing game ID: ${quizId}`);
    }

    // ✅ Assign this quiz_id to all unlinked teams
    await db.execute(`UPDATE teams SET quiz_id = ? WHERE quiz_id IS NULL`, [quizId]);
    console.log(`🔗 Linked unassigned teams to quiz_id: ${quizId}`);

    // ✅ Broadcast activation event to all connected clients
    io.emit("latest-game-id-updated", { id: game.id });
    io.emit("quiz:start", { gameId: game.id });

    console.log(`📡 Broadcasted quiz activation for ID: ${game.id}`);

    res.json({ message: "Quiz activated successfully!", game });
  } catch (err) {
    console.error("❌ Activate quiz error:", err);
    res.status(500).json({ error: "Failed to activate quiz" });
  }
});

// ✅ Fetch quiz details including top 3 teams per location
app.get('/api/quiz/:quizId', async (req, res) => {
  const { quizId } = req.params;
  try {
    // 1️⃣ Fetch the quiz/game
    const [[quiz]] = await db.execute(`SELECT * FROM games WHERE id = ?`, [quizId]);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // 2️⃣ Fetch top 3 teams per location for this quiz
    const [teams] = await db.execute(`
      SELECT team_name, location, score
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY location ORDER BY score DESC) AS rn
        FROM teams
        WHERE quiz_id = ?
      ) ranked
      WHERE rn <= 3
      ORDER BY location, score DESC
    `, [quizId]);

    // 3️⃣ Optionally fetch rounds if you have a rounds table (currently empty)
    const [rounds] = await db.execute(`
      SELECT * FROM rounds WHERE quiz_id = ? ORDER BY round_number ASC
    `, [quizId]);

    res.json({ game: quiz, topTeams: teams, rounds });
  } catch (err) {
    console.error('❌ Failed to fetch quiz details:', err);
    res.status(500).json({ error: 'Failed to fetch quiz details' });
  }
});

// ✅ Fetch teams by quiz_id (query parameter)
app.get("/api/teams", async (req, res) => {
  const quiz_id = req.query.quiz_id;

  console.log("📩 Incoming request for teams. quiz_id =", quiz_id);

  if (!quiz_id || quiz_id === "null" || quiz_id === "undefined") {
    console.log("❌ quiz_id is missing or invalid.");
    return res.status(400).json({ error: "Missing quiz_id" });
  }

  try {
    // Fetch teams for this quiz_id, ordered by score
    const [teams] = await db.execute(
      "SELECT * FROM teams WHERE quiz_id = ? ORDER BY score DESC",
      [quiz_id]
    );

    console.log("✅ Teams fetched:", teams.length, "record(s)");

    if (teams.length === 0) {
      console.log("⚠️ No teams found for quiz_id:", quiz_id);
      return res.json([]);
    }

    res.json(teams);
  } catch (err) {
    console.error("❌ SQL Error loading teams:", err.message);
    res.status(500).json({ error: "Failed to load teams", details: err.message });
  }
});

// GET /api/quiz/:quizId/teams
app.get("/api/quiz/:quizId/teams", async (req, res) => {
  const { quizId } = req.params;

  // Get the quiz
  const [quizRows] = await db.execute(`SELECT * FROM games WHERE id = ?`, [quizId]);
  const quiz = quizRows[0];
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });

  // Only return teams if quiz is active
  if (quiz.status !== "active") {
    return res.json({ teams: [] });
  }

  const [teams] = await db.execute(`SELECT * FROM teams WHERE quiz_id = ?`, [quizId]);
  res.json({ teams });
});

//IO  CONNECTION
io.on("connection", (socket) => {
  console.log(`🟢 Client connected: ${socket.id}`);

  // --- Join room
  socket.on("joinRoom", ({ gameId }) => {
    if (!gameId) return;
    const roomName = `game:${gameId}`;
    socket.join(roomName);
    console.log(`📢 ${socket.id} joined room ${roomName}`);
  });

  // --- Controller starts countdown
// --- Receive controller start
socket.on("controller:start_countdown", ({ gameId, scheduledStart }) => {
  if (!gameId || !scheduledStart) return;
  console.log(`⏱ Countdown started for game ${gameId}: ${scheduledStart}`);

  // Emit to the correct room
  io.to(`game:${gameId}`).emit("controller:start_countdown", { gameId, scheduledStart });
});

  // --- Controller selects quiz
  socket.on("controller:selected_quiz", ({ gameId }) => {
    if (!gameId) return;
    const roomName = `game:${gameId}`;
    console.log(`🎯 Controller selected quiz ${gameId}`);
    io.to(roomName).emit("controller:selected_quiz", { gameId });
  });

  // --- Disconnect
  socket.on("disconnect", () => {
    console.log(`❎ Client disconnected: ${socket.id}`);
  });
});

// ===============================
// GET latest countdown for a game
// ===============================
app.get('/api/latest-countdown', async (req, res) => {
  try {
    const { gameId } = req.query;

    if (!gameId) return res.status(400).json({ error: "gameId is required" });

    const [rows] = await db.execute(
      `SELECT scheduled_start_at 
       FROM games 
       WHERE id = ? 
       LIMIT 1`,
      [gameId]
    );

    if (rows.length === 0) return res.json({ scheduledStart: null });

    res.json({ scheduledStart: rows[0].scheduled_start_at });
  } catch (err) {
    console.error("❌ Error in /api/latest-countdown:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// POST /api/start-countdown
// ===============================
app.post('/api/start-countdown', async (req, res) => {
  try {
    const { gameId, scheduledStart } = req.body;
    if (!gameId || !scheduledStart) {
      return res.status(400).json({ error: "gameId and scheduledStart are required" });
    }

    // Save scheduledStart in DB (optional)
    await db.execute(
      `UPDATE games SET scheduled_start_at = ? WHERE id = ?`,
      [scheduledStart, gameId]
    );

    // Emit countdown to quiz clients
    io.to(`game:${gameId}`).emit('controller:start_countdown', { gameId, scheduledStart });

    res.json({ message: "Countdown started", gameId, scheduledStart });
  } catch (err) {
    console.error("❌ /api/start-countdown error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// POST /api/start-quiz-now
// ===============================
app.post("/api/start-quiz-now", (req, res) => {
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: "Missing gameId" });

  console.log("🎬 Triggering START QUIZ for game:", gameId);

  // Emit to the specific room
  io.to(gameId).emit("quiz:start_now", { gameId });

  res.json({ success: true });
});


// POST /api/set-active-game
app.post("/api/set-active-game", async (req, res) => {
  try {
    const { gameId, scheduledStart } = req.body;
    if (!gameId) {
      return res.status(400).json({ error: "Missing gameId or scheduledStart" });
    }

    // Store active game in memory (or DB if you want persistence)
    global.activeGame = { gameId, scheduledStart };

    res.json({ success: true, message: "Active game set successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to set active game" });
  }
});

// GET /api/active-game
app.get("/api/active-game", (req, res) => {
  if (!global.activeGame) {
    return res.json({ gameId: null, scheduledStart: null });
  }
  res.json(global.activeGame);
});
