export default defineBackground(() => {
  console.log("Background running", { id: browser.runtime.id });

  const INGEST_URL = "http://127.0.0.1:3456/events";

  interface TabSwitchEvent {
    url: string | undefined;
    name: string | undefined;
    time_utc: string;
    tabCount: number;
  }

  async function sendToServer(event: TabSwitchEvent) {
    try {
      const res = await fetch(INGEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        console.warn("Server responded with", res.status);
      }
    } catch {
      // Electron app likely not running — fall back to local storage only
      console.warn("Could not reach ingest server, storing locally");
    }
  }

  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    const [tab, allTabs] = await Promise.all([
      browser.tabs.get(tabId),
      browser.tabs.query({}),
    ]);

    // Exclude tabs in the "Distractions" group from the count
    const distractionGroups = await chrome.tabGroups.query({ title: "Distractions" });
    const distractionGroupIds = new Set(distractionGroups.map((g) => g.id));
    const activeTabs = allTabs.filter((t) => !distractionGroupIds.has(t.groupId));

    const entry: TabSwitchEvent = {
      url: tab.url,
      name: tab.title,
      time_utc: new Date().toISOString(),
      tabCount: activeTabs.length,
    };

    // Store locally as backup
    const result = await browser.storage.local.get("tabSwitchEvents");
    const events: TabSwitchEvent[] = (result.tabSwitchEvents as TabSwitchEvent[]) || [];
    events.push(entry);
    await browser.storage.local.set({ tabSwitchEvents: events });

    // Send to Electron app
    await sendToServer(entry);

    console.log(JSON.stringify(entry));
  });
});
