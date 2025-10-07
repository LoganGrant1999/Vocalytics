// src/tw-replies.ts
var root = document.getElementById("app");
var data = window.openai?.toolOutput ?? {};
var list = (data?.suggestions ?? []).map(
  (s) => `
  <div class="reply">
    <div class="tone-badge">${s.tone}</div>
    <div class="reply-text">${s.text}</div>
  </div>`
).join("");
root.innerHTML = `<div class="replies">${list || "<em>No suggestions.</em>"}</div>`;
