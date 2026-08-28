import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, query, isConnectedToPostgres } from './db.js';
import { generateMCQsWithLLM, promptEngine } from './llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * ============================================================================
 * JAVASCRIPT CLOSURE: Quiz Scoring & Performance Evaluator
 * Demonstrates closure by maintaining private score accumulator and audit log
 * ============================================================================
 */
function createScoreEvaluator() {
  let processedCount = 0;

  return function evaluate(questions, userAnswers) {
    processedCount++;
    let score = 0;
    const results = [];

    for (const q of questions) {
      const selected = userAnswers[q.id];
      const isCorrect = selected === q.correct_answer;
      if (isCorrect) score++;

      results.push({
        questionId: q.id,
        question: q.question_text,
        selectedAnswer: selected || 'None',
        correctAnswer: q.correct_answer,
        isCorrect,
        explanation: q.explanation
      });
    }

    return {
      score,
      total: questions.length,
      percentage: Math.round((score / questions.length) * 100),
      evaluationId: `EV-${processedCount}`,
      results
    };
  };
}

const scoreEvaluator = createScoreEvaluator();

// ============================================================================
// API ROUTES (Demonstrating JS async/await, SQL Joins & Relational Schema)
// ============================================================================

/**
 * 1. Generate Quiz & Save to PostgreSQL Relational Tables
 * Uses async/await and PK/FK relationships
 */
app.post('/api/quiz/generate', async (req, res) => {
  try {
    const { topic, username = 'Anonymous', apiKey } = req.body;
    if (!topic || topic.trim() === '') {
      return res.status(400).json({ error: 'Topic is required' });
    }

    // Step A: Insert or get User (Parent Table)
    const userResult = await query(
      `INSERT INTO users (username) VALUES ($1)
       ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
       RETURNING id, username`,
      [username.trim()]
    );
    const user = userResult.rows[0];

    // Step B: Generate 5 Structured MCQs using LLM with prompt engineering
    const mcqs = await generateMCQsWithLLM(topic.trim(), apiKey);

    // Step C: Insert Quiz Record (Child Table referencing users.id as FK)
    const quizResult = await query(
      `INSERT INTO quizzes (user_id, topic, total_questions)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, topic, total_questions, created_at`,
      [user.id, topic.trim(), mcqs.length]
    );
    const quiz = quizResult.rows[0];

    // Step D: Insert 5 Questions (Child Table referencing quizzes.id as FK)
    const savedQuestions = [];
    for (const q of mcqs) {
      const qResult = await query(
        `INSERT INTO questions (quiz_id, question_text, options, correct_answer, explanation)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, quiz_id, question_text, options, correct_answer, explanation`,
        [quiz.id, q.question, JSON.stringify(q.options), q.correct_answer, q.explanation]
      );
      savedQuestions.push(qResult.rows[0]);
    }

    // Return to client (omit correct_answer for quiz integrity before submission)
    const clientQuestions = savedQuestions.map(q => ({
      id: q.id,
      question: q.question_text,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
    }));

    res.json({
      success: true,
      quizId: quiz.id,
      topic: quiz.topic,
      username: user.username,
      questions: clientQuestions
    });
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({ error: 'Failed to generate quiz', details: err.message });
  }
});

/**
 * 2. Submit Answers, Evaluate via Closure, & Store in PostgreSQL
 */
app.post('/api/quiz/submit', async (req, res) => {
  try {
    const { quizId, answers } = req.body;
    if (!quizId || !answers) {
      return res.status(400).json({ error: 'Quiz ID and answers are required' });
    }

    // Retrieve questions for this quiz from PostgreSQL
    const questionsResult = await query(
      `SELECT id, question_text, correct_answer, explanation FROM questions WHERE quiz_id = $1`,
      [quizId]
    );
    const questions = questionsResult.rows;

    // Evaluate answers using JS Closure
    const evaluation = scoreEvaluator(questions, answers);

    // Update Quiz score in PostgreSQL
    await query(`UPDATE quizzes SET score = $1 WHERE id = $2`, [evaluation.score, quizId]);

    // Save individual user answers into user_answers table with FKs
    for (const result of evaluation.results) {
      await query(
        `INSERT INTO user_answers (quiz_id, question_id, selected_answer, is_correct)
         VALUES ($1, $2, $3, $4)`,
        [quizId, result.questionId, result.selectedAnswer, result.isCorrect]
      );
    }

    res.json({
      success: true,
      quizId,
      evaluation
    });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Submission failed', details: err.message });
  }
});

/**
 * 3. SQL JOIN Demo: Get Full Quiz Breakdown with Multi-Table Joins
 * Demonstrates: INNER JOIN & LEFT JOIN across 3 relational tables
 */
app.get('/api/quiz/:id/details', async (req, res) => {
  try {
    const quizId = parseInt(req.params.id);

    // Multi-table SQL JOIN: users + quizzes + questions + user_answers
    const sqlJoinQuery = `
      SELECT 
        q.id AS quiz_id,
        q.topic,
        q.score,
        q.total_questions,
        u.username,
        k.id AS question_id,
        k.question_text,
        k.options,
        k.correct_answer,
        k.explanation,
        a.selected_answer,
        a.is_correct
      FROM quizzes q
      INNER JOIN users u ON q.user_id = u.id
      INNER JOIN questions k ON q.id = k.quiz_id
      LEFT JOIN user_answers a ON k.id = a.question_id AND q.id = a.quiz_id
      WHERE q.id = $1;
    `;

    const result = await query(sqlJoinQuery, [quizId]);
    res.json({
      success: true,
      sqlQuery: sqlJoinQuery.trim(),
      data: result.rows
    });
  } catch (err) {
    console.error('Details fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch details', details: err.message });
  }
});

/**
 * 4. SQL JOIN Demo: Leaderboard with Aggregation JOIN
 * Demonstrates: LEFT JOIN + COUNT + SUM + AVG + GROUP BY
 */
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboardQuery = `
      SELECT 
        u.username,
        COUNT(q.id) AS total_quizzes_taken,
        COALESCE(SUM(q.score), 0) AS total_score,
        ROUND(AVG(q.score), 1) AS avg_score
      FROM users u
      LEFT JOIN quizzes q ON u.id = q.user_id
      GROUP BY u.id, u.username
      ORDER BY total_score DESC;
    `;

    const result = await query(leaderboardQuery);
    res.json({
      success: true,
      sqlQuery: leaderboardQuery.trim(),
      leaderboard: result.rows
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard', details: err.message });
  }
});

/**
 * 5. Telemetry & Environment Status
 */
app.get('/api/status', (req, res) => {
  res.json({
    postgresConnected: isConnectedToPostgres,
    llmStats: promptEngine.getStats(),
    nodeVersion: process.version
  });
});

// Start Server & Initialize Database
async function startServer() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`🚀 AI Quiz Generator running at http://localhost:${PORT}`);
  });
}

startServer();
