import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(process.cwd(), 'repo_stepintocrypto');
const contentPath = path.join(rootDir, 'content', 'chapters.json');
const staticContentPath = path.join(rootDir, 'content', 'chapters-static.json');
const baseUrl = 'https://stepintocrypto.xyz';

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const escapeHtml = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const stripHtml = (html) =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeForExcerpt = (html) =>
  String(html)
    .replace(/<span class="term-tip">[\s\S]*?<\/span>/g, '')
    .replace(/<\/?span class="term">/g, '');

const buildStyles = () => `
  :root {
    --bg: #050811;
    --surface: #0d1520;
    --border: #1e3a5f;
    --accent: #00d4ff;
    --accent2: #ff6b35;
    --accent3: #7fff6b;
    --text: #c8dff5;
    --text-bright: #f0f8ff;
    --text-muted: #7fa0c3;
    --tracking-base: 0.2px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: "Noto Sans KR", sans-serif;
    line-height: 1.7;
    font-weight: 300;
    letter-spacing: var(--tracking-base);
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .shell { max-width: 900px; margin: 0 auto; padding: 28px 20px 48px; }
  .topnav {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 11px;
    margin-bottom: 18px;
    font-family: "IBM Plex Mono", monospace;
    letter-spacing: 1px;
  }
  .hero {
    background: linear-gradient(180deg, rgba(0, 212, 255, 0.1), rgba(13, 21, 32, 0.95));
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
  }
  .label {
    display: inline-block;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    color: var(--accent);
    margin-bottom: 8px;
    letter-spacing: 2px;
  }
  h1 {
    margin: 0 0 8px;
    color: var(--text-bright);
    font-size: 22px;
    line-height: 1.3;
    font-family: "Syne", sans-serif;
    font-weight: 800;
  }
  .subtitle {
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
    font-family: "IBM Plex Mono", monospace;
    letter-spacing: 1px;
  }
  .key-points, .section, .toc, .card, table {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .toc, .key-points { padding: 16px; margin-bottom: 14px; }
  .toc h2, .key-points h2 {
    margin: 0 0 10px;
    font-size: 10px;
    color: var(--accent);
    font-family: "IBM Plex Mono", monospace;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .toc li, .key-points li {
    font-size: 13px;
    line-height: 1.6;
  }
  ul { margin: 0; padding-left: 20px; }
  .sections { display: grid; gap: 14px; }
  .section { padding: 18px; }
  .section h2 {
    margin: 0 0 12px;
    font-size: 16px;
    color: var(--text-bright);
    font-family: "Syne", sans-serif;
    font-weight: 700;
  }
  .section-body { font-size: 13.5px; line-height: 1.85; }
  .section-body p { margin: 0 0 12px; }
  .section-body h3 {
    margin: 18px 0 10px;
    font-size: 13px;
    color: var(--accent);
    font-family: "IBM Plex Mono", monospace;
    letter-spacing: 1px;
    font-weight: 400;
  }
  .section-body h4 {
    margin: 14px 0 8px;
    font-size: 12px;
    color: var(--text-muted);
    font-family: "IBM Plex Mono", monospace;
    letter-spacing: 0.8px;
    font-weight: 400;
  }
  .section-body ul {
    margin: 0 0 12px;
    padding-left: 20px;
  }
  .section-body li {
    margin: 0 0 8px;
  }
  .formula {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(127, 255, 107, 0.06);
    color: var(--accent3);
    font-family: "IBM Plex Mono", monospace;
    font-size: 18px;
    text-align: center;
  }
  .formula-note { margin-top: 8px; color: var(--text-muted); font-size: 14px; }
  .card { margin-top: 12px; padding: 12px 14px; }
  .card h3 {
    margin: 0 0 6px;
    font-size: 9px;
    letter-spacing: 2px;
    font-family: "IBM Plex Mono", monospace;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 400;
  }
  .card.warn { border-color: rgba(255, 107, 53, 0.6); background: rgba(255, 107, 53, 0.08); }
  .card.warn h3 { color: var(--accent2); }
  .card.success { border-color: rgba(127, 255, 107, 0.5); background: rgba(127, 255, 107, 0.08); }
  .card.success h3 { color: var(--accent3); }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; overflow: hidden; }
  th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
  th {
    background: rgba(0, 212, 255, 0.08);
    color: var(--accent);
    font-size: 10px;
    font-family: "IBM Plex Mono", monospace;
    letter-spacing: 2px;
    font-weight: 400;
  }
  td {
    font-size: 12.5px;
    line-height: 1.6;
  }
  .pager {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    text-align: center;
  }
  .pager a {
    display: block;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
  }
  .hub-list { display: grid; gap: 10px; margin-top: 16px; }
  .hub-item {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--surface);
    padding: 14px;
  }
  .hub-item h2 {
    margin: 0 0 6px;
    font-size: 16px;
    color: var(--text-bright);
    font-family: "Syne", sans-serif;
    font-weight: 700;
  }
  .hub-item p { margin: 0; color: var(--text-muted); font-size: 12.5px; line-height: 1.7; }
`;

const pageTemplate = ({ title, description, canonicalPath, body, jsonLd }) => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" />
  <link rel="canonical" href="${baseUrl}${canonicalPath}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${baseUrl}${canonicalPath}" />
  <meta property="og:site_name" content="Step into Crypto" />
  <meta property="og:image" content="${baseUrl}/og-cover-v2.png?v=20260301" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${baseUrl}/og-cover-v2.png?v=20260301" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=IBM+Plex+Mono:wght@300;400;600&family=Noto+Sans+KR:wght@300;400;700&display=swap" rel="stylesheet" />
  <style>${buildStyles()}</style>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  ${body}
  <script type="module" src="/src/agentation-dev-loader.js"></script>
</body>
</html>
`;

const buildChapterBody = (chapter, prevChapter, nextChapter) => {
  const sectionLinks = chapter.sections
    .map((sec, idx) => `<li><a href="#sec-${idx + 1}">${escapeHtml(sec.title)}</a></li>`)
    .join('');

  const sections = chapter.sections
    .map((sec, idx) => {
      const card = sec.card
        ? `<div class="card ${escapeHtml(sec.card.type || '')}">
            <h3>${escapeHtml(sec.card.tag || '핵심')}</h3>
            <div>${sec.card.text}</div>
          </div>`
        : '';

      const formula = sec.formula
        ? `<div class="formula">${sec.formula}</div>${
            sec.formulaNote ? `<div class="formula-note">${sec.formulaNote}</div>` : ''
          }`
        : '';

      const table = sec.table
        ? `<table>
            <thead><tr>${sec.table.headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
              ${sec.table.rows
                .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
                .join('')}
            </tbody>
          </table>`
        : '';

      return `<section class="section" id="sec-${idx + 1}">
        <h2>${escapeHtml(sec.title)}</h2>
        <div class="section-body">${sec.body}</div>
        ${formula}
        ${card}
        ${table}
      </section>`;
    })
    .join('');

  return `<main class="shell">
    <nav class="topnav">
      <a href="/">홈</a>
      <a href="/chapters">챕터 허브</a>
      <a href="/guestbook">방명록</a>
    </nav>

    <header class="hero">
      <span class="label">CH ${escapeHtml(chapter.num)}</span>
      <h1>${escapeHtml(chapter.title)}</h1>
      <p class="subtitle">${escapeHtml(chapter.subtitle)}</p>
    </header>

    <section class="toc">
      <h2>목차</h2>
      <ul>${sectionLinks}</ul>
    </section>

    <section class="key-points">
      <h2>핵심 포인트</h2>
      <ul>${chapter.keyPoints.map((kp) => `<li>${kp}</li>`).join('')}</ul>
    </section>

    <div class="sections">${sections}</div>

    <nav class="pager">
      ${
        prevChapter
          ? `<a href="/chapter-${prevChapter.num}">← CH ${escapeHtml(prevChapter.num)} ${escapeHtml(
              prevChapter.title,
            )}</a>`
          : '<span></span>'
      }
      <a href="/chapters">전체 챕터</a>
      ${
        nextChapter
          ? `<a href="/chapter-${nextChapter.num}">CH ${escapeHtml(nextChapter.num)} ${escapeHtml(
              nextChapter.title,
            )} →</a>`
          : '<span></span>'
      }
    </nav>
  </main>`;
};

const buildHubBody = (chapters) => {
  const items = chapters
    .map((ch) => {
      const excerpt = stripHtml(normalizeForExcerpt(ch.sections?.[0]?.body || '')).slice(0, 180);
      return `<article class="hub-item">
        <h2><a href="/chapter-${ch.num}">CH ${escapeHtml(ch.num)} · ${escapeHtml(ch.title)}</a></h2>
        <p>${escapeHtml(ch.subtitle)}</p>
        <p>${escapeHtml(excerpt)}...</p>
      </article>`;
    })
    .join('');

  return `<main class="shell">
    <nav class="topnav">
      <a href="/">홈</a>
      <a href="/guestbook">방명록</a>
    </nav>
    <header class="hero">
      <span class="label">CONTENT HUB</span>
      <h1>Step into Crypto 챕터 라이브러리</h1>
      <p class="subtitle">각 챕터를 독립 URL에서 바로 읽을 수 있습니다. (검색엔진 크롤링 최적화)</p>
    </header>
    <section class="hub-list">${items}</section>
  </main>`;
};

const buildChapterJsonLd = (chapter, chapterPath, index) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: `${chapter.title} - Step into Crypto`,
  description: stripHtml(normalizeForExcerpt(chapter.sections?.[0]?.body || '')).slice(0, 160),
  inLanguage: 'ko-KR',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Step into Crypto',
    url: `${baseUrl}/`,
  },
  mainEntityOfPage: `${baseUrl}${chapterPath}`,
  url: `${baseUrl}${chapterPath}`,
  position: index + 1,
  author: {
    '@type': 'Person',
    name: 'Max8',
  },
});

const writeStaticChapterPages = async () => {
  const chapters = await readJson(staticContentPath).catch(() => readJson(contentPath));
  const pagePaths = [];

  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i];
    const prevChapter = i > 0 ? chapters[i - 1] : null;
    const nextChapter = i < chapters.length - 1 ? chapters[i + 1] : null;
    const chapterFile = `chapter-${chapter.num}.html`;
    const chapterPath = `/chapter-${chapter.num}`;
    const description = stripHtml(normalizeForExcerpt(chapter.sections?.[0]?.body || chapter.subtitle)).slice(0, 150);
    const jsonLd = buildChapterJsonLd(chapter, chapterPath, i);

    const html = pageTemplate({
      title: `CH ${chapter.num} ${chapter.title} | Step into Crypto`,
      description,
      canonicalPath: chapterPath,
      body: buildChapterBody(chapter, prevChapter, nextChapter),
      jsonLd,
    });

    await fs.writeFile(path.join(rootDir, chapterFile), html, 'utf8');
    pagePaths.push(chapterPath);
  }

  const hubHtml = pageTemplate({
    title: 'Step into Crypto 챕터 라이브러리',
    description: '크립토 기초부터 DeFi, MEV, DAO, DePIN까지 챕터별로 읽을 수 있는 정적 콘텐츠 허브',
    canonicalPath: '/chapters',
    body: buildHubBody(chapters),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Step into Crypto 챕터 라이브러리',
      url: `${baseUrl}/chapters`,
      inLanguage: 'ko-KR',
    },
  });

  await fs.writeFile(path.join(rootDir, 'chapters.html'), hubHtml, 'utf8');

  const sitemapEntries = ['/', '/chapters', '/guestbook', ...pagePaths]
    .map((page) => `<url><loc>${baseUrl}${page}</loc></url>`)
    .join('');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`;
  await fs.writeFile(path.join(rootDir, 'sitemap.xml'), sitemap, 'utf8');

  const robots = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;
  await fs.writeFile(path.join(rootDir, 'robots.txt'), robots, 'utf8');
};

await writeStaticChapterPages();
console.log('Static chapter pages generated.');
