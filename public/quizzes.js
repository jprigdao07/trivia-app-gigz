// script.js
const { useState } = React;
const { BrowserRouter: Router, Routes, Route, useNavigate, useParams } = ReactRouterDOM;

// --- Round Data ---
const roundData = {
  '1': {
    title: 'Round 1',
    category: 'American History',
    questions: [
      { text: 'Who was president during the Korean War?', type: 'text' },
      { text: 'During which event in Washington State was Harry R. Truman likely the first person to die?', type: 'text' },
      {
        text: 'Which energy company had the biggest accounting fraud in 2001?',
        type: 'mc',
        options: ['Enron', 'Exxon', 'PG&E']
      }
    ]
  },
  '2': {
    title: 'Round 2',
    category: 'Geography',
    questions: [
      { text: 'What ocean borders Brazil?', type: 'text' },
      { text: 'What is the capital of Northern Ireland?', type: 'text' },
      {
        text: 'What is the name of the volcano in Hawaii that is constantly spewing lava?',
        type: 'mc',
        options: ['Mauna Kea', 'Mauna Loa', 'Kilauea']
      }
    ]
  },
  // ... Continue for rounds 3 to 14
};

// --- Landing Page ---
function LandingPage() {
  const [gameId, setGameId] = useState('');
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/rules');
  };

  return (
    <div className="slide-container">
      <h1>Welcome to 5 Star Trivia</h1>
      <div className="input-group">
        <label>Game ID:</label>
        <input
          type="text"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="game-id-input"
        />
      </div>
      <button onClick={handleStart} className="primary-button">Start</button>
    </div>
  );
}

// --- Rules Page ---
function RulesPage() {
  const navigate = useNavigate();
  const rulesList = [
    'VERY IMPORTANT!! No use of cell phones or other outside reference materials.',
    'Please do not call out any answers (even if you are just trying to be funny).',
    'No collaborating with other teams.',
    'Once an answer sheet has been turned in, teams may NOT change their answer unless instructed to do so by the host.',
    'The trivia host will have final say in all circumstances during play.',
    'No one from your group can leave and come back in while the score cards are out.'
  ];

  return (
    <div className="slide-container">
      <h2>Rules</h2>
      <ol>
        {rulesList.map((rule, idx) => (
          <li key={idx}>{rule}</li>
        ))}
      </ol>
      <button onClick={() => navigate('/round/1')} className="primary-button">Next</button>
    </div>
  );
}

// --- Round Page ---
function RoundPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = roundData[id];
  const nextId = parseInt(id, 10) + 1;
  const hasNext = !!roundData[String(nextId)];

  if (!data) {
    return (
      <div className="slide-container">
        <h2>Round Not Found</h2>
        <p>No question available</p>
      </div>
    );
  }

  return (
    <div className="slide-container">
      <h2>{data.title}</h2>
      <h3>{data.category}</h3>
      <div className="questions-list">
        {data.questions.map((q, index) => (
          <div key={index} className="question-item">
            <p className="question-text">#{index + 1} {q.text}</p>
            {q.type === 'mc' && (
              <ul className="options-list">
                {q.options.map((opt, idx) => (
                  <li key={idx}>{String.fromCharCode(65 + idx)}. {opt}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {hasNext && (
        <button
          onClick={() => navigate(`/round/${nextId}`)}
          className="primary-button"
        >
          Next Round
        </button>
      )}
    </div>
  );
}

// --- Main App ---
function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/round/:id" element={<RoundPage />} />
    </Routes>
  );
}

// --- Render React to HTML ---
const root = ReactDOM.createRoot(document.getElementById('previewBox'));
root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
