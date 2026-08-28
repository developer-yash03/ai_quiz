-- ============================================================================
-- AI Quiz Generator: Relational Database Schema (PostgreSQL)
-- Demonstrating: Primary Keys (PK), Foreign Keys (FK), and SQL JOINs
-- ============================================================================

-- 1. USERS Table (Parent Table)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,                          -- Primary Key
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. QUIZZES Table (Child of Users)
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,                          -- Primary Key
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Foreign Key
    topic VARCHAR(100) NOT NULL,
    score INT DEFAULT 0,
    total_questions INT DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. QUESTIONS Table (Child of Quizzes)
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,                          -- Primary Key
    quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE, -- Foreign Key
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,                         -- e.g. {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_answer VARCHAR(5) NOT NULL,             -- 'A', 'B', 'C', or 'D'
    explanation TEXT
);

-- 4. USER_ANSWERS Table (Child of Quizzes & Questions)
CREATE TABLE IF NOT EXISTS user_answers (
    id SERIAL PRIMARY KEY,                          -- Primary Key
    quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,     -- Foreign Key
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE, -- Foreign Key
    selected_answer VARCHAR(5) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DEMO SQL JOINS:
-- ============================================================================

-- A. INNER JOIN: Fetch Quiz with User Information
-- SELECT q.id AS quiz_id, q.topic, q.score, u.username, q.created_at
-- FROM quizzes q
-- INNER JOIN users u ON q.user_id = u.id
-- WHERE q.id = $1;

-- B. MULTI-TABLE JOIN (3 Tables): Quiz + Questions + User Answers
-- SELECT 
--     q.topic,
--     k.id AS question_id,
--     k.question_text,
--     k.options,
--     k.correct_answer,
--     k.explanation,
--     a.selected_answer,
--     a.is_correct
-- FROM quizzes q
-- JOIN questions k ON q.id = k.quiz_id
-- LEFT JOIN user_answers a ON k.id = a.question_id AND q.id = a.quiz_id
-- WHERE q.id = $1;

-- C. AGGREGATE JOIN: User Leaderboard with Performance Stats
-- SELECT 
--     u.username,
--     COUNT(q.id) AS total_quizzes_taken,
--     COALESCE(SUM(q.score), 0) AS total_score,
--     ROUND(AVG(q.score), 1) AS avg_score
-- FROM users u
-- LEFT JOIN quizzes q ON u.id = q.user_id
-- GROUP BY u.id, u.username
-- ORDER BY total_score DESC;
