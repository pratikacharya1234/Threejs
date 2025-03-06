const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for authentication
function isAuthenticated(req, res, next) {
    // Implement your authentication logic here
    // For example, check if the user is logged in
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// Middleware to check if the user has purchased access
function hasPurchased(req, res, next) {
    // Implement your purchase verification logic here
    // For example, check if the user has purchased access
    if (req.user && req.user.hasPurchased) {
        return next();
    } else {
        res.status(403).json({ error: 'Access denied. Please purchase access to view the code.' });
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

// Assets directory where the Three.js files are stored
const assetsDir = path.join(__dirname, 'assets');

// API endpoint to get list of backgrounds
app.get('/api/backgrounds', (req, res) => {
  try {
    const files = fs.readdirSync(assetsDir);
    const htmlFiles = files.filter(file => path.extname(file).toLowerCase() === '.html');
    
    const backgrounds = htmlFiles.map(filename => ({
      filename,
      path: `/assets/${filename}`
    }));
    
    res.json(backgrounds);
  } catch (error) {
    console.error('Error reading backgrounds:', error);
    res.status(500).json({ error: 'Failed to load backgrounds' });
  }
});

// API endpoint to get list of premium files
app.get('/api/premium', (req, res) => {
  try {
    const premiumDir = path.join(__dirname, 'premium/preview');
    const files = fs.readdirSync(premiumDir);
    const htmlFiles = files.filter(file => path.extname(file).toLowerCase() === '.html');
    
    const premiumFiles = htmlFiles.map(filename => ({
      filename,
      path: `/premium/preview/${filename}`
    }));
    
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
  const filePath = path.join(__dirname, 'premium/preview', filename);
  
  // Validate the filename to prevent directory traversal
  if (!filename.match(/^[a-zA-Z0-9_\-]+\.html$/)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  // Check if the request is coming from the premium page
  if (referer && referer.includes('/premium.html')) {
    try {
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

// API endpoint to check if the user has purchased access
app.get('/api/check-purchase', (req, res) => {
  // Implement your purchase verification logic here
  // For example, check if the user has purchased access
  if (req.user && req.user.hasPurchased) {
    res.json({ hasPurchased: true });
  } else {
    res.json({ hasPurchased: false });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the gallery`);
});