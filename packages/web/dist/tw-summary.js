// src/tw-summary.ts
var root = document.getElementById("app");
var w = window;
var data = w.openai?.toolOutput ?? {};
root.innerHTML = `
  <div class="summary">
    <div class="metric"><div class="metric-label">Total</div><div class="metric-value">${data.aggregates?.total ?? 0}</div></div>
    <div class="metric"><div class="metric-label">Positive</div><div class="metric-value">${data.aggregates?.positive ?? 0}</div></div>
    <div class="metric"><div class="metric-label">Negative</div><div class="metric-value">${data.aggregates?.negative ?? 0}</div></div>
    <div class="metric"><div class="metric-label">Spam</div><div class="metric-value">${data.aggregates?.spam ?? 0}</div></div>
  </div>
`;
