import { initUI } from './ui.js?v=20260302b';
import { createQuizController } from './quiz.js?v=20260302b';
import { loadContent } from './content.js?v=20260302b';
import { createAssistant } from './assistant.js?v=20260302b';

history.scrollRestoration = 'manual';

const SUPABASE_URL = window.SIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SIC_SUPABASE_ANON_KEY || '';
const AI_FUNCTION_NAME = window.SIC_AI_FUNCTION_NAME || 'site-assistant';

function canUseRemoteAI() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && AI_FUNCTION_NAME);
}

async function askRemoteAI({ question, contextSnippets }) {
  if (!canUseRemoteAI()) {
    throw new Error('Remote AI config missing');
  }

  const baseUrl = SUPABASE_URL.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/functions/v1/${AI_FUNCTION_NAME}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      question,
      contextSnippets,
    }),
  });

  if (!res.ok) {
    const detailText = await res.text().catch(() => '');
    let detailMessage = detailText;
    try {
      const parsed = JSON.parse(detailText);
      const detailFirst = parsed?.detail ?? parsed?.message ?? parsed?.error;
      if (typeof detailFirst === 'string') detailMessage = detailFirst;
      else if (detailFirst) detailMessage = JSON.stringify(detailFirst);
      else detailMessage = detailText;
    } catch {
      // Keep raw response text.
    }
    throw new Error(`원격 AI 오류 (${res.status}): ${detailMessage || '응답 없음'}`);
  }

  const data = await res.json();
  const answer = data?.answer;
  if (!answer || typeof answer !== 'string') {
    throw new Error('Remote AI response invalid');
  }
  return answer;
}

const { chapters, glossaryTerms, quizData } = await loadContent();

const quiz = createQuizController({ quizData, chapters });
const assistant = createAssistant({
  chapters,
  glossaryTerms,
  remoteAsk: canUseRemoteAI() ? askRemoteAI : null,
});

let ui;
ui = initUI({
  chapters,
  glossaryTerms,
  onOpenQuiz: () => {
    ui.closeGlossary();
    ui.closeAI();
    quiz.open();
  },
  onOpenGlossary: () => {
    quiz.close();
    ui.closeAI();
    ui.openGlossary();
  },
  onOpenAI: () => {
    quiz.close();
    ui.closeGlossary();
    ui.openAI();
  },
  onAskAI: (question) => assistant.ask(question),
});
