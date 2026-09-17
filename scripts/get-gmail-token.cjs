require('dotenv').config();

const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!clientId || !clientSecret) {
  console.error('Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env');
  process.exit(1);
}

let parsedRedirect;
try {
  parsedRedirect = new URL(redirectUri);
} catch {
  console.error('GMAIL_REDIRECT_URI must be a valid URL.');
  process.exit(1);
}

if (parsedRedirect.hostname !== 'localhost' && parsedRedirect.hostname !== '127.0.0.1') {
  console.error('For this local callback script, set GMAIL_REDIRECT_URI to a localhost URL, for example:');
  console.error('GMAIL_REDIRECT_URI=http://localhost:3000/oauth2callback');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
});

const server = http.createServer(async (request, response) => {
  try {
    const callbackUrl = new URL(request.url, redirectUri);
    const error = callbackUrl.searchParams.get('error');
    const code = callbackUrl.searchParams.get('code');

    if (error) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`Google authorization failed: ${error}`);
      console.error(`Google authorization failed: ${error}`);
      server.close();
      process.exitCode = 1;
      return;
    }

    if (!code) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Missing authorization code.');
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Authorization complete. You can close this browser tab.');
    console.log('\nAuthorization succeeded. Add this value to .env and Netlify:');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token || '[Google did not return a refresh token]'}`);
    server.close();
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Token exchange failed. Check the terminal for details.');
    console.error('\nToken exchange failed:', error.message);
    server.close();
    process.exitCode = 1;
  }
});

server.listen(Number(parsedRedirect.port || 80), parsedRedirect.hostname, () => {
  console.log('1. Open this URL in your browser:');
  console.log(authUrl);
  console.log(`\n2. Approve Gmail access. Google will redirect to ${redirectUri}.`);
  console.log('3. Copy the printed GMAIL_REFRESH_TOKEN into .env and Netlify.');
});

server.on('error', (error) => {
  console.error(`Could not listen on ${redirectUri}: ${error.message}`);
  console.error('Confirm the redirect URI is registered exactly in Google Cloud Console.');
  process.exitCode = 1;
});
