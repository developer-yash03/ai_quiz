# Product Requirements Document (PRD)
## AI-Powered MCQ Quiz Generator

---

## 1. Overview
The **AI-Powered MCQ Quiz Generator** is a full-stack educational web application that automatically generates interactive 5-question multiple-choice quizzes for any user-specified topic. It demonstrates structured LLM prompt engineering, relational PostgreSQL storage, SQL JOIN analytics, asynchronous JavaScript execution, and closure-based state management.

---

## 2. Objectives & Goals
- Provide on-demand, customized 5-question MCQ assessments on any topic.
- Deliver structured JSON outputs from Large Language Models (LLMs) with 4 options (A, B, C, D), single correct answers, and explanations.
- Store user data, quiz sessions, questions, and submission results in a normalized relational database (PostgreSQL).
- Provide real-time quiz taking, scoring, and instant performance feedback.
- Offer relational data inspection via multi-table and aggregate SQL JOIN queries.

---

## 3. Target Audience & User Personas
- **Students & Learners**: Individuals who want quick, targeted quizzes to test their knowledge on specific academic or technical subjects.
- **Instructors / Educators**: Professionals who need quick assessment templates for specific subjects.
- **Engineers / Evaluators**: Developers reviewing practical implementations of LLM structured outputs, relational schema constraints, and JavaScript paradigms.

---

## 4. User Journey & Workflow
1. **Topic Entry**: User enters a topic, username, and optional API key.
2. **Quiz Generation**: The system builds an engineered prompt, requests structured JSON from the LLM, and persists records into PostgreSQL (`users`, `quizzes`, `questions`).
3. **Interactive Quiz**: User completes questions sequentially with interactive option selection, progress bar, and timer.
4. **Submission & Scoring**: The client sends user responses, the server scores answers, records results into `user_answers`, and updates the quiz score.
5. **Results & Analytics**: User reviews detailed score breakdowns, explanations, live SQL JOIN records, and leaderboard rankings.

---

## 5. Functional Requirements

### 5.1 Quiz Generation
- Must accept a topic string (1–100 characters) and username.
- Must generate exactly 5 multiple choice questions per quiz.
- Each question must contain:
  - Question text
  - 4 distinct options labeled A, B, C, and D
  - Exactly one correct answer key
  - A concise explanation of the correct answer
- Must persist records in PostgreSQL tables with primary/foreign key relationships.

### 5.2 Quiz Taking & Interaction
- Display one question at a time with previous/next navigation.
- Track elapsed time and completion percentage.
- Allow option selection (A, B, C, D) with active visual highlights.
- Support final submission with score evaluation.

### 5.3 Results & Explanations
- Calculate score out of 5 and percentage.
- Highlight correct versus selected answers.
- Display detailed explanation for each question.

### 5.4 Relational Data & SQL Join Inspection
- Live multi-table JOIN tab showing `users`, `quizzes`, `questions`, and `user_answers`.
- Aggregate leaderboard tab computing total quizzes, total score, and average score per user using `LEFT JOIN` and `GROUP BY`.

---

## 6. Non-Functional Requirements
- **Performance**: Quiz generation response within 2–5 seconds with LLM; instant fallback (< 100ms).
- **Usability**: Responsive, dark-mode glassmorphic interface with micro-interactions.
- **Reliability**: Graceful fallback to in-memory relational engine if PostgreSQL service is unavailable.
- **Data Integrity**: Referential integrity enforced via foreign keys with `ON DELETE CASCADE`.

---

## 7. Success Metrics
- 100% adherence to structured 5-question JSON format.
- Zero client-side crashes during quiz generation and submission.
- Complete data persistence across relational tables for every generated quiz.
