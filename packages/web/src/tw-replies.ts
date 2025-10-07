const root = document.getElementById('app')!;
const data = (window as any).openai?.toolOutput ?? {};
const list = (data?.suggestions ?? [])
  .map(
    (s: any) => `
  <div class="reply">
    <div class="tone-badge">${s.tone}</div>
    <div class="reply-text">${s.text}</div>
  </div>`
  )
  .join('');
root.innerHTML = `<div class="replies">${list || '<em>No suggestions.</em>'}</div>`;
