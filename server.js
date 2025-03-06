const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken'); // You'll need to install this package

const app = express();
const PORT = process.env.PORT || 3001;  // Change from 3000 to 3001

// JWT secret - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'alter2428013854489';

app.use(express.json());

// Middleware for authentication using JWT
function isAuthenticated(req, res, next) {
  try {
    const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.redirect('/login');
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.redirect('/login');
  }
}

// Middleware to check if the user has purchased access
function hasPurchased(req, res, next) {
  try {
    const token = req.cookies?.authToken || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && decoded.hasPurchased) {
      req.user = decoded;
      return next();
    } else {
      return res.status(403).json({ error: 'Access denied. Please purchase access to view the code.' });
    }
  } catch (error) {
    console.error('Purchase verification error:', error);
    return res.status(401).json({ error: 'Authentication required' });
  }
}

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve assets freely
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve preview versions freely
app.use('/premium/preview', express.static(path.join(__dirname, 'premium/preview')));

// Restrict access to full versions
app.use('/premium/full', isAuthenticated, express.static(path.join(__dirname, 'premium/full')));

// API endpoint to get list of backgrounds
app.get('/api/backgrounds', (req, res) => {
  try {
    // This is a predefined list of your HTML files, which is more reliable in serverless environments
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
      // Add other premium files here
    ];
    
    res.json(premiumFiles);
  } catch (error) {
    console.error('Error reading premium files:', error);
    res.status(500).json({ error: 'Failed to load premium files' });
  }
});

// API endpoint to get code content
app.get('/api/code/:filename', hasPurchased, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'premium/preview', filename);
  
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
    process.env.VERCEL_URL,  // Vercel's provided URL
    process.env.CUSTOM_DOMAIN // Your custom domain if set
  ];
  
  const isValidReferer = !referer || 
    allowedDomains.some(domain => referer.includes(domain)) || 
    referer.includes('/premium.html');
  
  if (isValidReferer) {
    try {
      const filePath = path.join(__dirname, 'premium/preview', filename);
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

// Purchase verification endpoint - implement with real payment verification
app.post('/api/purchase', isAuthenticated, (req, res) => {
  // In a real app, verify payment with Stripe/PayPal etc.
  // For demo purposes:
  const userId = req.user.id;
  
  // Update user in database to reflect purchase
  // For demo, we'll just create a new token with hasPurchased=true
  const newToken = jwt.sign({
    ...req.user,
    hasPurchased: true
  }, JWT_SECRET, { expiresIn: '30d' });
  
  res.cookie('authToken', newToken, { httpOnly: true });
  res.json({ success: true, hasPurchased: true });
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