const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup multer for handling image uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(bodyParser.json());

// Helper function to handle execution and response
const executeCocoCommand = (fullCommand, res, cleanupFile = null) => {
  console.log(`Executing: ${fullCommand}`);
  const shellCommand = `source ~/.zshrc 2>/dev/null || true; ${fullCommand}`;
  
  exec(shellCommand, { 
    timeout: 120000, // 2 minutes timeout for complex queries/image processing
    shell: '/bin/zsh'
  }, (error, stdout, stderr) => {
    // Cleanup temporary file if it was provided
    if (cleanupFile && fs.existsSync(cleanupFile)) {
      fs.unlink(cleanupFile, (err) => {
        if (err) console.error(`Failed to cleanup file ${cleanupFile}: ${err}`);
      });
    }

    if (error) {
      console.error(`Execution error: ${error}`);
      console.error(`Stderr: ${stderr}`);
      
      if (error.code === 'ENOENT' || (stderr && /command not found|not found/i.test(stderr))) {
        return res.status(500).json({
          error: 'coco CLI not found',
          message: 'Make sure coco CLI is installed and available in PATH'
        });
      }
      
      if (error.signal === 'SIGTERM') {
        return res.status(500).json({
          error: 'Command timeout',
          message: 'Command took too long to execute (120 seconds timeout)'
        });
      }
      
      if ((stderr && /401|Unauthorized/i.test(stderr)) || (stdout && /401|Unauthorized/i.test(stdout))) {
        return res.status(500).json({
          error: 'Authentication failed',
          message: 'coco CLI requires authentication. Please run coco login first in your terminal.',
          solution: 'Run: coco login in your terminal to authenticate',
          code: 'AUTH_REQUIRED'
        });
      }
      
      return res.status(500).json({
        error: 'Command execution failed',
        message: error.message,
        stderr: stderr,
        code: error.code
      });
    }
    
    res.json({
      success: true,
      command: fullCommand,
      output: stdout,
      stderr: stderr
    });
  });
};

// Endpoint: Process standard text prompt
app.post('/api/process', (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({
      error: 'Prompt is required',
      received: req.body
    });
  }
  
  if (typeof prompt !== 'string') {
    return res.status(400).json({
      error: 'Prompt must be a string',
      received: req.body
    });
  }
  
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const fullCommand = `coco -p "${escapedPrompt}"`;
  
  executeCocoCommand(fullCommand, res);
});

// Endpoint: Process image with prompt
app.post('/api/process-image', upload.single('image'), (req, res) => {
  const prompt = req.body.prompt || 'Deskripsikan gambar ini';
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      error: 'Image file is required. Make sure to upload with field name "image".'
    });
  }

  // Escape prompt safely and append the absolute file path
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const absolutePath = path.resolve(file.path);
  
  // Appending the image path to the prompt so coco can read it
  const fullCommand = `coco -p "${escapedPrompt} ${absolutePath}"`;
  
  executeCocoCommand(fullCommand, res, absolutePath);
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoint (Text): POST http://localhost:${PORT}/api/process`);
  console.log(`API endpoint (Image): POST http://localhost:${PORT}/api/process-image`);
});

module.exports = app;
