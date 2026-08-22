// Types for the clarification-card design mock (QuestionCardMock.vue).
// Kept in a plain module rather than exported from <script setup>, which type
// consumers cannot reliably resolve.

export interface QuestionOption {
  id: string;
  /** Secondary line under the label — why this option, or what it implies. */
  label: string;
  hint?: string;
}

export interface QuestionSpec {
  id: string;
  prompt: string;
  /** single = pick one and advance immediately; multi = tick several, then Next. */
  mode: 'single' | 'multi';
  options: QuestionOption[];
  /** Show the free-text "Something else" row. */
  allowOther?: boolean;
  /** Offer Skip on this question. */
  skippable?: boolean;
}
