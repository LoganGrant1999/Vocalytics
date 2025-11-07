/* eslint-env browser */
export {};

type Suggestion = { id?: string; tone: string; text: string };
type ToolOutput = { suggestions?: Suggestion[]; original?: string; commentId?: string };

const root = document.getElementById('app')!;
const w = window as unknown as { openai?: { toolOutput?: ToolOutput } };
const data = w.openai?.toolOutput ?? {};
const list = (data.suggestions ?? []).map(
  (s) => `
  <div class="reply">
    <div class="tone-badge">${s.tone}</div>
    <div class="reply-text">${s.text}</div>
  </div>`
).join('');

root.innerHTML = `<div class="replies">${list || '<em>No suggestions.</em>'}</div>`;
