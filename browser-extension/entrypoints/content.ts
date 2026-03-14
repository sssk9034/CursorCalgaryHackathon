export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    // Listen for messages from the background service worker
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_PAGE_CONTENT') {
        sendResponse({
          title: document.title,
          url: window.location.href,
          content: document.body.innerText,
        });
      }
      return true; // keep channel open for async sendResponse
    });
  },
});
