function stripHtml(input = '') {
  return String(input).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text = '') {
  const matches = String(text).toLowerCase().match(/[a-z0-9가-힣]{2,}/g);
  return matches ?? [];
}

function unique(arr) {
  return [...new Set(arr)];
}

function clampText(text, maxLen = 180) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}...`;
}

function buildCorpus(chapters, glossaryTerms) {
  const entries = [];

  chapters.forEach((ch, chIdx) => {
    const chapterBase = `CH ${ch.num} ${ch.title}`;
    const chapterText = [
      ch.title,
      ch.subtitle,
      ...(ch.keyPoints || []),
      ...(ch.sections || []).map((s) => [s.title, stripHtml(s.body), s.formula, s.formulaNote, s.card?.text].filter(Boolean).join(' ')),
    ]
      .filter(Boolean)
      .join(' ');

    entries.push({
      id: `chapter-${chIdx}`,
      kind: 'chapter',
      label: chapterBase,
      title: ch.title,
      text: chapterText,
      tokens: unique(tokenize(`${chapterBase} ${chapterText}`)),
    });

    (ch.sections || []).forEach((sec, secIdx) => {
      const secText = [
        sec.title,
        stripHtml(sec.body),
        sec.formula,
        sec.formulaNote,
        sec.card?.text,
        ...(sec.table?.headers || []),
        ...((sec.table?.rows || []).flat()),
      ]
        .filter(Boolean)
        .join(' ');

      entries.push({
        id: `chapter-${chIdx}-sec-${secIdx}`,
        kind: 'section',
        label: `${chapterBase} > ${sec.title}`,
        title: sec.title,
        text: secText,
        tokens: unique(tokenize(`${chapterBase} ${sec.title} ${secText}`)),
      });
    });
  });

  glossaryTerms.forEach((term, idx) => {
    const text = `${term.term} ${term.def}`;
    entries.push({
      id: `glossary-${idx}`,
      kind: 'glossary',
      label: `용어집 > ${term.term}`,
      title: term.term,
      text,
      tokens: unique(tokenize(text)),
    });
  });

  return entries;
}

function scoreEntry(entry, queryTokens, queryText) {
  if (!queryTokens.length) return 0;

  const tokenSet = new Set(entry.tokens);
  const lowerLabel = entry.label.toLowerCase();
  const lowerText = entry.text.toLowerCase();
  let score = 0;

  queryTokens.forEach((token) => {
    if (tokenSet.has(token)) score += 2;
    if (lowerLabel.includes(token)) score += 2;
    else if (lowerText.includes(token)) score += 1;
  });

  if (lowerText.includes(queryText)) score += 4;
  return score;
}

function buildAnswer(query, ranked) {
  if (!ranked.length) {
    return [
      '아직 해당 질문과 정확히 맞는 내용을 찾지 못했어요.',
      '용어명이나 챕터 키워드(예: 스테이블코인, AMM, MEV)로 다시 물어보면 더 정확히 답할 수 있어요.',
    ].join('\n');
  }

  const top = ranked.slice(0, 3);
  const lines = top.map((item, idx) => {
    const prefix = idx === 0 ? '핵심' : '참고';
    return `${prefix}: ${item.label}\n${clampText(item.text)}`;
  });

  const intro = `질문: ${query}\n아래 페이지 내용을 기준으로 정리해봤어요.`;
  return `${intro}\n\n${lines.join('\n\n')}`;
}

function buildContextSnippets(ranked) {
  return ranked.slice(0, 4).map((item) => ({
    source: item.label,
    text: clampText(item.text, 400),
  }));
}

export function createAssistant({ chapters, glossaryTerms, remoteAsk }) {
  const corpus = buildCorpus(chapters, glossaryTerms);

  function retrieve(question) {
    const query = String(question || '').trim();
    const queryTokens = unique(tokenize(query));
    const queryText = query.toLowerCase();

    return corpus
      .map((entry) => ({
        ...entry,
        score: scoreEntry(entry, queryTokens, queryText),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  return {
    async ask(question) {
      const query = String(question || '').trim();
      if (!query) {
        return '질문이 비어 있어요. 궁금한 개념을 한 문장으로 입력해 주세요.';
      }

      if (query.length < 2) {
        return '질문을 조금만 더 길게 적어주세요. 예: "PoS랑 PoW 차이 쉽게 설명해줘"';
      }

      const ranked = retrieve(query);
      const contextSnippets = buildContextSnippets(ranked);

      if (remoteAsk) {
        try {
          const remote = await remoteAsk({
            question: query,
            contextSnippets,
          });
          if (remote && typeof remote === 'string' && remote.trim()) {
            return remote.trim();
          }
        } catch (err) {
          const reason = err instanceof Error ? err.message : '원격 AI 연결 실패';
          const local = buildAnswer(query, ranked);
          return `원격 AI 연결에 실패해 임시 로컬 모드로 답변합니다.\n사유: ${reason}\n\n${local}`;
        }
      }

      return buildAnswer(query, ranked);
    },
  };
}
