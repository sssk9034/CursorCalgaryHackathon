// Content script — injected into every page matched by manifest.json.
// Runs in an isolated JS world but has full DOM access.

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    sendResponse({
      title: document.title,
      url: window.location.href,
      content: document.body.innerText,
    });
  }
  return true; // keep the message channel open for async sendResponse
});
