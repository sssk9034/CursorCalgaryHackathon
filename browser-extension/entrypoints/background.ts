export default defineBackground(() => {
  console.log('Extension installed — background service worker running');

  // On action click, read the active tab's page content
  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !tab.url || tab.url.startsWith('chrome://')) return;

    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    });

    if (results?.[0]) {
      console.log('Page content length:', results[0].result?.length);
    }
  });
});
