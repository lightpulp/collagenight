// One-time setup: authorizes your Gmail account, saves the refresh token and
// creates the root "CollageNight" Drive folder. Run: node scripts/get-refresh-token.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { google } from 'googleapis';

const ENV_PATH = path.resolve('.env.local');
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/callback`;

function readEnv() {
  const out = {};
  if (!fs.existsSync(ENV_PATH)) return out;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function writeEnv(key, value) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) text = text.replace(re, () => `${key}=${value}`);
  else text += (text === '' || text.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
  fs.writeFileSync(ENV_PATH, text);
}

const env = readEnv();
if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
  console.error('Fill GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first.');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, REDIRECT);
const state = crypto.randomBytes(16).toString('hex');
const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive.file'],
  state,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/callback') { res.writeHead(404); return res.end(); }
  try {
    if (url.searchParams.get('state') !== state) throw new Error('State mismatch.');
    const code = url.searchParams.get('code');
    if (!code) throw new Error(url.searchParams.get('error') || 'No code returned.');
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      throw new Error('No refresh token returned. Remove the app at myaccount.google.com/permissions and run again.');
    }
    oauth2.setCredentials(tokens);
    writeEnv('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);

    if (env.DRIVE_ROOT_FOLDER_ID) {
      console.log('DRIVE_ROOT_FOLDER_ID already set, keeping it.');
    } else {
      const drive = google.drive({ version: 'v3', auth: oauth2 });
      const folder = await drive.files.create({
        requestBody: { name: 'CollageNight', mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id,name',
      });
      writeEnv('DRIVE_ROOT_FOLDER_ID', folder.data.id);
      console.log(`Created Drive folder "${folder.data.name}" (${folder.data.id})`);
    }
    console.log('Saved GOOGLE_REFRESH_TOKEN to .env.local. Setup complete.');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Done. You can close this tab and return to the terminal.</h2>');
  } catch (e) {
    console.error('Setup failed:', e.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Setup failed: ' + e.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('\nOpen this URL in your browser and approve access:\n');
  console.log(authUrl + '\n');
  console.log('(An "unverified app" warning is expected. Click Advanced, then continue.)');
});
