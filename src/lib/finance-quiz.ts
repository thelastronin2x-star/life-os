import type { QuizAttempt } from "./finance-store";
import type { FinancialStatus } from "./financial-health";

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}

/** Starting bank — deliberately picked from (not rendered directly) by
 *  pickQuizQuestions below, so growing this array later to more than
 *  QUIZ_LENGTH questions just means a bigger pool to draw from, not a
 *  restructure of how the quiz is assembled. */
export const FINANCIAL_LITERACY_QUESTIONS: QuizQuestion[] = [
  {
    id: "compound-interest",
    prompt: "Ти вклав ₴10 000 під 10% річних зі складним відсотком. Скільки буде приблизно через 20 років?",
    options: [
      { id: "a", text: "₴20 000" },
      { id: "b", text: "₴30 000" },
      { id: "c", text: "₴67 000" },
      { id: "d", text: "₴200 000" },
    ],
    correctOptionId: "c",
    explanation: "Складний відсоток росте по експоненті, не лінійно: 10 000 × 1.10^20 ≈ 67 000.",
  },
  {
    id: "inflation",
    prompt: "Інфляція 10% на рік означає, що...",
    options: [
      { id: "a", text: "Гроші в банку зростають на 10%" },
      { id: "b", text: "Ціни в середньому зростають на 10%, а купівельна спроможність грошей падає" },
      { id: "c", text: "Зарплати автоматично зростають на 10%" },
      { id: "d", text: "Курс валюти стабільний" },
    ],
    correctOptionId: "b",
    explanation: "Інфляція — знецінення грошей: за ту саму суму через рік купиш менше товарів.",
  },
  {
    id: "diversification",
    prompt: "Чому радять не тримати всі інвестиції в одному активі?",
    options: [
      { id: "a", text: "Так менше податків" },
      { id: "b", text: "Диверсифікація знижує ризик — якщо один актив впаде, інші можуть компенсувати" },
      { id: "c", text: "Це вимога закону" },
      { id: "d", text: "Так вища гарантована дохідність" },
    ],
    correctOptionId: "b",
    explanation: "Диверсифікація не гарантує вищий прибуток — вона знижує ризик падіння всього портфеля через один актив.",
  },
  {
    id: "emergency-fund",
    prompt: 'Для чого потрібна "подушка безпеки", якщо гроші могли б працювати в інвестиціях?',
    options: [
      { id: "a", text: "Для купівлі акцій за вигідною ціною" },
      { id: "b", text: "Щоб мати ліквідні гроші на непередбачені витрати, не продаючи інвестиції в невдалий момент" },
      { id: "c", text: "Це вимога банку для відкриття рахунку" },
      { id: "d", text: "Подушка безпеки не потрібна, якщо є інвестиції" },
    ],
    correctOptionId: "b",
    explanation: "Без подушки безпеки людина змушена продавати інвестиції в будь-який момент, навіть коли ринок впав.",
  },
  {
    id: "debt-vs-invest",
    prompt: "У тебе є вільні ₴10 000. Кредитна картка з боргом під 40% річних чи інвестиція з очікуваною дохідністю 12% річних — куди спершу направити гроші?",
    options: [
      { id: "a", text: "В інвестицію — вона довгостроково вигідніша" },
      { id: "b", text: 'На погашення боргу — 40% "дохідності" від закриття боргу гарантовані й вищі за 12%' },
      { id: "c", text: "Порівну між обома" },
      { id: "d", text: "Не має значення" },
    ],
    correctOptionId: "b",
    explanation: 'Погашення боргу під 40% — гарантована "дохідність" 40%, вища за ризиковані 12% від інвестиції.',
  },
];

const QUIZ_LENGTH = 5;

/** Random subset of `count` questions from `bank` — currently the whole
 *  starting bank (5 of 5, order shuffled), but written so a later-expanded
 *  bank just means a real subset gets drawn instead of always the same 5. */
export function pickQuizQuestions(bank: QuizQuestion[] = FINANCIAL_LITERACY_QUESTIONS, count = QUIZ_LENGTH): QuizQuestion[] {
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function quizStatus(lastAttempt: QuizAttempt | null): FinancialStatus {
  if (!lastAttempt) return "bad";
  if (lastAttempt.scorePct >= 80) return "good";
  if (lastAttempt.scorePct >= 60) return "warn";
  return "bad";
}
