const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;

// Only existing route module
let code = require('./pair');

// Increase event listener limit
require('events').EventEmitter.defaultMaxListeners = 500;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Load available routes
app.use('/code', code);

// Serve pair.html if it exists
app.use('/pair', async (req, res) => {
    res.sendFile(__path + '/pair.html');
});

// Default root response (main.html removed)
app.use('/', async (req, res) => {
    res.send('✅ Server is running. No homepage file configured.');
});

// Start server
app.listen(PORT, () => {
    console.log(`
✅ Server running on http://localhost:` + PORT + `
🚫 main.html, qr.html, qr.js have been removed.
`)
});

module.exports = app;
