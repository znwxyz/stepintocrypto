import { initUI } from './ui.js';
import { createQuizController } from './quiz.js';
import { loadContent } from './content.js';

history.scrollRestoration = 'manual';

const { chapters, glossaryTerms, quizData } = await loadContent();

const quiz = createQuizController({ quizData, chapters });

let ui;
ui = initUI({
  chapters,
  glossaryTerms,
  onOpenQuiz: () => {
    ui.closeGlossary();
    quiz.open();
  },
  onOpenGlossary: () => {
    quiz.close();
    ui.openGlossary();
  },
});
