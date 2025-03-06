const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(cookieParser());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve assets freely
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve preview versions from assets directory
app.use('/preview', express.static(path.join(__dirname, 'assets')));

// Serve premium preview versions freely
app.use('/premium/preview', express.static(path.join(__dirname, 'premium/preview')));

// Serve premium full versions freely
app.use('/premium/full', express.static(path.join(__dirname, 'premium/full')));

// API endpoint to get list of backgrounds
app.get('/api/backgrounds', (req, res) => {
  try {
    // predefined list of HTML files, which is more reliable in serverless environments
    const backgrounds = [
      { filename: 'float.html', path: '/assets/float.html' },
      { filename: 'index.html', path: '/assets/index.html' },
      { filename: 'nebula.html', path: '/assets/nebula.html' },
      { filename: 'star.html', path: '/assets/star.html' },
      { filename: 'wave.html', path: '/assets/wave.html' }
    ];
    
    res.json(backgrounds);
  } catch (error) {
    console.error('Error reading backgrounds:', error);
    res.status(500).json({ error: 'Failed to load backgrounds' });
  }
});

// API endpoint to get list of premium files
app.get('/api/premium', (req, res) => {
  try {
    // Using predefined list for serverless environment
    const premiumFiles = [
      { filename: 'portfolio.html', path: '/premium/preview/portfolio.html' }
      
    ];
    
    res.json(premiumFiles);
  } catch (error) {
    console.error('Error reading premium files:', error);
    res.status(500).json({ error: 'Failed to load premium files' });
  }
});

// API endpoint to get code content
app.get('/api/code/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'assets', filename);
  
  // Validate the filename to prevent directory traversal
  if (!filename.match(/^[a-zA-Z0-9_\-]+\.html$/)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.type('text/plain').send(content);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Preview endpoint
app.get('/preview/:filename', (req, res) => {
  const referer = req.get('Referer');
  const filename = req.params.filename;
  
  // Validate the filename to prevent directory traversal
  if (!filename.match(/^[a-zA-Z0-9_\-]+\.html$/)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  // For Vercel, we need to be more flexible with referer check
  // Allow request from any page on our own domain or from localhost during development
  const allowedDomains = [
    'localhost', 
    process.env.VERCEL_URL,  
    process.env.CUSTOM_DOMAIN 
  ];
  
  const isValidReferer = !referer || 
    allowedDomains.some(domain => referer.includes(domain)) || 
    referer.includes('/premium.html') || 
    referer.includes('/index.html');
  
  if (isValidReferer) {
    try {
      const filePath = path.join(__dirname, 'assets', filename);
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).json({ error: 'Failed to serve file' });
    }
  } else {
    res.status(403).json({ error: 'Access denied' });
  }
});

// Login endpoint - implement this for real authentication in production
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // For demonstration only - replace with actual authentication
  if (username === 'demo' && password === 'password') {
    const token = jwt.sign({ 
      id: '1234',
      username: 'demo',
      hasPurchased: false
    }, JWT_SECRET, { expiresIn: '1h' });
    
    res.cookie('authToken', token, { httpOnly: true });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// API endpoint to check if the user has purchased access
app.get('/api/check-purchase', (req, res) => {
  try {
    const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.json({ authenticated: false, hasPurchased: false });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ 
      authenticated: true, 
      hasPurchased: !!decoded.hasPurchased,
      username: decoded.username
    });
  } catch (error) {
    res.json({ authenticated: false, hasPurchased: false });
  }
});

// Logout endpoint
app.get('/api/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ success: true });
});

// Serve the main HTML file for all other routes (client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view the gallery`);
  });
}

// Export the Express app for Vercel
module.exports = app;