const PROGRESS_STORAGE_KEY = 'sic_completed_chapters_v1';

function loadCompletedSet() {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(Number.isInteger));
  } catch {
    return new Set();
  }
}

function saveCompletedSet(completedSet) {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify([...completedSet]));
}

function buildNav(chapters, scrollToChapter) {
  const navEl = document.getElementById('nav-chapters');
  navEl.innerHTML = '';

  chapters.forEach((ch, i) => {
    const el = document.createElement('div');
    el.className = 'nav-item';
    el.dataset.idx = i;
    el.innerHTML = `<span class="nav-num">${ch.num}</span><span class="nav-text">${ch.title}</span>`;
    el.addEventListener('click', () => scrollToChapter(i));
    navEl.appendChild(el);
  });
}

function buildChapters(chapters) {
  const root = document.getElementById('chapters-root');
  root.innerHTML = '';

  chapters.forEach((ch, idx) => {
    const div = document.createElement('div');
    div.className = 'chapter';
    div.id = `chapter-${idx}`;
    div.style.animationDelay = `${idx * 0.03}s`;

    let sectionsHTML = '';
    ch.sections.forEach((sec) => {
      let inner = `<div class="section-body">${sec.body}</div>`;

      if (sec.formula) {
        inner += `<div class="formula">${sec.formula}</div>`;
        if (sec.formulaNote) {
          inner += `<div class="section-body" style="margin-top:8px">${sec.formulaNote}</div>`;
        }
      }

      if (sec.card) {
        const cardClass = sec.card.type === 'warn' ? 'warn' : sec.card.type === 'success' ? 'success' : '';
        inner += `<div class="info-card ${cardClass}"><div class="card-tag">// ${sec.card.tag}</div>${sec.card.text}</div>`;
      }

      if (sec.table) {
        let tbl = `<table class="comp-table"><thead><tr>${sec.table.headers
          .map((h) => `<th>${h}</th>`)
          .join('')}</tr></thead><tbody>`;

        sec.table.rows.forEach((row) => {
          tbl += `<tr>${row.map((c) => `<td>${c}</td>`).join('')}</tr>`;
        });

        tbl += '</tbody></table>';
        inner += tbl;
      }

      sectionsHTML += `<div class="section"><div class="section-title">${sec.title}</div>${inner}</div><div class="divider"></div>`;
    });

    const kpHTML = ch.keyPoints
      .map((k) => `<div class="key-point"><span class="kp-icon">▸</span><span>${k}</span></div>`)
      .join('');

    div.innerHTML = `
      <div class="chapter-header">
        <div class="chapter-header-left">
          <span class="chapter-num-badge">CH ${ch.num}</span>
          <div class="chapter-title-wrap">
            <div class="chapter-title">${ch.title}</div>
            <div class="chapter-subtitle">${ch.subtitle}</div>
          </div>
        </div>
        <div class="chapter-header-right">
          <button class="complete-btn" data-idx="${idx}">완료 체크 <span class="check-icon">✓</span></button>
        </div>
      </div>
      <div class="key-points">
        <div class="key-points-title">// 핵심 포인트</div>
        ${kpHTML}
      </div>
      ${sectionsHTML}
    `;

    root.appendChild(div);
  });
}

export function initUI({ chapters, glossaryTerms, onOpenQuiz, onOpenGlossary }) {
  const mainEl = document.getElementById('main-content');
  const scrollTopBtn = document.getElementById('scroll-top');

  const hamburger = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  const glossaryOverlay = document.getElementById('glossary-overlay');
  const glossarySearch = document.getElementById('glossary-search');
  const glossaryList = document.getElementById('glossary-list');

  const isMobile = () => window.innerWidth <= 768;

  function openSidebar() {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
    hamburger.classList.add('open');
    updateActiveNav();
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
    hamburger.classList.remove('open');
  }

  function getScrollTop() {
    return isMobile() ? window.scrollY : mainEl.scrollTop;
  }

  function updateActiveNav() {
    const navItems = document.querySelectorAll('.nav-item');
    if (!navItems.length) return;

    const scrollPos = getScrollTop() + 160;
    let activeIdx = 0;

    chapters.forEach((_, i) => {
      const el = document.getElementById(`chapter-${i}`);
      if (!el) return;
      const elTop = isMobile() ? el.getBoundingClientRect().top + window.scrollY : el.offsetTop;
      if (elTop <= scrollPos) activeIdx = i;
    });

    navItems.forEach((n) => n.classList.remove('active'));
    if (navItems[activeIdx]) navItems[activeIdx].classList.add('active');
  }

  function scrollToChapter(idx) {
    const el = document.getElementById(`chapter-${idx}`);
    if (!el) return;

    if (isMobile()) {
      const targetTop = el.getBoundingClientRect().top + window.scrollY - 72;
      closeSidebar();
      setTimeout(() => window.scrollTo({ top: targetTop, behavior: 'smooth' }), 320);
    } else {
      mainEl.scrollTop = el.offsetTop - 20;
    }
  }

  function renderGlossary(filter) {
    const terms = glossaryTerms.filter(
      (t) => !filter || t.term.includes(filter) || t.def.includes(filter),
    );

    glossaryList.innerHTML = terms
      .map((t) => `<div class="glossary-item"><div class="g-term">${t.term}</div><div class="g-def">${t.def}</div></div>`)
      .join('');
  }

  function openGlossary() {
    glossarySearch.value = '';
    renderGlossary('');
    glossaryOverlay.classList.add('open');
  }

  function closeGlossary() {
    glossaryOverlay.classList.remove('open');
  }

  buildChapters(chapters);
  buildNav(chapters, scrollToChapter);

  const completedSet = loadCompletedSet();

  function updateProgress() {
    const pct = Math.round((completedSet.size / chapters.length) * 100);
    document.getElementById('progress-fill').style.width = `${pct}%`;
    document.getElementById('progress-pct').textContent = `${pct}%`;
  }

  function markCompletion(idx, done) {
    const btn = document.querySelector(`.complete-btn[data-idx="${idx}"]`);
    const nav = document.querySelectorAll('.nav-item')[idx];
    if (!btn || !nav) return;

    if (done) {
      btn.innerHTML = '완료됨 <span class="check-icon">✓</span>';
      btn.classList.add('done');
      nav.classList.add('done');
      completedSet.add(idx);
    } else {
      btn.innerHTML = '완료 체크 <span class="check-icon">✓</span>';
      btn.classList.remove('done');
      nav.classList.remove('done');
      completedSet.delete(idx);
    }
  }

  for (const idx of completedSet) {
    if (idx >= 0 && idx < chapters.length) markCompletion(idx, true);
  }

  document.querySelectorAll('.complete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number.parseInt(btn.dataset.idx, 10);
      const done = !completedSet.has(idx);
      markCompletion(idx, done);
      saveCompletedSet(completedSet);
      updateProgress();
    });
  });

  mainEl.addEventListener('scroll', () => {
    if (isMobile()) return;
    scrollTopBtn.classList.toggle('visible', mainEl.scrollTop > 200);
    updateActiveNav();
  });

  window.addEventListener('scroll', () => {
    if (!isMobile()) return;
    scrollTopBtn.classList.toggle('visible', window.scrollY > 200);
    updateActiveNav();
  });

  scrollTopBtn.addEventListener('click', () => {
    if (isMobile()) window.scrollTo({ top: 0, behavior: 'smooth' });
    else mainEl.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('btn-quiz').addEventListener('click', () => {
    if (isMobile()) closeSidebar();
    onOpenQuiz();
  });

  document.getElementById('cta-quiz').addEventListener('click', onOpenQuiz);

  document.getElementById('btn-glossary').addEventListener('click', () => {
    if (isMobile()) closeSidebar();
    onOpenGlossary();
  });

  document.getElementById('cta-glossary').addEventListener('click', onOpenGlossary);

  document.getElementById('glossary-close').addEventListener('click', closeGlossary);
  glossarySearch.addEventListener('input', (e) => renderGlossary(e.target.value));

  glossaryOverlay.addEventListener('click', (e) => {
    if (e.target === glossaryOverlay) closeGlossary();
  });

  hamburger.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  backdrop.addEventListener('click', closeSidebar);

  updateProgress();
  updateActiveNav();

  return {
    openGlossary,
    closeGlossary,
    closeSidebar,
    isMobile,
  };
}
