const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

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
  
  console.log(`Executing: ${fullCommand}`);
  
  const shellCommand = `source ~/.zshrc 2>/dev/null || true; ${fullCommand}`;
  
  exec(shellCommand, { 
    timeout: 30000,
    shell: '/bin/zsh'
  }, (error, stdout, stderr) => {
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
          message: 'Command took too long to execute (30 seconds timeout)'
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
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoint: POST http://localhost:${PORT}/api/process`);
});

module.exports = app;
