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
  const navChaptersEl = document.getElementById('nav-chapters');

  const glossaryOverlay = document.getElementById('glossary-overlay');
  const glossaryPanel = glossaryOverlay?.querySelector('.glossary-panel') ?? null;
  const glossarySearch = document.getElementById('glossary-search');
  const glossaryList = document.getElementById('glossary-list');
  const cryptoFloatBtn = document.getElementById('crypto-float');
  const supportFloatLink = document.getElementById('support-float');
  const donationOverlay = document.getElementById('donation-overlay');
  const donationCloseBtn = document.getElementById('donation-close');
  const walletCopyBtn = document.getElementById('wallet-copy');
  const walletAddressEl = document.getElementById('wallet-address');
  const heroDesc = document.getElementById('hero-desc');
  const heroMoreToggle = document.getElementById('hero-more-toggle');
  const legalOverlays = {
    privacy: document.getElementById('legal-privacy-overlay'),
    terms: document.getElementById('legal-terms-overlay'),
    contact: document.getElementById('legal-contact-overlay'),
  };

  const isMobile = () => window.innerWidth <= 768;
  let lockedScrollY = 0;

  function lockBackgroundScroll() {
    lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add('sidebar-open-mobile');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.width = '100%';
  }

  function unlockBackgroundScroll() {
    if (!document.body.classList.contains('sidebar-open-mobile')) return;
    document.body.classList.remove('sidebar-open-mobile');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, lockedScrollY);
  }

  function openSidebar() {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
    hamburger.classList.add('open');
    if (isMobile()) lockBackgroundScroll();
    if (isMobile() && navChaptersEl) navChaptersEl.scrollTop = 0;
    updateActiveNav();
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
    hamburger.classList.remove('open');
    unlockBackgroundScroll();
  }

  function isGlossaryOpen() {
    if (!glossaryOverlay) return false;
    if (glossaryOverlay.classList.contains('open')) return true;
    return getComputedStyle(glossaryOverlay).display !== 'none';
  }

  function getScrollTop() {
    return isMobile() ? window.scrollY : mainEl.scrollTop;
  }

  function syncMobileFloatingButtons() {
    if (!cryptoFloatBtn || !supportFloatLink) return;
    if (!isMobile()) {
      cryptoFloatBtn.style.right = '';
      cryptoFloatBtn.style.left = '';
      return;
    }

    const baseRight = 16;
    const gap = 8;
    const supportWidth = Math.ceil(supportFloatLink.getBoundingClientRect().width || 0);
    const cryptoWidth = Math.ceil(cryptoFloatBtn.getBoundingClientRect().width || 0);
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;

    if (supportWidth > 0 && viewportWidth > 0) {
      const desiredRight = baseRight + supportWidth + gap;
      const maxRight = Math.max(baseRight, viewportWidth - cryptoWidth - 8);
      const safeRight = Math.min(desiredRight, maxRight);

      cryptoFloatBtn.style.right = `${safeRight}px`;
      cryptoFloatBtn.style.left = 'auto';
    }
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

  function updateFloatingVisibility() {
    const shouldShow = getScrollTop() > 160;
    document.body.classList.toggle('floating-visible', shouldShow);
  }

  function forwardWheelToMainOnDesktop(e) {
    if (isMobile()) return;
    mainEl.scrollTop += e.deltaY;
    e.preventDefault();
  }

  function routeDesktopWheelToMain(e) {
    if (isMobile()) return;
    if (!mainEl || !sidebar) return;

    const target = e.target;
    if (!(target instanceof Element)) return;

    // Keep native wheel behavior inside main/sidebar and inside open overlays.
    if (mainEl.contains(target) || sidebar.contains(target)) return;
    if (
      glossaryOverlay?.classList.contains('open')
      || donationOverlay?.classList.contains('open')
      || document.querySelector('.legal-overlay.open')
    ) return;

    mainEl.scrollTop += e.deltaY;
    e.preventDefault();
  }

  function scrollToChapter(idx) {
    const el = document.getElementById(`chapter-${idx}`);
    if (!el) return;

    if (isMobile()) {
      closeSidebar();
      setTimeout(() => {
        const targetEl = document.getElementById(`chapter-${idx}`);
        if (!targetEl) return;
        const mobileTopbar = document.querySelector('.mobile-topbar');
        const topOffset = (mobileTopbar?.offsetHeight ?? 52) + 12;
        const targetTop = Math.max(0, targetEl.getBoundingClientRect().top + window.scrollY - topOffset);
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      }, 340);
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
    document.body.classList.add('glossary-open');
    glossaryOverlay.classList.add('open');
    syncMobileFloatingButtons();
  }

  function closeGlossary() {
    document.body.classList.remove('glossary-open');
    glossaryOverlay.classList.remove('open');
    syncMobileFloatingButtons();
    updateFloatingVisibility();
  }

  function openDonation() {
    if (!donationOverlay) return;
    closeGlossary();
    closeSidebar();
    closeAllLegal();
    donationOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDonation() {
    if (!donationOverlay) return;
    donationOverlay.classList.remove('open');
    if (!document.getElementById('quiz-overlay').classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  function closeAllLegal() {
    Object.values(legalOverlays).forEach((overlay) => {
      if (overlay) overlay.classList.remove('open');
    });
    document.body.style.overflow = '';
  }

  function openLegal(type) {
    closeAllLegal();
    const target = legalOverlays[type];
    if (!target) return;
    target.classList.add('open');
    document.body.style.overflow = 'hidden';
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
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = Number.parseInt(btn.dataset.idx, 10);
      if (!Number.isInteger(idx)) return;

      const currentlyDone = btn.classList.contains('done');
      markCompletion(idx, !currentlyDone);
      saveCompletedSet(completedSet);
      updateProgress();
      btn.blur();
    });
  });

  mainEl.addEventListener('scroll', () => {
    if (isMobile()) return;
    scrollTopBtn.classList.toggle('visible', mainEl.scrollTop > 200);
    updateActiveNav();
    updateFloatingVisibility();
  });

  window.addEventListener('scroll', () => {
    if (!isMobile()) return;
    scrollTopBtn.classList.toggle('visible', window.scrollY > 200);
    updateActiveNav();
    updateFloatingVisibility();
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      unlockBackgroundScroll();
      closeSidebar();
    }
    syncMobileFloatingButtons();
    updateFloatingVisibility();
  });

  document.addEventListener('wheel', routeDesktopWheelToMain, { passive: false });

  scrollTopBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (isGlossaryOpen() && glossaryPanel) {
      glossaryPanel.scrollTo({ top: 0, behavior: 'smooth' });
      glossaryPanel.scrollTop = 0;
      return;
    }
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

  if (heroDesc && heroMoreToggle) {
    const heroExtras = heroDesc.querySelectorAll('.hero-extra');
    let mobileHeroExpanded = false;
    let wasMobileViewport = isMobile();

    const applyHeroExpandedState = (expanded) => {
      heroDesc.classList.toggle('expanded', expanded);
      heroExtras.forEach((el) => {
        el.hidden = !expanded;
      });
      heroMoreToggle.textContent = expanded ? '접기' : '더보기';
      heroMoreToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    };

    const syncHeroMoreState = () => {
      const mobileViewport = isMobile();

      if (mobileViewport) {
        // Keep current mobile toggle state on resize; only reset when entering mobile.
        if (!wasMobileViewport) mobileHeroExpanded = false;
        applyHeroExpandedState(mobileHeroExpanded);
        heroMoreToggle.hidden = false;
      } else {
        heroExtras.forEach((el) => {
          el.hidden = false;
        });
        heroMoreToggle.hidden = true;
        heroDesc.classList.remove('expanded');
        heroMoreToggle.setAttribute('aria-expanded', 'false');
      }

      wasMobileViewport = mobileViewport;
    };

    heroMoreToggle.addEventListener('click', () => {
      const expanded = !heroDesc.classList.contains('expanded');
      if (isMobile()) mobileHeroExpanded = expanded;
      applyHeroExpandedState(expanded);
    });

    syncHeroMoreState();
    window.addEventListener('resize', syncHeroMoreState);
  }

  document.querySelectorAll('[data-legal-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openLegal(btn.dataset.legalOpen);
    });
  });

  document.querySelectorAll('[data-legal-close]').forEach((btn) => {
    btn.addEventListener('click', closeAllLegal);
  });

  Object.values(legalOverlays).forEach((overlay) => {
    if (!overlay) return;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllLegal();
    });
  });

  if (cryptoFloatBtn) {
    cryptoFloatBtn.addEventListener('click', openDonation);
    cryptoFloatBtn.addEventListener('wheel', forwardWheelToMainOnDesktop, { passive: false });
  }

  if (supportFloatLink) {
    supportFloatLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.open('https://qr.kakaopay.com/Ej7s6I5uQ', '_blank', 'noopener,noreferrer');
    });
    supportFloatLink.addEventListener('wheel', forwardWheelToMainOnDesktop, { passive: false });
  }

  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('wheel', forwardWheelToMainOnDesktop, { passive: false });
  }

  // Delegated fallback: keeps working even if button node is replaced later.
  document.addEventListener('click', (e) => {
    const openBtn = e.target.closest('#crypto-float');
    if (openBtn) {
      openDonation();
      return;
    }

    const supportBtn = e.target.closest('#support-float');
    if (supportBtn) {
      e.preventDefault();
      window.open('https://qr.kakaopay.com/Ej7s6I5uQ', '_blank', 'noopener,noreferrer');
      return;
    }

    const closeBtn = e.target.closest('#donation-close');
    if (closeBtn) {
      closeDonation();
    }
  });

  if (donationCloseBtn) {
    donationCloseBtn.addEventListener('click', closeDonation);
  }

  if (donationOverlay) {
    donationOverlay.addEventListener('click', (e) => {
      if (e.target === donationOverlay) closeDonation();
    });
  }

  if (walletCopyBtn && walletAddressEl) {
    walletCopyBtn.addEventListener('click', async () => {
      const addr = walletAddressEl.textContent?.trim() || '';
      if (!addr) return;
      try {
        await navigator.clipboard.writeText(addr);
        walletCopyBtn.textContent = '복사 완료!';
      } catch {
        walletCopyBtn.textContent = '복사 실패';
      }
      setTimeout(() => {
        walletCopyBtn.textContent = '주소 복사';
      }, 1400);
    });
  }

  syncMobileFloatingButtons();

  updateProgress();
  updateActiveNav();
  updateFloatingVisibility();

  return {
    openGlossary,
    closeGlossary,
    closeSidebar,
    isMobile,
  };
}
