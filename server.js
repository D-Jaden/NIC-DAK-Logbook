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

let bhashiniServiceId = null;

app.post('/api/translate', validate(translateSchema), async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.json({ translation: '' });
    
    if (!bhashiniServiceId) {
        logger.warn('[translate proxy] Bhashini serviceId not ready. Returning original text.');
        return res.json({ translation: text });
    }
    
    try {
        const data = await safeFetch('translation', {
            method: 'POST',
            headers: {
                'Authorization': process.env.INFERENCE_API_KEY
            },
            body: {
                "pipelineTasks": [
                    {
                        "taskType": "translation",
                        "config": {
                            "language": {
                                "sourceLanguage": "en",
                                "targetLanguage": "hi"
                            },
                            "serviceId": bhashiniServiceId
                        }
                    }
                ],
                "inputData": {
                    "input": [
                        { "source": text.trim() }
                    ]
                }
            }
        });
        
        let translatedText = text;
        if (data && data.pipelineResponse && data.pipelineResponse[0] && data.pipelineResponse[0].output && data.pipelineResponse[0].output[0]) {
            translatedText = data.pipelineResponse[0].output[0].target;
        }
        res.json({ translation: translatedText });
    } catch (err) {
        logger.error('[translate proxy] ' + err.message);
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

    // Initialize Bhashini Translation Pipeline
    async function initTranslator() {
        logger.info('[BHASHINI INIT] Fetching pipeline configuration...');
        try {
            const data = await safeFetch('translation_config', {
                method: 'POST',
                headers: {
                    'userID': process.env.USER_ID,
                    'ulcaApiKey': process.env.UDYAT_API_KEY
                },
                body: {
                    "pipelineTasks": [
                        {
                            "taskType": "translation",
                            "config": {
                                "language": { "sourceLanguage": "en", "targetLanguage": "hi" }
                            }
                        }
                    ],
                    "pipelineRequestConfig": {
                        "pipelineId": "64392f96daac500b55c543cd"
                    }
                }
            });
            
            if (data && data.pipelineResponseConfig && data.pipelineResponseConfig[0] && data.pipelineResponseConfig[0].config && data.pipelineResponseConfig[0].config[0]) {
                bhashiniServiceId = data.pipelineResponseConfig[0].config[0].serviceId;
                logger.info(`[BHASHINI INIT] Successfully retrieved serviceId: ${bhashiniServiceId}`);
            } else {
                logger.warn('[BHASHINI INIT] Could not parse serviceId from response.');
            }
        } catch (err) {
            logger.error(`[BHASHINI INIT] Failed to fetch pipeline config: ${err.message}`);
        }
    }

    // Fetch config on startup
    initTranslator();
}

startServer();