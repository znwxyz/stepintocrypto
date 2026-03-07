import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const rootDir = path.resolve(process.cwd(), 'repo_stepintocrypto');
const baseChaptersPath = path.join(rootDir, 'content', 'chapters.json');
const outputPath = path.join(rootDir, 'content', 'chapters-static.json');

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: node repo_stepintocrypto/scripts/build-static-content-from-manual.mjs <manual.rtf>');
  process.exit(1);
}

const romanToNum = new Map([
  ['I', '01'],
  ['II', '02'],
  ['III', '03'],
  ['IV', '04'],
  ['V', '05'],
  ['VI', '06'],
  ['VII', '07'],
  ['VIII', '08'],
  ['IX', '09'],
  ['X', '10'],
  ['XI', '11'],
  ['XII', '12'],
  ['XIII', '13'],
  ['XIV', '14'],
  ['XV', '15'],
]);

const escapeHtml = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const formatParagraph = (line) => {
  let text = escapeHtml(line.trim());
  // Keep lightweight emphasis from markdown-like markers in source doc.
  text = text.replace(/\*\*([^*]+)\*\*/g, '<b style="color:var(--text-bright)">$1</b>');
  return text;
};

const toBodyHtml = (lines) => {
  const blocks = [];
  let paragraphBuffer = [];
  let listBuffer = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const merged = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
    if (merged) blocks.push(`<p>${formatParagraph(merged)}</p>`);
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push(`<ul>${listBuffer.map((item) => `<li>${formatParagraph(item)}</li>`).join('')}</ul>`);
    listBuffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const h4 = line.match(/^####\s+(.+)$/);
    if (h4) {
      flushParagraph();
      flushList();
      blocks.push(`<h4>${formatParagraph(h4[1])}</h4>`);
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flushParagraph();
      flushList();
      blocks.push(`<h3>${formatParagraph(h3[1])}</h3>`);
      continue;
    }

    const bullet = line.match(/^[*-]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      listBuffer.push(bullet[1]);
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  return blocks.join('\n');
};

const normalizeSectionTitle = (rawTitle) =>
  rawTitle
    .replace(/^Section\s+[IVXLC]+\s*:\s*/i, '')
    .trim();

const parseManual = (text) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const firstPreface = lines.findIndex((line) => line.trim() === '# Preface: Why This Matters');
  const scanLines = firstPreface >= 0 ? lines.slice(firstPreface) : lines;

  const chapters = new Map();
  let currentChapter = null;
  let currentSection = null;

  const ensureChapter = (chapterNum) => {
    if (!chapters.has(chapterNum)) chapters.set(chapterNum, []);
    return chapters.get(chapterNum);
  };

  for (const rawLine of scanLines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      if (currentSection) currentSection.lines.push('');
      continue;
    }

    if (line === '# Preface: Why This Matters') {
      currentChapter = '00';
      currentSection = null;
      ensureChapter(currentChapter);
      continue;
    }

    const chapterMatch = line.match(/^#\s+Chapter\s+([IVXLC]+)\s*:\s*(.+)$/i);
    if (chapterMatch) {
      const roman = chapterMatch[1].toUpperCase();
      const mappedNum = romanToNum.get(roman);
      if (!mappedNum) continue;
      currentChapter = mappedNum;
      currentSection = null;
      ensureChapter(currentChapter);
      continue;
    }

    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch && currentChapter) {
      const section = {
        title: normalizeSectionTitle(sectionMatch[1]),
        lines: [],
      };
      ensureChapter(currentChapter).push(section);
      currentSection = section;
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    }
  }

  return chapters;
};

const manualText = execFileSync('textutil', ['-convert', 'txt', '-stdout', inputPath], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

const parsedChapters = parseManual(manualText);
const baseChapters = JSON.parse(await fs.readFile(baseChaptersPath, 'utf8'));

const merged = baseChapters.map((chapter) => {
  const parsedSections = parsedChapters.get(chapter.num) || [];
  if (!parsedSections.length) return chapter;

  return {
    ...chapter,
    sections: parsedSections
      .map((section) => ({
        title: section.title,
        body: toBodyHtml(section.lines),
      }))
      .filter((section) => section.body.trim().length > 0),
  };
});

await fs.writeFile(outputPath, JSON.stringify(merged, null, 2), 'utf8');
console.log(`Wrote ${outputPath}`);
