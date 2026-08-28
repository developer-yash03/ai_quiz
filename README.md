# ⚡ AI Quiz Generator

A lightweight, clean full-stack MCQ Quiz Generator designed to demonstrate core engineering concepts:
1. **LLM API Integration & Prompt Engineering**
2. **Structured Outputs (JSON Schema)**
3. **PostgreSQL Relational Schema (Primary & Foreign Keys)**
4. **Multi-Table & Aggregate SQL JOINs**
5. **JavaScript `async` / `await`**
6. **JavaScript Closures (State Encapsulation)**

---

## 🎯 Architecture & Concepts Overview

### 1. Relational Schema & Constraints ([schema.sql](file:///d:/ai_quiz/schema.sql))
- **`users`**: `(id SERIAL PRIMARY KEY, username VARCHAR UNIQUE)`
- **`quizzes`**: `(id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, topic, score)`
- **`questions`**: `(id SERIAL PRIMARY KEY, quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE, question_text, options JSONB, correct_answer, explanation)`
- **`user_answers`**: `(id SERIAL PRIMARY KEY, quiz_id INT REFERENCES quizzes(id), question_id INT REFERENCES questions(id), selected_answer, is_correct)`

### 2. SQL JOINs ([server.js](file:///d:/ai_quiz/server.js))
- **Multi-table Join (3 tables)**:
  ```sql
  SELECT q.id AS quiz_id, q.topic, u.username, k.question_text, k.options, a.selected_answer, a.is_correct
  FROM quizzes q
  INNER JOIN users u ON q.user_id = u.id
  INNER JOIN questions k ON q.id = k.quiz_id
  LEFT JOIN user_answers a ON k.id = a.question_id AND q.id = a.quiz_id
  WHERE q.id = $1;
  ```
- **Aggregate Leaderboard Join**:
  ```sql
  SELECT u.username, COUNT(q.id) AS total_quizzes, SUM(q.score) AS total_score, ROUND(AVG(q.score), 1) AS avg_score
  FROM users u
  LEFT JOIN quizzes q ON u.id = q.user_id
  GROUP BY u.id, u.username ORDER BY total_score DESC;
  ```

### 3. JavaScript Closures ([llm.js](file:///d:/ai_quiz/llm.js), [server.js](file:///d:/ai_quiz/server.js), [app.js](file:///d:/ai_quiz/public/app.js))
- **Client Quiz Controller Closure (`createQuizController`)**: Encapsulates active question index, timer ticks, and answers privately without polluting global window scope.
- **Server Score Evaluator Closure (`createScoreEvaluator`)**: Encapsulates processed quiz counts and evaluation telemetry.
- **Prompt Builder Closure (`createPromptBuilder`)**: Encapsulates call counts and generation history.

### 4. LLM Integration & Structured Output ([llm.js](file:///d:/ai_quiz/llm.js))
- Uses engineered prompts enforcing strict schema constraint:
  ```json
  [
    {
      "question": "Question text",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct_answer": "A",
      "explanation": "Why A is correct"
    }
  ]
  ```
- Supports Google Gemini API & OpenAI API, plus a built-in smart fallback generator when no API key is supplied for immediate zero-friction testing.

### 5. JS `async` / `await`
- Used across all database operations (`await query(...)`), LLM network calls (`await fetch(...)`), and client UI event handlers (`await fetch('/api/quiz/generate')`).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(If PostgreSQL is not running locally, the app will automatically switch to the simulated in-memory relational engine so you can test immediately!)*

### 3. Start the Server
```bash
npm start
```
Open **`http://localhost:3000`** in your browser.
