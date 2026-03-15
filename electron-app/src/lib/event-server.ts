import http from 'node:http';
import { insertTabEvent } from './db';
import { ThrashDetector } from './thrash-detector';

const PORT = 3456;

export function startEventServer() {
  const detector = new ThrashDetector();

  detector.on('thrash', (alert) => {
    // TODO: send notification to renderer, trigger UI alert, etc.
    console.log('Thrash alert emitted:', alert);
  });
  const server = http.createServer((req, res) => {
    // CORS headers for browser extension
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/events') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const event = JSON.parse(body);
          insertTabEvent(event);
          detector.push(event);
          console.log('Event ingested:', event);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          console.error('Failed to parse event:', err);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Event server listening on http://127.0.0.1:${PORT}`);
  });

  return server;
}
