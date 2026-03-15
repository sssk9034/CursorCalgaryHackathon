const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface TabInfo {
  id: number;
  url: string;
  title: string;
}

export interface FocusSuggestion {
  tabsToClose: { id: number; url: string; title: string; reason: string }[];
  summary: string;
}

export async function getFocusSuggestions(
  tabs: TabInfo[],
  apiKey: string,
): Promise<FocusSuggestion> {
  const tabList = tabs
    .map((t) => `- [id:${t.id}] "${t.title}" (${t.url})`)
    .join('\n');

  const prompt = `You are a focus coach. The user has the following browser tabs open and is getting distracted by context switching too much.

Analyze these tabs and suggest which ones should be closed to help the user focus. Keep tabs that look like active work (docs they're reading, code editors, tools they're using). Close tabs that are distractions (social media, unrelated browsing, duplicate searches, stale tabs).

Open tabs:
${tabList}

Respond with ONLY valid JSON in this exact format, no markdown:
{
  "tabsToClose": [
    { "id": <tab_id>, "url": "<url>", "title": "<title>", "reason": "<short reason>" }
  ],
  "summary": "<one sentence summary of what you recommend>"
}`;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-3.1-flash-lite-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content: string = data.choices[0].message.content;

  // Strip markdown code fences if present
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned) as FocusSuggestion;
}
