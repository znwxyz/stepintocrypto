export async function loadContent() {
  try {
    const [chaptersRes, glossaryRes, quizRes] = await Promise.all([
      fetch('./content/chapters.json'),
      fetch('./content/glossary.json'),
      fetch('./content/quiz.json'),
    ]);

    if (!chaptersRes.ok || !glossaryRes.ok || !quizRes.ok) {
      throw new Error('Failed to load one or more JSON content files.');
    }

    const [chapters, glossaryTerms, quizData] = await Promise.all([
      chaptersRes.json(),
      glossaryRes.json(),
      quizRes.json(),
    ]);

    return { chapters, glossaryTerms, quizData };
  } catch {
    // Fallback for environments where JSON fetch is unavailable.
    const mod = await import('./data.js');
    const fallbackChapterIds = ['01', '02', '03', '07', '06', '08', '09', '12', '13', '10'];
    const fallbackDifficulties = ['easy', 'easy', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard'];

    const quizData = mod.QUIZ_DATA.map((q, i) => ({
      id: `q-${String(i + 1).padStart(3, '0')}`,
      chapter: fallbackChapterIds[i] ?? '00',
      difficulty: fallbackDifficulties[i] ?? 'medium',
      ...q,
    }));

    return {
      chapters: mod.CHAPTERS,
      glossaryTerms: mod.GLOSSARY_TERMS,
      quizData,
    };
  }
}
