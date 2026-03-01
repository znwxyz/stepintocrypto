const QUIZ_STATS_STORAGE_KEY = 'sic_quiz_stats_v1';
const QUIZ_PREFS_STORAGE_KEY = 'sic_quiz_prefs_v1';

const difficultyOrder = { easy: 1, medium: 2, hard: 3 };

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function loadStats() {
  try {
    const raw = localStorage.getItem(QUIZ_STATS_STORAGE_KEY);
    if (!raw) return { attempts: 0, bestScore: 0, lastScore: 0, lastPlayedAt: null };
    const parsed = JSON.parse(raw);
    return {
      attempts: Number.isInteger(parsed.attempts) ? parsed.attempts : 0,
      bestScore: Number.isInteger(parsed.bestScore) ? parsed.bestScore : 0,
      lastScore: Number.isInteger(parsed.lastScore) ? parsed.lastScore : 0,
      lastPlayedAt: typeof parsed.lastPlayedAt === 'string' ? parsed.lastPlayedAt : null,
    };
  } catch {
    return { attempts: 0, bestScore: 0, lastScore: 0, lastPlayedAt: null };
  }
}

function saveStats(stats) {
  localStorage.setItem(QUIZ_STATS_STORAGE_KEY, JSON.stringify(stats));
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(QUIZ_PREFS_STORAGE_KEY);
    if (!raw) return { chapter: 'all', difficulty: 'all', sort: 'random', search: '' };
    const parsed = JSON.parse(raw);
    return {
      chapter: typeof parsed.chapter === 'string' ? parsed.chapter : 'all',
      difficulty: typeof parsed.difficulty === 'string' ? parsed.difficulty : 'all',
      sort: typeof parsed.sort === 'string' ? parsed.sort : 'random',
      search: typeof parsed.search === 'string' ? parsed.search : '',
    };
  } catch {
    return { chapter: 'all', difficulty: 'all', sort: 'random', search: '' };
  }
}

function savePrefs(prefs) {
  localStorage.setItem(QUIZ_PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

function normalizeQuestions(quizData) {
  return quizData.map((q, i) => ({
    id: typeof q.id === 'string' ? q.id : `q-${String(i + 1).padStart(3, '0')}`,
    chapter: typeof q.chapter === 'string' ? q.chapter : '00',
    difficulty:
      typeof q.difficulty === 'string' && difficultyOrder[q.difficulty]
        ? q.difficulty
        : 'medium',
    q: q.q,
    opts: q.opts,
    a: q.a,
    fb: q.fb,
  }));
}

export function createQuizController({ quizData, chapters }) {
  const overlay = document.getElementById('quiz-overlay');
  const closeBtn = document.getElementById('quiz-close');
  const progEl = document.getElementById('quiz-prog');
  const qEl = document.getElementById('quiz-q');
  const optsEl = document.getElementById('quiz-opts');
  const fbEl = document.getElementById('quiz-fb');
  const nextBtn = document.getElementById('quiz-next');

  const allQuestions = normalizeQuestions(quizData);

  let quizIdx = 0;
  let quizScore = 0;
  let quizAnswered = false;
  let resultRecorded = false;
  let activeQuestions = [];
  let viewMode = 'setup';

  let stats = loadStats();
  let prefs = loadPrefs();

  const chapterMap = new Map(chapters.map((c) => [c.num, c.title]));

  progEl.insertAdjacentHTML(
    'afterend',
    `<div class="quiz-toolbar" id="quiz-toolbar">
      <input id="quiz-search" class="quiz-search" type="text" placeholder="문제 검색" />
      <div class="quiz-filters">
        <select id="quiz-filter-chapter" class="quiz-select"></select>
        <select id="quiz-filter-difficulty" class="quiz-select">
          <option value="all">난이도: 전체</option>
          <option value="easy">쉬움</option>
          <option value="medium">보통</option>
          <option value="hard">어려움</option>
        </select>
        <select id="quiz-sort" class="quiz-select">
          <option value="random">정렬: 랜덤</option>
          <option value="chapter-asc">챕터순</option>
          <option value="difficulty-asc">난이도 낮은순</option>
          <option value="difficulty-desc">난이도 높은순</option>
        </select>
      </div>
    </div>`,
  );

  const searchEl = document.getElementById('quiz-search');
  const chapterFilterEl = document.getElementById('quiz-filter-chapter');
  const difficultyFilterEl = document.getElementById('quiz-filter-difficulty');
  const sortEl = document.getElementById('quiz-sort');
  const toolbarEl = document.getElementById('quiz-toolbar');

  const chapterOptions = ['<option value="all">챕터: 전체</option>'];
  chapters.forEach((ch) => {
    chapterOptions.push(`<option value="${ch.num}">CH ${ch.num} · ${ch.title}</option>`);
  });
  chapterFilterEl.innerHTML = chapterOptions.join('');

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function setToolbarVisible(visible) {
    toolbarEl.style.display = visible ? '' : 'none';
  }

  function getFilteredQuestions() {
    const search = prefs.search.trim().toLowerCase();

    const filtered = allQuestions.filter((q) => {
      if (prefs.chapter !== 'all' && q.chapter !== prefs.chapter) return false;
      if (prefs.difficulty !== 'all' && q.difficulty !== prefs.difficulty) return false;
      if (!search) return true;

      return (
        q.q.toLowerCase().includes(search) ||
        q.fb.toLowerCase().includes(search) ||
        q.opts.some((opt) => opt.toLowerCase().includes(search))
      );
    });

    if (prefs.sort === 'random') return shuffleArray(filtered);

    return [...filtered].sort((a, b) => {
      if (prefs.sort === 'chapter-asc') {
        const chapterCmp = a.chapter.localeCompare(b.chapter, 'en', { numeric: true });
        if (chapterCmp !== 0) return chapterCmp;
        return a.id.localeCompare(b.id, 'en', { numeric: true });
      }

      if (prefs.sort === 'difficulty-asc') {
        const diff = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id, 'en', { numeric: true });
      }

      if (prefs.sort === 'difficulty-desc') {
        const diff = difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty];
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id, 'en', { numeric: true });
      }

      return 0;
    });
  }

  function startSession() {
    activeQuestions = getFilteredQuestions();
    quizIdx = 0;
    quizScore = 0;
    quizAnswered = false;
    resultRecorded = false;
  }

  function recordResult() {
    if (resultRecorded) return;
    resultRecorded = true;

    stats = {
      attempts: stats.attempts + 1,
      bestScore: Math.max(stats.bestScore, quizScore),
      lastScore: quizScore,
      lastPlayedAt: new Date().toISOString(),
    };

    saveStats(stats);
  }

  function renderSetup() {
    viewMode = 'setup';
    setToolbarVisible(true);

    const previewQuestions = getFilteredQuestions();

    progEl.textContent = '퀴즈 설정';
    qEl.textContent = '';
    optsEl.innerHTML = '';

    if (previewQuestions.length === 0) {
      fbEl.textContent = '조건에 맞는 문제가 없습니다. 필터를 조정해 주세요.';
      nextBtn.textContent = '필터 초기화';
      nextBtn.disabled = false;
      return;
    }

    fbEl.textContent = '10문제가 자동 선택되었습니다.';
    nextBtn.textContent = '퀴즈 시작 →';
    nextBtn.disabled = false;
  }

  function renderQuiz() {
    viewMode = 'quiz';
    setToolbarVisible(false);

    if (activeQuestions.length === 0) {
      progEl.textContent = '문제 0 / 0';
      qEl.textContent = '조건에 맞는 문제가 없습니다.';
      optsEl.innerHTML = '';
      fbEl.textContent = '검색어를 지우거나 챕터/난이도 필터를 조정해 주세요.';
      nextBtn.textContent = '설정으로 이동';
      nextBtn.disabled = false;
      return;
    }

    if (quizIdx >= activeQuestions.length) {
      recordResult();

      qEl.textContent = `퀴즈 완료! ${activeQuestions.length}문제 중 ${quizScore}개 정답`;
      optsEl.innerHTML = '';

      const baseFeedback =
        quizScore >= Math.ceil(activeQuestions.length * 0.7)
          ? '훌륭합니다! 크립토 개념을 잘 이해하고 있습니다.'
          : '조금 더 복습해 보세요. 강의 노트를 다시 확인하면 도움이 됩니다.';

      fbEl.textContent = `${baseFeedback} (최고 점수: ${stats.bestScore}/${Math.max(activeQuestions.length, 1)}, 누적 시도: ${stats.attempts}회)`;
      nextBtn.textContent = '설정으로 돌아가기';
      nextBtn.disabled = false;
      progEl.textContent = `결과: ${quizScore} / ${activeQuestions.length}`;
      return;
    }

    quizAnswered = false;

    const q = activeQuestions[quizIdx];
    const chapterLabel = chapterMap.get(q.chapter) ?? '기타';
    const difficultyLabel = q.difficulty === 'easy' ? '쉬움' : q.difficulty === 'hard' ? '어려움' : '보통';

    progEl.textContent = `문제 ${quizIdx + 1} / ${activeQuestions.length} · CH ${q.chapter} · ${difficultyLabel}`;
    qEl.textContent = q.q;
    fbEl.textContent = chapterLabel;
    nextBtn.textContent = '다음 문제 →';
    nextBtn.disabled = false;
    optsEl.innerHTML = '';

    q.opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt';
      btn.textContent = opt;

      btn.addEventListener('click', () => {
        if (quizAnswered) return;
        quizAnswered = true;

        optsEl.querySelectorAll('.quiz-opt').forEach((b, j) => {
          if (j === q.a) b.classList.add('correct');
          else if (j === i) b.classList.add('wrong');
        });

        if (i === q.a) quizScore += 1;
        fbEl.textContent = q.fb;
      });

      optsEl.appendChild(btn);
    });
  }

  function applyPrefsFromControls() {
    prefs = {
      chapter: chapterFilterEl.value,
      difficulty: difficultyFilterEl.value,
      sort: sortEl.value,
      search: searchEl.value,
    };
    savePrefs(prefs);
  }

  function resetFilters() {
    prefs = { chapter: 'all', difficulty: 'all', sort: 'random', search: '' };

    chapterFilterEl.value = 'all';
    difficultyFilterEl.value = 'all';
    sortEl.value = 'random';
    searchEl.value = '';

    savePrefs(prefs);
  }

  function open() {
    chapterFilterEl.value = prefs.chapter;
    difficultyFilterEl.value = prefs.difficulty;
    sortEl.value = prefs.sort;
    searchEl.value = prefs.search;

    renderSetup();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  closeBtn.addEventListener('click', close);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  [searchEl, chapterFilterEl, difficultyFilterEl, sortEl].forEach((el) => {
    const evt = el === searchEl ? 'input' : 'change';
    el.addEventListener(evt, () => {
      applyPrefsFromControls();
      if (viewMode === 'setup') renderSetup();
    });
  });

  nextBtn.addEventListener('click', () => {
    if (viewMode === 'setup') {
      applyPrefsFromControls();
      const previewQuestions = getFilteredQuestions();
      if (previewQuestions.length === 0) {
        resetFilters();
        renderSetup();
        return;
      }
      startSession();
      renderQuiz();
      return;
    }

    if (activeQuestions.length === 0) {
      renderSetup();
      return;
    }

    if (quizIdx >= activeQuestions.length) {
      renderSetup();
      return;
    }

    quizIdx += 1;
    renderQuiz();
  });

  return {
    open,
    close,
  };
}
