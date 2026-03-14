// Background service worker — event-driven, no persistent state
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});
