/* eslint-env browser */
export {};

type Aggregates = { total?: number; positive?: number; negative?: number; spam?: number };
type ToolOutput = { aggregates?: Aggregates };

const root = document.getElementById('app')!;
const w = window as unknown as { openai?: { toolOutput?: ToolOutput } };
const data = w.openai?.toolOutput ?? {};

root.innerHTML = `
  <div class="summary">
    <div class="metric"><div class="metric-label">Total</div><div class="metric-value">${data.aggregates?.total ?? 0}</div></div>
    <div class="metric"><div class="metric-label">Positive</div><div class="metric-value">${data.aggregates?.positive ?? 0}</div></div>
    <div class="metric"><div class="metric-label">Negative</div><div class="metric-value">${data.aggregates?.negative ?? 0}</div></div>
    <div class="metric"><div class="metric-label">Spam</div><div class="metric-value">${data.aggregates?.spam ?? 0}</div></div>
  </div>
`;
