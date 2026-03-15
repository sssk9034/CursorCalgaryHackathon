import './style.css';

const FOCUS_URL = 'http://127.0.0.1:3456/focus';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="container">
    <h1>Tab Focus</h1>
    <p class="subtitle">Hide distracting tabs so you can focus</p>
    <button id="focus-btn" type="button">Hide Distracting Tabs</button>
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

    const text = await res.text();
    if (!res.ok) {
      let errorMsg = `Server error ${res.status}`;
      try {
        const err = JSON.parse(text);
        errorMsg = err.error || errorMsg;
      } catch { /* not JSON */ }
      throw new Error(errorMsg);
    }

    const suggestion = JSON.parse(text);

    if (!suggestion.tabsToClose || suggestion.tabsToClose.length === 0) {
      statusEl.textContent = 'You look focused! No distracting tabs found.';
      focusBtn.disabled = false;
      focusBtn.textContent = 'Hide Distracting Tabs';
      return;
    }

    statusEl.textContent = suggestion.summary;

    resultsEl.innerHTML = `
      <div class="suggestion-list">
        ${suggestion.tabsToClose.map((t: { id: number; title: string; reason: string }, i: number) => `
          <label class="suggestion-item">
            <input type="checkbox" checked data-tab-id="${t.id}" data-index="${i}" />
            <span class="tab-info">
              <span class="tab-title">${escapeHtml(t.title)}</span>
              <span class="tab-reason">${escapeHtml(t.reason)}</span>
            </span>
          </label>
        `).join('')}
      </div>
      <button id="hide-btn" type="button" class="hide-btn">Hide Selected Tabs</button>
    `;

    document.querySelector<HTMLButtonElement>('#hide-btn')!.addEventListener('click', async () => {
      const checkboxes = resultsEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
      const tabIds = Array.from(checkboxes).map((cb) => Number(cb.dataset.tabId));
      if (tabIds.length > 0) {
        // Group the distracting tabs into a collapsed group
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, {
          title: 'Distractions',
          color: 'grey',
          collapsed: true,
        });
        statusEl.textContent = `Grouped ${tabIds.length} tab(s) into "Distractions" (collapsed). Expand the group to get them back.`;
        resultsEl.innerHTML = '';
      }
    });
  } catch (err) {
    statusEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    console.error('Focus mode error:', err);
  }

  focusBtn.disabled = false;
  focusBtn.textContent = 'Hide Distracting Tabs';
});

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
