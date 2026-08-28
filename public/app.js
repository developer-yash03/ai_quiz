function createQuizController(quizData) {
  const { quizId, topic, username, questions } = quizData;
  let currentIndex = 0;
  const answers = {};
  let secondsElapsed = 0;
  let timerId = null;

  return {
    getQuizId: () => quizId,
    getTopic: () => topic,
    getUsername: () => username,
    getTotalQuestions: () => questions.length,
    getCurrentIndex: () => currentIndex,
    
    getCurrentQuestion() {
      return questions[currentIndex];
    },

    selectAnswer(optionKey) {
      const currentQ = questions[currentIndex];
      answers[currentQ.id] = optionKey;
    },

    getSelectedAnswerForCurrent() {
      const currentQ = questions[currentIndex];
      return answers[currentQ.id] || null;
    },

    hasAnsweredCurrent() {
      const currentQ = questions[currentIndex];
      return Boolean(answers[currentQ.id]);
    },

    canGoNext() {
      return currentIndex < questions.length - 1;
    },

    canGoPrev() {
      return currentIndex > 0;
    },

    nextQuestion() {
      if (currentIndex < questions.length - 1) {
        currentIndex++;
        return true;
      }
      return false;
    },

    prevQuestion() {
      if (currentIndex > 0) {
        currentIndex--;
        return true;
      }
      return false;
    },

    isLastQuestion() {
      return currentIndex === questions.length - 1;
    },

    getAnswersPayload() {
      return { quizId, answers: { ...answers } };
    },

    startTimer(onTickCallback) {
      secondsElapsed = 0;
      if (timerId) clearInterval(timerId);
      timerId = setInterval(() => {
        secondsElapsed++;
        const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const secs = String(secondsElapsed % 60).padStart(2, '0');
        if (onTickCallback) onTickCallback(`${mins}:${secs}`);
      }, 1000);
    },

    stopTimer() {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      return secondsElapsed;
    }
  };
}

let activeQuiz = null;
let lastCompletedQuizId = null;

const dom = {
  dbStatusPill: document.getElementById('db-status-pill'),
  tabButtons: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  quizForm: document.getElementById('quiz-form'),
  topicInput: document.getElementById('topic-input'),
  usernameInput: document.getElementById('username-input'),
  apikeyInput: document.getElementById('apikey-input'),
  generateBtn: document.getElementById('generate-btn'),
  btnText: document.querySelector('#generate-btn .btn-text'),
  btnLoader: document.querySelector('#generate-btn .btn-loader'),
  generatorCard: document.getElementById('generator-card'),
  activeQuizCard: document.getElementById('active-quiz-card'),
  resultsCard: document.getElementById('results-card'),
  quizTopicBadge: document.getElementById('quiz-topic-badge'),
  quizTitle: document.getElementById('quiz-title'),
  timerDisplay: document.getElementById('timer-display'),
  progressBar: document.getElementById('quiz-progress-bar'),
  questionText: document.getElementById('current-question-text'),
  optionsGrid: document.getElementById('options-grid'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  submitQuizBtn: document.getElementById('submit-quiz-btn'),
  scoreNumber: document.getElementById('score-number'),
  scorePercentage: document.getElementById('score-percentage'),
  resultsHeadline: document.getElementById('results-headline'),
  answersBreakdown: document.getElementById('answers-breakdown'),
  retakeBtn: document.getElementById('retake-btn'),
  viewSqlJoinedBtn: document.getElementById('view-sql-joined-btn'),
  refreshJoinBtn: document.getElementById('refresh-join-btn'),
  joinsTbody: document.getElementById('joins-tbody'),
  refreshLeaderboardBtn: document.getElementById('refresh-leaderboard-btn'),
  leaderboardTbody: document.getElementById('leaderboard-tbody')
};

async function checkSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.postgresConnected) {
      dom.dbStatusPill.className = 'badge badge-success';
      dom.dbStatusPill.textContent = '● PostgreSQL Connected';
    } else {
      dom.dbStatusPill.className = 'badge badge-warning';
      dom.dbStatusPill.textContent = '● In-Memory Relational Engine';
    }
  } catch (err) {
    dom.dbStatusPill.className = 'badge badge-warning';
    dom.dbStatusPill.textContent = '● Server Connecting...';
  }
}

async function handleGenerateQuiz(e) {
  e.preventDefault();

  const topic = dom.topicInput.value.trim();
  const username = dom.usernameInput.value.trim() || 'Anonymous';
  const apiKey = dom.apikeyInput.value.trim() || null;

  if (!topic) return;

  dom.generateBtn.disabled = true;
  dom.btnText.classList.add('hidden');
  dom.btnLoader.classList.remove('hidden');

  try {
    const response = await fetch('/api/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, username, apiKey })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate quiz');
    }

    activeQuiz = createQuizController(data);
    startQuizSession();

  } catch (err) {
    alert(`Generation error: ${err.message}`);
  } finally {
    dom.generateBtn.disabled = false;
    dom.btnText.classList.remove('hidden');
    dom.btnLoader.classList.add('hidden');
  }
}

async function handleSubmitQuiz() {
  if (!activeQuiz) return;

  activeQuiz.stopTimer();
  const payload = activeQuiz.getAnswersPayload();

  dom.submitQuizBtn.disabled = true;
  dom.submitQuizBtn.textContent = 'Submitting & Evaluating...';

  try {
    const response = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit quiz');
    }

    lastCompletedQuizId = data.quizId;
    renderResults(data.evaluation);

  } catch (err) {
    alert(`Submission error: ${err.message}`);
    dom.submitQuizBtn.disabled = false;
    dom.submitQuizBtn.textContent = 'Submit & Score Quiz 🚀';
  }
}

async function fetchJoinedDetails(quizId) {
  const targetId = quizId || lastCompletedQuizId;
  if (!targetId) {
    dom.joinsTbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted">Please generate and complete a quiz first to inspect joined relational data.</td>
      </tr>`;
    return;
  }

  try {
    const response = await fetch(`/api/quiz/${targetId}/details`);
    const result = await response.json();

    if (result.success && result.data.length > 0) {
      dom.joinsTbody.innerHTML = result.data.map((row, index) => `
        <tr>
          <td><strong>#${row.quiz_id}</strong></td>
          <td>${row.topic}</td>
          <td><code>${row.username}</code></td>
          <td>${index + 1}</td>
          <td>${row.question_text}</td>
          <td><span class="badge badge-success">${row.correct_answer}</span></td>
          <td><span class="badge ${row.is_correct ? 'badge-success' : 'badge-warning'}">${row.selected_answer || 'None'}</span></td>
          <td>${row.is_correct ? '✅ Correct' : '❌ Incorrect'}</td>
        </tr>
      `).join('');
    } else {
      dom.joinsTbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No rows returned for Quiz #${targetId}</td></tr>`;
    }
  } catch (err) {
    console.error('Error fetching joined records:', err);
  }
}

async function fetchLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    const result = await response.json();

    if (result.success && result.leaderboard.length > 0) {
      dom.leaderboardTbody.innerHTML = result.leaderboard.map((u, i) => `
        <tr>
          <td><strong>#${i + 1}</strong></td>
          <td><code>${u.username}</code></td>
          <td>${u.total_quizzes_taken}</td>
          <td><strong>${u.total_score} pts</strong></td>
          <td>${u.avg_score} / 5.0</td>
        </tr>
      `).join('');
    } else {
      dom.leaderboardTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No leaderboard entries yet. Take a quiz!</td></tr>`;
    }
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
  }
}

function startQuizSession() {
  dom.generatorCard.classList.add('hidden');
  dom.resultsCard.classList.add('hidden');
  dom.activeQuizCard.classList.remove('hidden');

  dom.quizTopicBadge.textContent = activeQuiz.getTopic();
  activeQuiz.startTimer(timeStr => {
    dom.timerDisplay.textContent = timeStr;
  });

  renderCurrentQuestion();
}

function renderCurrentQuestion() {
  const currentQ = activeQuiz.getCurrentQuestion();
  const currIndex = activeQuiz.getCurrentIndex();
  const total = activeQuiz.getTotalQuestions();
  const selectedAns = activeQuiz.getSelectedAnswerForCurrent();

  dom.quizTitle.textContent = `Question ${currIndex + 1} of ${total}`;
  dom.progressBar.style.width = `${((currIndex + 1) / total) * 100}%`;
  dom.questionText.textContent = currentQ.question;

  dom.optionsGrid.innerHTML = '';
  const options = currentQ.options;
  for (const [key, text] of Object.entries(options)) {
    const optBtn = document.createElement('button');
    optBtn.className = `option-btn ${selectedAns === key ? 'selected' : ''}`;
    optBtn.innerHTML = `
      <span class="option-key">${key}</span>
      <span class="option-label">${text}</span>
    `;
    optBtn.addEventListener('click', () => {
      activeQuiz.selectAnswer(key);
      renderCurrentQuestion();
    });
    dom.optionsGrid.appendChild(optBtn);
  }

  dom.prevBtn.disabled = !activeQuiz.canGoPrev();

  if (activeQuiz.isLastQuestion()) {
    dom.nextBtn.classList.add('hidden');
    dom.submitQuizBtn.classList.remove('hidden');
    dom.submitQuizBtn.disabled = false;
    dom.submitQuizBtn.textContent = 'Submit & Score Quiz 🚀';
  } else {
    dom.nextBtn.classList.remove('hidden');
    dom.submitQuizBtn.classList.add('hidden');
  }
}

function renderResults(evaluation) {
  dom.activeQuizCard.classList.add('hidden');
  dom.resultsCard.classList.remove('hidden');

  dom.scoreNumber.textContent = `${evaluation.score}/${evaluation.total}`;
  dom.scorePercentage.textContent = `${evaluation.percentage}%`;

  if (evaluation.percentage >= 80) {
    dom.resultsHeadline.textContent = '🎉 Excellent Job!';
  } else if (evaluation.percentage >= 60) {
    dom.resultsHeadline.textContent = '👍 Good Effort!';
  } else {
    dom.resultsHeadline.textContent = '📚 Keep Practicing!';
  }

  dom.answersBreakdown.innerHTML = evaluation.results.map((res, i) => `
    <div class="breakdown-item ${res.isCorrect ? 'correct' : 'incorrect'}">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <strong>Q${i + 1}: ${res.question}</strong>
        <span>${res.isCorrect ? '✅ Correct' : '❌ Incorrect'}</span>
      </div>
      <div>
        <span class="badge ${res.isCorrect ? 'badge-success' : 'badge-warning'}">Your Answer: ${res.selectedAnswer}</span>
        <span class="badge badge-info" style="margin-left: 8px;">Correct Answer: ${res.correctAnswer}</span>
      </div>
      <div class="breakdown-explanation">
        💡 <strong>Explanation:</strong> ${res.explanation || 'N/A'}
      </div>
    </div>
  `).join('');
}

dom.quizForm.addEventListener('submit', handleGenerateQuiz);

dom.nextBtn.addEventListener('click', () => {
  if (activeQuiz.nextQuestion()) {
    renderCurrentQuestion();
  }
});

dom.prevBtn.addEventListener('click', () => {
  if (activeQuiz.prevQuestion()) {
    renderCurrentQuestion();
  }
});

dom.submitQuizBtn.addEventListener('click', handleSubmitQuiz);

dom.retakeBtn.addEventListener('click', () => {
  dom.resultsCard.classList.add('hidden');
  dom.activeQuizCard.classList.add('hidden');
  dom.generatorCard.classList.remove('hidden');
});

dom.viewSqlJoinedBtn.addEventListener('click', () => {
  switchTab('tab-joins');
  fetchJoinedDetails(lastCompletedQuizId);
});

dom.refreshJoinBtn.addEventListener('click', () => fetchJoinedDetails(lastCompletedQuizId));
dom.refreshLeaderboardBtn.addEventListener('click', fetchLeaderboard);

function switchTab(tabId) {
  dom.tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  dom.tabContents.forEach(c => c.classList.toggle('active', c.id === tabId));

  if (tabId === 'tab-joins') fetchJoinedDetails(lastCompletedQuizId);
  if (tabId === 'tab-leaderboard') fetchLeaderboard();
}

dom.tabButtons.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

checkSystemStatus();
