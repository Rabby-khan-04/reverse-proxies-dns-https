const express = require('express');
const app = express();
const port = 3000;

// Simple endpoint that shows the Host header
app.get('/', (req, res) => {
  res.send(`
    <h1>Hello from the Node.js app!</h1>
    <p>Server port: ${port}</p>
    <p>Host header: ${req.get('Host')}</p>
    <p>X-Forwarded-For: ${req.get('X-Forwarded-For') || 'not set'}</p>
    <p>Proto: ${req.get('Proto') || 'not set'}</p>
  <hr>
  <p><a href="/health">Health check</a></p>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Echo endpoint to see headers
app.get('/headers', (req, res) => {
  res.json(Object.fromEntries(Object.entries(req.headers).filter(([k]) => k.toLowerCase().startsWith('host') || k.toLowerCase().startsWith('x') || k.toLowerCase().startsWith('proto') || k === 'accept')));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`App listening on port ${port}`);
  console.log(`Visit http://app1.localhost:${port}/ or http://app1.localhost:${port}/headers`);
});