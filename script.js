/**
 * Simulado DETRAN - Aplicação Principal
 */

const TOTAL_TIME_SECONDS = 50 * 60; // 50 Minutos
const MIN_PASS_SCORE = 21;

const QUOTAS = {
  "Legislação": 12,
  "Direção Defensiva": 10,
  "Primeiros Socorros": 4,
  "Meio Ambiente e Cidadania": 2,
  "Mecânica Básica": 2
};

// Cada categoria herda a cor de uma família de placas de trânsito real
const CATEGORY_COLORS = {
  "Legislação": "#0B4A82",          // azul de regulamentação
  "Direção Defensiva": "#1E2126",   // asfalto
  "Primeiros Socorros": "#C81E2C",  // vermelho de emergência
  "Meio Ambiente e Cidadania": "#167A46", // verde
  "Mecânica Básica": "#C97A00"      // amarelo de advertência (escurecido p/ contraste)
};

// Banco de dados das questões: carregado de questions.json em tempo de execução.
// Ver função loadQuestionBank() mais abaixo.
let rawQuestions = [];

// Estado da Aplicação
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let timerInterval = null;
let timeRemaining = TOTAL_TIME_SECONDS;
let categoryStats = {};

// Elementos DOM
const welcomeScreen = document.getElementById('welcome-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');

const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');

const timerDisplay = document.getElementById('timer-display');
const questionCounter = document.getElementById('question-counter');
const questionCategory = document.getElementById('question-category');
const progressFill = document.getElementById('progress-fill');
const questionText = document.getElementById('question-text');
const imageContainer = document.getElementById('image-container');
const optionsContainer = document.getElementById('options-container');

const feedbackContainer = document.getElementById('feedback-container');
const feedbackIcon = document.getElementById('feedback-icon');
const feedbackMessage = document.getElementById('feedback-message');
const explanationText = document.getElementById('explanation-text');

const quotaBreakdown = document.getElementById('quota-breakdown');
const loadStatus = document.getElementById('load-status');
const resultMessage = document.getElementById('result-message');
const categoryBreakdown = document.getElementById('category-breakdown');

const CHECK_ICON = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10.5L8 14.5L16 5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CROSS_ICON = '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 5L15 15M15 5L5 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

// Renderiza, na tela inicial, a composição real da prova por categoria
function renderQuotaBreakdown() {
  if (!quotaBreakdown) return;
  const total = Object.values(QUOTAS).reduce((a, b) => a + b, 0);
  const bar = Object.entries(QUOTAS).map(([cat, count]) => {
    const pct = (count / total) * 100;
    return `<span class="quota-seg" style="width:${pct}%; background:${CATEGORY_COLORS[cat]}" title="${cat}: ${count} questões"></span>`;
  }).join('');

  const legend = Object.entries(QUOTAS).map(([cat, count]) => {
    return `<li><span class="quota-dot" style="background:${CATEGORY_COLORS[cat]}"></span>${cat} <strong>${count}</strong></li>`;
  }).join('');

  quotaBreakdown.innerHTML = `<div class="quota-bar">${bar}</div><ul class="quota-legend">${legend}</ul>`;
}

// Funções Utilitárias
function shuffle(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Garante o preenchimento das cotas com fallbacks caso falte questão no banco
function generateProportionalExam(database) {
  let examQuestions = [];

  for (const [category, count] of Object.entries(QUOTAS)) {
    const categoryQuestions = database.filter(q => q.category === category);
    
    if (categoryQuestions.length < count) {
      console.warn(`Alerta de Cota: Categoria '${category}' possui ${categoryQuestions.length} questões, mas a cota exige ${count}.`);
    }

    const shuffled = shuffle(categoryQuestions);
    examQuestions = examQuestions.concat(shuffled.slice(0, count));
  }

  // Se o total for menor que o esperado por escassez de cadastro, completa com questões aleatórias
  if (examQuestions.length < 30) {
    const selectedIds = new Set(examQuestions.map(q => q.id));
    const remaining = database.filter(q => !selectedIds.has(q.id));
    const shuffledRemaining = shuffle(remaining);
    
    while (examQuestions.length < 30 && shuffledRemaining.length > 0) {
      examQuestions.push(shuffledRemaining.pop());
    }
  }

  return shuffle(examQuestions);
}

// Inicialização do Simulado
function startQuiz() {
  questions = generateProportionalExam(rawQuestions);
  currentQuestionIndex = 0;
  score = 0;
  timeRemaining = TOTAL_TIME_SECONDS;
  categoryStats = {};
  Object.keys(QUOTAS).forEach(cat => { categoryStats[cat] = { correct: 0, total: 0 }; });

  welcomeScreen.classList.add('hidden');
  resultScreen.classList.add('hidden');
  quizScreen.classList.remove('hidden');

  startTimer();
  showQuestion();
}

// Temporizador
function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      finishQuiz();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (timeRemaining <= 300) { // Menos de 5 min
    timerDisplay.className = 'timer-badge danger';
  } else if (timeRemaining <= 600) { // Menos de 10 min
    timerDisplay.className = 'timer-badge warning';
  } else {
    timerDisplay.className = 'timer-badge';
  }
}

// Renderização da Questão
function showQuestion() {
  resetState();
  const q = questions[currentQuestionIndex];

  // Atualiza indicadores visuais
  questionCounter.textContent = `Questão ${currentQuestionIndex + 1} de ${questions.length}`;
  questionCategory.textContent = q.category;
  
  // Fórmula ajustada da barra de progresso (Inicia visível na Q1 e chega a 100% na última)
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
  progressFill.style.width = `${progressPercent}%`;

  questionText.textContent = q.text;

  // Renderização de imagem de placas se houver.
  // placaId pode ser uma única placa (string) ou múltiplas placas (array).
  if (q.placaId) {
    const placaIds = Array.isArray(q.placaId) ? q.placaId : [q.placaId];

    imageContainer.innerHTML = placaIds
      .map(placaId => `<svg><use href="#${placaId}"></use></svg>`)
      .join('');

    imageContainer.classList.remove('hidden');
  } else {
    imageContainer.classList.add('hidden');
  }

  // Opções de resposta
  q.options.forEach((opt, index) => {
    const button = document.createElement('button');
    button.className = 'option-btn';
    button.textContent = opt;
    button.addEventListener('click', () => selectOption(index));
    optionsContainer.appendChild(button);
  });

  // Reinicia a animação de entrada da questão
  const questionContainer = document.querySelector('.question-container');
  questionContainer.classList.remove('question-enter');
  void questionContainer.offsetWidth; // força reflow para reiniciar a animação
  questionContainer.classList.add('question-enter');
}

function resetState() {
  nextBtn.classList.add('hidden');
  feedbackContainer.classList.add('hidden');
  optionsContainer.innerHTML = '';
}

function selectOption(selectedIndex) {
  const q = questions[currentQuestionIndex];
  const optionButtons = optionsContainer.children;

  // Desabilita interação adicional
  for (let btn of optionButtons) {
    btn.disabled = true;
  }

  const isCorrect = selectedIndex === q.correct;

  categoryStats[q.category].total++;

  if (isCorrect) {
    score++;
    categoryStats[q.category].correct++;
    optionButtons[selectedIndex].classList.add('selected-correct');
    feedbackMessage.textContent = 'Resposta correta';
    feedbackMessage.className = 'feedback-message correct';
    feedbackContainer.className = 'feedback-container correct';
    if (feedbackIcon) feedbackIcon.innerHTML = CHECK_ICON;
  } else {
    optionButtons[selectedIndex].classList.add('selected-wrong');
    optionButtons[q.correct].classList.add('show-correct');
    feedbackMessage.textContent = 'Resposta incorreta';
    feedbackMessage.className = 'feedback-message wrong';
    feedbackContainer.className = 'feedback-container wrong';
    if (feedbackIcon) feedbackIcon.innerHTML = CROSS_ICON;
  }

  explanationText.textContent = q.explanation;
  feedbackContainer.classList.remove('hidden');
  nextBtn.classList.remove('hidden');
}

function handleNext() {
  currentQuestionIndex++;
  if (currentQuestionIndex < questions.length) {
    showQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  clearInterval(timerInterval);

  quizScreen.classList.add('hidden');
  resultScreen.classList.remove('hidden');

  const percent = Math.round((score / questions.length) * 100);
  const timeSpentSeconds = TOTAL_TIME_SECONDS - timeRemaining;
  const spentMinutes = Math.floor(timeSpentSeconds / 60);
  const spentSecs = timeSpentSeconds % 60;

  const passed = score >= MIN_PASS_SCORE;
  const resultStatus = document.getElementById('result-status');

  // Identifica a categoria com pior desempenho relativo, para orientar a revisão
  const weakest = Object.entries(categoryStats)
    .filter(([, s]) => s.total > 0)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))[0];

  if (passed) {
    resultStatus.textContent = "Aprovado!";
    resultStatus.className = "result-status passed";
    if (resultMessage) resultMessage.textContent = percent >= 90
      ? "Desempenho sólido 🏆. Thaíse, você está pronto(a) para a prova oficial."
      : "Thaíse, você passou da nota mínima 😳. Revise os pontos abaixo antes da prova oficial 📚.";
  } else {
    resultStatus.textContent = "Reprovado!";
    resultStatus.className = "result-status failed";
    if (resultMessage) resultMessage.textContent = weakest
      ? `Faltaram ${MIN_PASS_SCORE - score} acertos para a aprovação. ${weakest[0]} foi o ponto mais fraco — Thaíse, revise antes de tentar de novo 📚.`
      : `Faltaram ${MIN_PASS_SCORE - score} acertos para a aprovação. Thaíse, revise o conteúdo antes de tentar de novo 📚.`;
  }

  document.getElementById('score-text').textContent = `${score}/${questions.length}`;
  document.getElementById('score-percent').textContent = `${percent}%`;
  document.getElementById('time-spent-text').textContent = `${String(spentMinutes).padStart(2, '0')}:${String(spentSecs).padStart(2, '0')}`;

  if (categoryBreakdown) {
    categoryBreakdown.innerHTML = Object.entries(categoryStats).map(([cat, s]) => {
      const catPct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      return `
        <li class="breakdown-row">
          <span class="breakdown-label">${cat}</span>
          <span class="breakdown-bar-track">
            <span class="breakdown-bar-fill" style="width:${catPct}%; background:${CATEGORY_COLORS[cat]}"></span>
          </span>
          <span class="breakdown-score">${s.correct}/${s.total}</span>
        </li>`;
    }).join('');
  }
}

// Event Listeners
startBtn.addEventListener('click', startQuiz);
nextBtn.addEventListener('click', handleNext);
restartBtn.addEventListener('click', startQuiz);

renderQuotaBreakdown();

// Carrega o banco de questões de um arquivo externo (questions.json).
// Mantém o conteúdo das provas totalmente separado da lógica do app:
// para adicionar/editar questões basta regenerar esse arquivo (ex.: via um
// script Python de extração), sem tocar em script.js.

async function loadQuestionBank() {
  try {
    const response = await fetch('questions.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('questions.json está vazio ou em formato inválido');
    }
    rawQuestions = data;
    if (loadStatus) loadStatus.textContent = '';
    startBtn.disabled = false;
    startBtn.textContent = 'Iniciar simulado';
  } catch (err) {
    console.error('Falha ao carregar o banco de questões:', err);
    if (loadStatus) {
      loadStatus.textContent = 'Não foi possível carregar as perguntas (questions.json). Verifique se o arquivo está na mesma pasta e se a página está sendo aberta por um servidor local (http://), não direto do disco.';
      loadStatus.classList.add('error');
    }
    startBtn.textContent = 'Perguntas indisponíveis';
  }
}

loadQuestionBank();
