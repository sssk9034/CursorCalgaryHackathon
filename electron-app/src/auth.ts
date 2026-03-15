import { protocol } from 'electron';
import open from 'open';
import url from 'url';
import axios from 'axios';
import { generatePKCECodes } from './pkce';

let codeVerifier: string;

export function startWorkOSOAuth() {
  const pkce = generatePKCECodes();
  codeVerifier = pkce.codeVerifier;

  const authUrl = `https://api.workos.com/sso/authorize?` +
    `client_id=YOUR_WORKOS_CLIENT_ID&` +
    `response_type=code&` +
    `scope=openid profile email&` +
    `redirect_uri=myapp://callback&` +
    `code_challenge=${pkce.codeChallenge}&` +
    `code_challenge_method=S256`;

  open(authUrl);
}

export function registerProtocolHandler() {
  protocol.registerHttpProtocol('myapp', (request) => {
    const parsed = url.parse(request.url, true);
    if (parsed.hostname === 'callback') {
      const code = parsed.query.code as string;
      if (code) {
        exchangeCodeForToken(code);
      }
    }
  });
}

async function exchangeCodeForToken(code: string) {
  try {
    const response = await axios.post('https://api.workos.com/sso/token', {
      client_id: 'YOUR_WORKOS_CLIENT_ID',
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: 'myapp://callback'
    });

    const accessToken = response.data.access_token;
    const userProfile = response.data.profile;

    console.log('Access Token:', accessToken);
    console.log('User Profile:', userProfile);

  } catch (err: any) {
    console.error('Token exchange failed:', err.response?.data || err.message);
  }
}