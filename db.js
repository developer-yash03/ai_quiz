import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'quiz_db',
  connectionTimeoutMillis: 3000,
});

export let isConnectedToPostgres = false;

const memoryStore = {
  users: [],
  quizzes: [],
  questions: [],
  user_answers: [],
  seq: { users: 1, quizzes: 1, questions: 1, user_answers: 1 }
};

export async function initDB() {
  try {
    const client = await pool.connect();
    isConnectedToPostgres = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quizzes (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        topic VARCHAR(100) NOT NULL,
        score INT DEFAULT 0,
        total_questions INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer VARCHAR(5) NOT NULL,
        explanation TEXT
      );

      CREATE TABLE IF NOT EXISTS user_answers (
        id SERIAL PRIMARY KEY,
        quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        selected_answer VARCHAR(5) NOT NULL,
        is_correct BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    client.release();
  } catch (err) {
    isConnectedToPostgres = false;
  }
}

export async function query(text, params = []) {
  if (isConnectedToPostgres) {
    return await pool.query(text, params);
  }

  const sql = text.trim();

  if (sql.includes('INSERT INTO users')) {
    const username = params[0];
    let user = memoryStore.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      user = { id: memoryStore.seq.users++, username, created_at: new Date() };
      memoryStore.users.push(user);
    }
    return { rows: [user] };
  }

  if (sql.includes('INSERT INTO quizzes')) {
    const [userId, topic, total] = params;
    const quiz = {
      id: memoryStore.seq.quizzes++,
      user_id: userId,
      topic,
      score: 0,
      total_questions: total || 5,
      created_at: new Date()
    };
    memoryStore.quizzes.push(quiz);
    return { rows: [quiz] };
  }

  if (sql.includes('INSERT INTO questions')) {
    const [quizId, qText, options, correct, explanation] = params;
    const q = {
      id: memoryStore.seq.questions++,
      quiz_id: quizId,
      question_text: qText,
      options: typeof options === 'string' ? JSON.parse(options) : options,
      correct_answer: correct,
      explanation
    };
    memoryStore.questions.push(q);
    return { rows: [q] };
  }

  if (sql.includes('UPDATE quizzes SET score')) {
    const [score, quizId] = params;
    const quiz = memoryStore.quizzes.find(q => q.id === parseInt(quizId));
    if (quiz) quiz.score = score;
    return { rows: [quiz] };
  }

  if (sql.includes('INSERT INTO user_answers')) {
    const [quizId, qId, selected, isCorrect] = params;
    const ans = {
      id: memoryStore.seq.user_answers++,
      quiz_id: quizId,
      question_id: qId,
      selected_answer: selected,
      is_correct: isCorrect,
      created_at: new Date()
    };
    memoryStore.user_answers.push(ans);
    return { rows: [ans] };
  }

  if (sql.includes('FROM quizzes q') && sql.includes('JOIN questions')) {
    const quizId = params[0];
    const quiz = memoryStore.quizzes.find(q => q.id === parseInt(quizId));
    const user = memoryStore.users.find(u => u.id === (quiz ? quiz.user_id : null));
    const questions = memoryStore.questions.filter(q => q.quiz_id === parseInt(quizId));

    const rows = questions.map(k => {
      const ans = memoryStore.user_answers.find(a => a.quiz_id === parseInt(quizId) && a.question_id === k.id);
      return {
        quiz_id: quiz ? quiz.id : quizId,
        topic: quiz ? quiz.topic : '',
        username: user ? user.username : 'Anonymous',
        score: quiz ? quiz.score : 0,
        question_id: k.id,
        question_text: k.question_text,
        options: k.options,
        correct_answer: k.correct_answer,
        explanation: k.explanation,
        selected_answer: ans ? ans.selected_answer : null,
        is_correct: ans ? ans.is_correct : null
      };
    });
    return { rows };
  }

  if (sql.includes('FROM users u') && sql.includes('LEFT JOIN quizzes q')) {
    const rows = memoryStore.users.map(u => {
      const userQuizzes = memoryStore.quizzes.filter(q => q.user_id === u.id);
      const totalQuizzes = userQuizzes.length;
      const totalScore = userQuizzes.reduce((sum, q) => sum + (q.score || 0), 0);
      const avgScore = totalQuizzes > 0 ? (totalScore / totalQuizzes).toFixed(1) : '0.0';
      return {
        username: u.username,
        total_quizzes_taken: totalQuizzes,
        total_score: totalScore,
        avg_score: avgScore
      };
    }).sort((a, b) => b.total_score - a.total_score);

    return { rows };
  }

  return { rows: [] };
}
