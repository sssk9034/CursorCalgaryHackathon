import './style.css';

const FOCUS_URL = 'http://127.0.0.1:3456/focus';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="container">
    <h1>Tab Focus</h1>
    <p class="subtitle">Clean up distracting tabs with AI</p>
    <button id="focus-btn" type="button">Activate Focus Mode</button>
    <div id="status" class="status"></div>
    <div id="results" class="results"></div>
  </div>
`;

const focusBtn = document.querySelector<HTMLButtonElement>('#focus-btn')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const resultsEl = document.querySelector<HTMLDivElement>('#results')!;

focusBtn.addEventListener('click', async () => {
  focusBtn.disabled = true;
  focusBtn.textContent = 'Analyzing...';
  statusEl.textContent = '';
  resultsEl.innerHTML = '';

  try {
    const allTabs = await browser.tabs.query({});
    const tabs = allTabs
      .filter((t) => t.id && t.url)
      .map((t) => ({ id: t.id!, url: t.url!, title: t.title ?? '' }));

    statusEl.textContent = `Analyzing ${tabs.length} tabs...`;

    const res = await fetch(FOCUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabs }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Server error ${res.status}`);
    }

    const suggestion = await res.json();

    if (suggestion.tabsToClose.length === 0) {
      statusEl.textContent = 'You look focused! No tabs to close.';
      focusBtn.disabled = false;
      focusBtn.textContent = 'Activate Focus Mode';
      return;
    }

    statusEl.textContent = suggestion.summary;

    // Show each tab suggestion with a checkbox
    resultsEl.innerHTML = `
      <div class="suggestion-list">
        ${suggestion.tabsToClose.map((t: { id: number; title: string; reason: string }, i: number) => `
          <label class="suggestion-item">
            <input type="checkbox" checked data-tab-id="${t.id}" data-index="${i}" />
            <span class="tab-title">${escapeHtml(t.title)}</span>
            <span class="tab-reason">${escapeHtml(t.reason)}</span>
          </label>
        `).join('')}
      </div>
      <button id="close-btn" type="button" class="close-btn">Close Selected Tabs</button>
    `;

    document.querySelector<HTMLButtonElement>('#close-btn')!.addEventListener('click', async () => {
      const checkboxes = resultsEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
      const tabIds = Array.from(checkboxes).map((cb) => Number(cb.dataset.tabId));
      if (tabIds.length > 0) {
        await browser.tabs.remove(tabIds);
        statusEl.textContent = `Closed ${tabIds.length} tab(s). Stay focused!`;
        resultsEl.innerHTML = '';
      }
    });
  } catch (err) {
    statusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }

  focusBtn.disabled = false;
  focusBtn.textContent = 'Activate Focus Mode';
});

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
