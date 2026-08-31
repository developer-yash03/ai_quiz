const { useState, useEffect, useRef } = React;
const { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } = ReactRouterDOM;

function createQuizSession(quizData) {
  const { quizId, topic, username, questions } = quizData;
  let currentIndex = 0;
  const answers = {};

  return {
    getQuizId: () => quizId,
    getTopic: () => topic,
    getUsername: () => username,
    getTotal: () => questions.length,
    getCurrentIndex: () => currentIndex,
    getCurrentQuestion: () => questions[currentIndex],
    selectAnswer: (key) => { answers[questions[currentIndex].id] = key; },
    getSelectedAnswer: () => answers[questions[currentIndex].id] || null,
    hasAnswered: () => Boolean(answers[questions[currentIndex].id]),
    canNext: () => currentIndex < questions.length - 1,
    canPrev: () => currentIndex > 0,
    isLast: () => currentIndex === questions.length - 1,
    next: () => { if (currentIndex < questions.length - 1) currentIndex++; },
    prev: () => { if (currentIndex > 0) currentIndex--; },
    getPayload: () => ({ quizId, answers: { ...answers } })
  };
}

function Header({ dbConnected }) {
  return (
    <header className="app-header">
      <div className="logo-group">
        <div className="logo-icon">⚡</div>
        <div>
          <h1 className="logo-title">AI Quiz Generator</h1>
          <p className="logo-subtitle">React Router • PostgreSQL Joins • LLM JSON • Closures & Hoisting</p>
        </div>
      </div>
      <div className="header-badges">
        <span className={`badge ${dbConnected ? 'badge-success' : 'badge-warning'}`}>
          {dbConnected ? '● PostgreSQL Connected' : '● In-Memory Relational Engine'}
        </span>
        <span className="badge badge-info">5 MCQs / Topic</span>
      </div>
    </header>
  );
}

function Navigation() {
  return (
    <nav className="nav-tabs">
      <NavLink to="/" className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`} end>
        🎯 Quiz Studio
      </NavLink>
      <NavLink to="/joins" className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}>
        🔍 SQL Joins
      </NavLink>
      <NavLink to="/leaderboard" className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}>
        🏆 Leaderboard
      </NavLink>
      <NavLink to="/hoisting" className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}>
        ⚡ Hoisting Lab (let / const)
      </NavLink>
      <NavLink to="/concepts" className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}>
        📚 Code Concepts
      </NavLink>
    </nav>
  );
}

function QuizStudio({ onQuizCompleted, lastQuizId }) {
  const [topic, setTopic] = useState('JavaScript Closures & Hoisting');
  const [username, setUsername] = useState('Alex');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [questionVersion, setQuestionVersion] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  useEffect(() => {
    if (session && !results) {
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, results]);

  async function handleGenerate(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, username, apiKey: apiKey || null })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate');
      
      const newSession = createQuizSession(data);
      setSession(newSession);
      setResults(null);
      setQuestionVersion(v => v + 1);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!session) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session.getPayload())
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Submission failed');
      
      setResults(data.evaluation);
      onQuizCompleted(data.quizId);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  if (results) {
    return (
      <div className="card glass-card">
        <div className="results-header">
          <div className="score-circle">
            <span id="score-number">{results.score}/{results.total}</span>
            <span id="score-percentage">{results.percentage}%</span>
          </div>
          <div>
            <h2>{results.percentage >= 80 ? '🎉 Excellent Job!' : results.percentage >= 60 ? '👍 Good Effort!' : '📚 Keep Practicing!'}</h2>
            <p className="card-desc">Relational PostgreSQL record updated.</p>
          </div>
        </div>

        <div className="breakdown-list">
          {results.results.map((r, i) => (
            <div key={i} className={`breakdown-item ${r.isCorrect ? 'correct' : 'incorrect'}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>Q{i + 1}: {r.question}</strong>
                <span>{r.isCorrect ? '✅ Correct' : '❌ Incorrect'}</span>
              </div>
              <div>
                <span className={`badge ${r.isCorrect ? 'badge-success' : 'badge-warning'}`}>Your: {r.selectedAnswer}</span>
                <span className="badge badge-info" style={{ marginLeft: 8 }}>Correct: {r.correctAnswer}</span>
              </div>
              <div className="breakdown-explanation">💡 <strong>Explanation:</strong> {r.explanation}</div>
            </div>
          ))}
        </div>

        <div className="results-actions">
          <button className="btn btn-primary" onClick={() => { setSession(null); setResults(null); }}>Create Another Quiz</button>
          <button className="btn btn-secondary" onClick={() => navigate('/joins')}>Inspect Joined SQL Rows 🔍</button>
        </div>
      </div>
    );
  }

  if (session) {
    const q = session.getCurrentQuestion();
    const currIdx = session.getCurrentIndex();
    const total = session.getTotal();
    const selected = session.getSelectedAnswer();

    return (
      <div className="card glass-card">
        <div className="quiz-header">
          <div>
            <span className="badge badge-accent">{session.getTopic()}</span>
            <h2 className="quiz-title">Question {currIdx + 1} of {total}</h2>
          </div>
          <div className="quiz-timer-pill">⏱️ {formatTime(seconds)}</div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${((currIdx + 1) / total) * 100}%` }}></div>
        </div>

        <div className="question-container">
          <h3 className="question-text">{q.question}</h3>
          <div className="options-grid">
            {Object.entries(q.options).map(([key, text]) => (
              <button
                key={key}
                className={`option-btn ${selected === key ? 'selected' : ''}`}
                onClick={() => {
                  session.selectAnswer(key);
                  setQuestionVersion(v => v + 1);
                }}
              >
                <span className="option-key">{key}</span>
                <span className="option-label">{text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="quiz-actions">
          <button
            className="btn btn-secondary"
            disabled={!session.canPrev()}
            onClick={() => { session.prev(); setQuestionVersion(v => v + 1); }}
          >
            ← Previous
          </button>

          {!session.isLast() ? (
            <button
              className="btn btn-secondary"
              onClick={() => { session.next(); setQuestionVersion(v => v + 1); }}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn btn-success"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Scoring...' : 'Submit & Score Quiz 🚀'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card glass-card">
      <h2 className="card-title">Generate a 5-Question MCQ Quiz</h2>
      <p className="card-desc">Enter any topic. The system generates structured JSON with 5 questions and saves to PostgreSQL.</p>
      
      <form onSubmit={handleGenerate} className="form-grid">
        <div className="form-group">
          <label>Topic</label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. JavaScript Hoisting, Python Async, SQL Indexes..."
            required
          />
        </div>

        <div className="form-group">
          <label>Your Name</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="e.g. Alex"
          />
        </div>

        <div className="form-group full-width">
          <label className="optional-label">
            Gemini / OpenAI API Key <span>(Optional - Built-in fallback active if blank)</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Optional API Key"
          />
        </div>

        <button type="submit" className="btn btn-primary full-width" disabled={loading}>
          {loading ? '⏳ Generating 5 Structured MCQs...' : 'Generate 5 MCQs with AI'}
        </button>
      </form>
    </div>
  );
}

function SqlJoins({ lastQuizId }) {
  const [data, setData] = useState([]);
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadJoins() {
    if (!lastQuizId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/quiz/${lastQuizId}/details`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setSql(json.sqlQuery);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJoins();
  }, [lastQuizId]);

  return (
    <div className="card glass-card">
      <div className="card-header-flex">
        <div>
          <h2 className="card-title">Relational Schema & SQL Joins Inspector</h2>
          <p className="card-desc">Live multi-table query joining <code>quizzes</code>, <code>users</code>, <code>questions</code>, and <code>user_answers</code>.</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={loadJoins} disabled={loading}>
          {loading ? 'Running...' : '🔄 Run SQL Join'}
        </button>
      </div>

      <div className="code-box">
        <div className="code-box-header">SQL QUERY (INNER JOIN + LEFT JOIN)</div>
        <pre><code>{sql || `SELECT 
  q.id AS quiz_id, q.topic, q.score, u.username,
  k.id AS question_id, k.question_text, k.options, k.correct_answer,
  a.selected_answer, a.is_correct
FROM quizzes q
INNER JOIN users u ON q.user_id = u.id
INNER JOIN questions k ON q.id = k.quiz_id
LEFT JOIN user_answers a ON k.id = a.question_id AND q.id = a.quiz_id
WHERE q.id = $1;`}</code></pre>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Quiz ID (PK)</th>
              <th>Topic</th>
              <th>Username (FK: users)</th>
              <th>Q#</th>
              <th>Question Text</th>
              <th>Correct</th>
              <th>User Answer</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((row, idx) => (
                <tr key={idx}>
                  <td><strong>#{row.quiz_id}</strong></td>
                  <td>{row.topic}</td>
                  <td><code>{row.username}</code></td>
                  <td>{idx + 1}</td>
                  <td>{row.question_text}</td>
                  <td><span className="badge badge-success">{row.correct_answer}</span></td>
                  <td><span className={`badge ${row.is_correct ? 'badge-success' : 'badge-warning'}`}>{row.selected_answer || 'None'}</span></td>
                  <td>{row.is_correct ? '✅ Correct' : '❌ Incorrect'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center text-muted">
                  {lastQuizId ? 'No records returned for quiz.' : 'Generate and submit a quiz in Quiz Studio first to inspect joined rows.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [sql, setSql] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadLeaderboard() {
    setLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      const json = await res.json();
      if (json.success) {
        setLeaders(json.leaderboard);
        setSql(json.sqlQuery);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard();
  }, []);

  return (
    <div className="card glass-card">
      <div className="card-header-flex">
        <div>
          <h2 className="card-title">User Performance Leaderboard</h2>
          <p className="card-desc">SQL aggregate query using <code>LEFT JOIN</code>, <code>COUNT()</code>, <code>SUM()</code>, and <code>GROUP BY</code>.</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={loadLeaderboard} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      <div className="code-box">
        <div className="code-box-header">AGGREGATE SQL JOIN QUERY</div>
        <pre><code>{sql || `SELECT 
  u.username,
  COUNT(q.id) AS total_quizzes_taken,
  COALESCE(SUM(q.score), 0) AS total_score,
  ROUND(AVG(q.score), 1) AS avg_score
FROM users u
LEFT JOIN quizzes q ON u.id = q.user_id
GROUP BY u.id, u.username
ORDER BY total_score DESC;`}</code></pre>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Username</th>
              <th>Quizzes Taken</th>
              <th>Total Points</th>
              <th>Avg Score</th>
            </tr>
          </thead>
          <tbody>
            {leaders.length > 0 ? (
              leaders.map((u, i) => (
                <tr key={i}>
                  <td><strong>#{i + 1}</strong></td>
                  <td><code>{u.username}</code></td>
                  <td>{u.total_quizzes_taken}</td>
                  <td><strong>{u.total_score} pts</strong></td>
                  <td>{u.avg_score} / 5.0</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center text-muted">No quiz data yet. Take a quiz!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HoistingLab() {
  const [serverHoistingResults, setServerHoistingResults] = useState(null);

  useEffect(() => {
    fetch('/api/hoisting-demo')
      .then(r => r.json())
      .then(setServerHoistingResults)
      .catch(console.error);
  }, []);

  return (
    <div className="concepts-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className="card glass-card">
        <h3>1. `let` Hoisting & Temporal Dead Zone (TDZ)</h3>
        <p className="card-desc">`let` declarations are hoisted into block scope but remain uninitialized in the TDZ.</p>
        <div className="code-box">
          <div className="code-box-header">CONCRETE CODE SNIPPET (let)</div>
          <pre><code>{`// Accessing 'num' in its TDZ throws ReferenceError:
try {
  console.log(num); // Throws ReferenceError!
  let num = 42;     // TDZ ends here
} catch (err) {
  console.log(err.name); // "ReferenceError"
  console.log(err.message); // "Cannot access 'num' before initialization"
}`}</code></pre>
        </div>
        {serverHoistingResults?.letDemo && (
          <div className="breakdown-explanation" style={{ borderLeft: '3px solid var(--accent-rose)' }}>
            <strong>Live Output:</strong> <code>{serverHoistingResults.letDemo.errorName}: {serverHoistingResults.letDemo.errorMessage}</code>
          </div>
        )}
      </div>

      <div className="card glass-card">
        <h3>2. `const` Hoisting & Immutable Binding</h3>
        <p className="card-desc">`const` is also hoisted in the TDZ, requires initialization at declaration, and cannot be reassigned.</p>
        <div className="code-box">
          <div className="code-box-header">CONCRETE CODE SNIPPET (const)</div>
          <pre><code>{`// 1. TDZ ReferenceError on pre-access:
try {
  console.log(PI); // Throws ReferenceError!
  const PI = 3.14159;
} catch (err) {
  console.log(err.name); // "ReferenceError"
}

// 2. SyntaxError if declared without initializer:
// const TAX_RATE; // SyntaxError: Missing initializer

// 3. TypeError on reassignment:
const MAX = 100;
// MAX = 200; // TypeError: Assignment to constant variable`}</code></pre>
        </div>
        {serverHoistingResults?.constDemo && (
          <div className="breakdown-explanation" style={{ borderLeft: '3px solid var(--accent-amber)' }}>
            <strong>Live Output:</strong> <code>{serverHoistingResults.constDemo.errorName}: {serverHoistingResults.constDemo.errorMessage}</code>
          </div>
        )}
      </div>

      <div className="card glass-card">
        <h3>3. `var` vs `let` / `const` Hoisting Comparison</h3>
        <p className="card-desc">`var` is initialized to `undefined` during the compilation phase, while `let`/`const` stay uninitialized.</p>
        <div className="code-box">
          <div className="code-box-header">CONCRETE CODE COMPARISON</div>
          <pre><code>{`// var behavior (initialized to undefined):
console.log(v); // Output: undefined
var v = 10;

// let behavior (uninitialized / TDZ):
console.log(l); // ReferenceError: Cannot access 'l'
let l = 10;`}</code></pre>
        </div>
      </div>

      <div className="card glass-card">
        <h3>4. Block Scope & Variable Shadowing</h3>
        <p className="card-desc">`let` and `const` create fresh lexical bindings inside `{ ... }` blocks without polluting outer scopes.</p>
        <div className="code-box">
          <div className="code-box-header">BLOCK SCOPING SNIPPET</div>
          <pre><code>{`const scopeVal = "global";
{
  // Inner block shadows outer variable:
  const scopeVal = "block-scoped";
  console.log(scopeVal); // "block-scoped"
}
console.log(scopeVal);   // "global"`}</code></pre>
        </div>
      </div>
    </div>
  );
}

function Concepts() {
  return (
    <div className="concepts-grid">
      <div className="card glass-card">
        <h3>🔒 1. JavaScript Closures</h3>
        <p className="card-desc">Enables inner functions to access and protect outer function variables after completion.</p>
        <div className="code-box">
          <pre><code>{`function createQuizSession(quizData) {
  let currentIndex = 0; // Private state
  const answers = {};   // Private state

  return {
    selectAnswer(qId, key) { answers[qId] = key; },
    getAnswers() { return { ...answers }; },
    next() { currentIndex++; }
  };
}`}</code></pre>
        </div>
      </div>

      <div className="card glass-card">
        <h3>⚡ 2. JavaScript async / await</h3>
        <p className="card-desc">Non-blocking asynchronous flow for database and LLM API transactions.</p>
        <div className="code-box">
          <pre><code>{`app.post('/api/quiz/generate', async (req, res) => {
  const user = await query('INSERT INTO users ...');
  const mcqs = await generateMCQsWithLLM(topic);
  const quiz = await query('INSERT INTO quizzes ...');
  res.json({ quizId: quiz.id, mcqs });
});`}</code></pre>
        </div>
      </div>

      <div className="card glass-card">
        <h3>🗄️ 3. Relational Schema (PK & FK)</h3>
        <p className="card-desc">Cascading constraints enforce database consistency.</p>
        <div className="code-box">
          <pre><code>{`CREATE TABLE quizzes (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  topic VARCHAR(100) NOT NULL
);

CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL
);`}</code></pre>
        </div>
      </div>

      <div className="card glass-card">
        <h3>🤖 4. LLM Structured Outputs</h3>
        <p className="card-desc">Engineered prompt enforces strict 5-question JSON array.</p>
        <div className="code-box">
          <pre><code>{`const prompt = \`Generate 5 MCQs on "\${topic}".
Output ONLY JSON:
[
  {
    "question": "...",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correct_answer": "A",
    "explanation": "..."
  }
]\`;`}</code></pre>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [dbConnected, setDbConnected] = useState(false);
  const [lastQuizId, setLastQuizId] = useState(null);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setDbConnected(Boolean(d.postgresConnected)))
      .catch(() => setDbConnected(false));
  }, []);

  return (
    <BrowserRouter>
      <div className="app-container">
        <Header dbConnected={dbConnected} />
        <Navigation />

        <main className="tab-content active" style={{ display: 'block' }}>
          <Routes>
            <Route
              path="/"
              element={<QuizStudio onQuizCompleted={id => setLastQuizId(id)} lastQuizId={lastQuizId} />}
            />
            <Route path="/joins" element={<SqlJoins lastQuizId={lastQuizId} />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/hoisting" element={<HoistingLab />} />
            <Route path="/concepts" element={<Concepts />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <span>AI Quiz Generator</span>
          <span>•</span>
          <span>React Router + PostgreSQL + Closures + Hoisting</span>
        </footer>
      </div>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
