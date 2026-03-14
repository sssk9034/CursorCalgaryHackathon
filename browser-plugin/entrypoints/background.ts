export default defineBackground(() => {
  console.log("Background running", { id: browser.runtime.id });

  interface TabSwitchEvent {
    url: string | undefined;
    name: string | undefined;
    time_utc: string;
    tabCount: number;
  }

  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    const [tab, allTabs] = await Promise.all([
      browser.tabs.get(tabId),
      browser.tabs.query({}),
    ]);

    const entry: TabSwitchEvent = {
      url: tab.url,
      name: tab.title,
      time_utc: new Date().toISOString(),
      tabCount: allTabs.length,
    };

    const result = await browser.storage.local.get("tabSwitchEvents");
    const events: TabSwitchEvent[] = (result.tabSwitchEvents as TabSwitchEvent[]) || [];
    events.push(entry);
    await browser.storage.local.set({ tabSwitchEvents: events });

    console.log(JSON.stringify(entry));
  });
});
