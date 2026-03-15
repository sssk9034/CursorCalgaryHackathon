import 'dotenv/config';
import axios from 'axios';
import { app, BrowserWindow, ipcMain } from 'electron';
import started from 'electron-squirrel-startup';
import path from 'node:path';
import open from 'open';
import url from 'url';
import { generatePKCECodes } from './pkce';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) {
  app.quit();
}

const PROTOCOL = 'workos-auth';
const CLIENT_ID = process.env.WORKOS_CLIENT_ID!;
const CLIENT_SECRET = process.env.WORKOS_CLIENT_SECRET!;
const REDIRECT_URI = `${PROTOCOL}://callback`;

let mainWindow: BrowserWindow | null = null;
let codeVerifier: string;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  mainWindow.webContents.openDevTools();
};

function startWorkOSOAuth() {
  const pkce = generatePKCECodes();
  codeVerifier = pkce.codeVerifier;

  const GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    provider: 'GoogleOAuth',
    redirect_uri: REDIRECT_URI,
    provider_scopes: GOOGLE_SCOPES,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: 'S256',
  });

  open(`https://api.workos.com/sso/authorize?${params.toString()}`);
}

function handleAuthCallback(callbackUrl: string) {
  const parsed = url.parse(callbackUrl, true);
  const code = parsed.query.code as string;
  if (code) {
    exchangeCodeForToken(code);
  } else {
    const error = parsed.query.error;
    const errorDesc = parsed.query.error_description;
    console.error('Auth error:', error, errorDesc);
  }
}

async function exchangeCodeForToken(code: string) {
  try {
    const response = await axios.post('https://api.workos.com/sso/token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
    });

    const accessToken = response.data.access_token;
    const userProfile = response.data.profile;
    const oauthTokens = response.data.oauth_tokens;

    console.log('WorkOS Access Token:', accessToken);
    console.log('User Profile:', userProfile);
    console.log('Google OAuth Tokens:', oauthTokens);

    mainWindow?.webContents.send('auth-success', {
      profile: userProfile,
      googleAccessToken: oauthTokens?.access_token,
      googleRefreshToken: oauthTokens?.refresh_token,
    });
  } catch (err: any) {
    console.error('Token exchange failed:', err.response?.data || err.message);
  }
}

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }

  const deepLinkUrl = commandLine.find((arg) =>
    arg.startsWith(`${PROTOCOL}://`)
  );
  if (deepLinkUrl) {
    handleAuthCallback(deepLinkUrl);
  }
});

app.on('open-url', (event, openUrl) => {
  event.preventDefault();
  handleAuthCallback(openUrl);
});

app.on('ready', () => {
  createWindow();

  const deepLinkUrl = process.argv.find((arg) =>
    arg.startsWith(`${PROTOCOL}://`)
  );
  if (deepLinkUrl) {
    handleAuthCallback(deepLinkUrl);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('login', async () => {
  startWorkOSOAuth();
});
