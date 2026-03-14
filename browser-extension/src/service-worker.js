// Service worker — event-driven background script (no persistent state).
// Use chrome.storage for persistence if needed.

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Example: on action click, inject a script to read page content
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.url.startsWith('chrome://')) return;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.documentElement.outerHTML,
  });

  if (results && results[0]) {
    console.log('Page content length:', results[0].result.length);
  }
});
