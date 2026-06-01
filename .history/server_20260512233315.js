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
        const HF_URL = process.env.HF_TRANSLATE_URL || 'http://localhost:7860/translate';
        const r = await fetch(HF_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ text: text.trim(), src: 'en', tgt: 'hi' }),
        });
        if (!r.ok) throw new Error('HF API error: ' + r.status);
        const data = await r.json();
        res.json({ translation: data.translation || text });
    } catch (err) {
        console.error('[translate]', err.message);
        res.json({ translation: text });   // graceful fallback
    }
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