//==============================
// SERVER CONFIGURATION
//==============================

require('@dotenvx/dotenvx').config();
const logger = require('./utils/logger');

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');
const despatchRoutes = require('./routes/despatchRoutes');
const acquiredRoutes = require('./routes/acquiredRoutes');

const validate = require('./middleware/validate');
const { translateSchema, pincodeSchema } = require('./schemas/apiSchemas');

const { authenticateJWT } = require('./utils/auth');

const app = express();
const port = process.env.PORT || 3000;

const initDatabase = require('./utils/initDatabase');

//====================================
// MIDDLEWARE
//====================================

const pool = require('./utils/db.js');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://unpkg.com"],
            imgSrc: ["'self'", "data:", "https://unpkg.com"],
            connectSrc: ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        },
    },
}));
app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/boxicons', express.static(path.join(__dirname, 'node_modules/boxicons')));

//====================================
// API ROUTES
//====================================

app.use('/users', userRoutes);
app.use('/api/despatch', authenticateJWT, despatchRoutes);
app.use('/api/acquired', authenticateJWT, acquiredRoutes);

// ── Translation proxy ──
const { safeFetch } = require('./utils/safeHttpClient');
const { getWhitelistedAPI } = require('./config/whitelistedAPIs');

app.post('/api/translate', validate(translateSchema), async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.json({ translation: '' });
    try {
        const data = await safeFetch('translation', {
            method: 'POST',
            body: { text: text.trim(), src: 'en', tgt: 'hi' }
        });
        res.json({ translation: data.translated_text || data.translation || text });
    } catch (err) {
        logger.error('[translate proxy]', err.message);
        res.json({ translation: text });
    }
});

// ── Pincode proxy ──
app.get('/api/pincode/:pin', validate(pincodeSchema, 'params'), async (req, res) => {
    const pin = req.params.pin;
    try {
        const baseUrl = getWhitelistedAPI('pincode').url;
        const data = await safeFetch('pincode', {
            method: 'GET',
            url: baseUrl.endsWith('/') ? `${baseUrl}${pin}` : `${baseUrl}/${pin}`
        });
        res.json(data);
    } catch (err) {
        logger.error(err, '[pincode proxy]');
        res.status(500).json({ error: 'Failed to fetch pincode data' });
    }
});

//====================================
// PAGE ROUTES (unprotected — browser can't send Bearer on navigation)
//====================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup', 'login', 'login.html'));
});

// 
//    client JS redirects to / if API calls return 401
app.get('/despatch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'despatch', 'despatch.html'));
});

app.get('/acquired', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'acquired', 'acquired.html'));
});

//====================================
// ERROR HANDLER
//====================================

app.use((err, req, res, next) => {
    logger.error(err, 'Unhandled error occurred');
    res.status(500).json({ success: false, error: 'Internal server error' });
});

//====================================
// START
//====================================

async function startServer() {
    await initDatabase();
    app.listen(port, () => {
        logger.info(`Server started`);
        logger.info(`DAK System running on http://localhost:${port}`);
    });

    // Ping Translation API to keep HuggingFace space awake
    function pingTranslator() {
        logger.info('[WAKE-UP PING] Pinging translation API to keep it awake...');
        safeFetch('translation', { body: { text: "ping" } })
            .then(() => logger.info('[WAKE-UP PING] Translation API is awake!'))
            .catch((err) => logger.warn(`[WAKE-UP PING] API ping issue: ${err.message}`));
    }

    // Ping on startup, then every 24 hours 
    pingTranslator();
    setInterval(pingTranslator, 24 * 60 * 60 * 1000);
}

startServer();