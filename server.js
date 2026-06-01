//==============================
// SERVER CONFIGURATION
//==============================

require('@dotenvx/dotenvx').config();

const express  = require('express');
const session  = require('express-session');
const path     = require('path');
const cors     = require('cors');

const userRoutes     = require('./routes/userRoutes');
const despatchRoutes = require('./routes/despatchRoutes');
const acquiredRoutes = require('./routes/acquiredRoutes');

const app  = express();
const port = process.env.PORT || 3000;

const JWT = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const initDatabase = require('./utils/initDatabase');

//====================================
// MIDDLEWARE
//====================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,   // set true when HTTPS is enabled
        maxAge: 24 * 60 * 60 * 1000  // 1 day
    }
}));

// Serve everything in /public as static files
app.use(express.static(path.join(__dirname, 'public')));

//====================================
// AUTH middleware (added)
//====================================

const authenticateToken = (req, res, next) => {
    const token = req.session.token;

    if (!token) {
        // If user tries to access /despatch or /acquired without session
        return res.redirect('/'); 
    }

    try {
        JWT.verify(token, JWT_SECRET);
        next(); 
    } catch (err) {
        // Token expired or invalid
        req.session.destroy();
        res.redirect('/');
    }
};

// Protect the apps
app.get('/despatch', authenticateToken);
app.get('/acquired', authenticateToken);

//====================================
// API ROUTES
//====================================

app.use('/users',        userRoutes);
app.use('/api/despatch', despatchRoutes);
app.use('/api/acquired', acquiredRoutes);

// ── Translation proxy — forwards to HuggingFace Gradio app ──
app.post('/api/translate', async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.json({ translation: '' });
    try {
        const HF_URL = process.env.HF_TRANSLATE_URL || 'https://d-jaden02-pys-deep-transalator.hf.space/translate';
        const r = await fetch(HF_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ text: text.trim(), src: 'en', tgt: 'hi' }),
        });
        if (!r.ok) throw new Error('HF API error: ' + r.status);
        const data = await r.json();
        res.json({ translation: data.translated_text || data.translation || text });
    } catch (err) {
        console.error('[translate]', err.message);
        res.json({ translation: text });   // graceful fallback
    }
});

// ── Pincode proxy — bypasses invalid SSL certs from API ──
app.get('/api/pincode/:pin', (req, res) => {
    const pin = req.params.pin;
    const https = require('https');
    const options = {
        hostname: 'api.postalpincode.in',
        path: `/pincode/${pin}`,
        method: 'GET',
        rejectUnauthorized: false
    };
    const proxyReq = https.request(options, proxyRes => {
        let body = '';
        proxyRes.on('data', chunk => body += chunk);
        proxyRes.on('end', () => {
            try {
                res.json(JSON.parse(body));
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse response' });
            }
        });
    });
    proxyReq.on('error', e => res.status(500).json({ error: e.message }));
    proxyReq.end();
});

//====================================
// PAGE ROUTES
//====================================

// Root → login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup', 'login', 'login.html'));
});

// Despatch app
app.get('/despatch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'despatch', 'despatch.html'));
});

// Acquired app
app.get('/acquired', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'acquired', 'acquired.html'));
});

//====================================
// ERROR HANDLER
//====================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

//====================================
// START
//====================================

async function startServer() {
    await initDatabase();
    app.listen(port, () => {
        console.log(`DAK System running on http://localhost:${port}`);
    });
}

startServer();