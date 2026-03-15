import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

let db: Database.Database;

export function initDb(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'tab-events.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS tab_switch_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      name TEXT,
      time_utc TEXT NOT NULL,
      tab_count INTEGER NOT NULL,
      received_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  console.log('Database initialized at', dbPath);
  return db;
}

export function insertTabEvent(event: {
  url?: string;
  name?: string;
  time_utc: string;
  tabCount: number;
}) {
  const stmt = db.prepare(
    'INSERT INTO tab_switch_events (url, name, time_utc, tab_count) VALUES (?, ?, ?, ?)'
  );
  stmt.run(event.url ?? null, event.name ?? null, event.time_utc, event.tabCount);
}

export function getRecentEvents(limit = 100) {
  return db.prepare(
    'SELECT * FROM tab_switch_events ORDER BY id DESC LIMIT ?'
  ).all(limit);
}
