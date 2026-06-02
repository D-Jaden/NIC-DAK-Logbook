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
const { safeFetch } = require('./utils/safeHttpClient');
const { getWhitelistedAPI } = require('./config/whitelistedAPIs');

app.post('/api/translate', async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.json({ translation: '' });
    try {
        const data = await safeFetch('translation', {
            method: 'POST',
            body: { text: text.trim(), src: 'en', tgt: 'hi' }
        });
        res.json({ translation: data.translated_text || data.translation || text });
    } catch (err) {
        console.error('[translate proxy]', err.message);
        res.json({ translation: text });   // graceful fallback
    }
});

// ── Pincode proxy — safe HTTP Client ──
app.get('/api/pincode/:pin', async (req, res) => {
    const pin = req.params.pin;
    try {
        const baseUrl = getWhitelistedAPI('pincode').url;
        // Ensure the base URL ends with a slash if needed, or simply append the pin
        const data = await safeFetch('pincode', {
            method: 'GET',
            url: baseUrl.endsWith('/') ? `${baseUrl}${pin}` : `${baseUrl}/${pin}`
        });
        res.json(data);
    } catch (e) {
        console.error('[pincode proxy]', e.message);
        res.status(500).json({ error: 'Failed to fetch pincode data' });
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
