/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

if (window.location.hash === '#countdown') {
  const DURATION = 30;
  document.body.innerHTML = '';
  document.body.className = 'countdown-body';

  const bar = document.createElement('div');
  bar.className = 'countdown-bar';
  document.body.appendChild(bar);

  const startTime = Date.now();

  const tick = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const remaining = Math.max(0, DURATION - elapsed);
    const pct = (remaining / DURATION) * 100;
    bar.style.width = `${pct}%`;

    if (remaining > 0) {
      requestAnimationFrame(tick);
    } else {
      window.close();
    }
  };

  requestAnimationFrame(tick);
} else {
  console.log(
    '👋 This message is being logged by "renderer.ts", included via Vite',
  );
}
