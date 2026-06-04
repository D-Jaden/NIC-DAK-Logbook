const pino = require('pino');

const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,                // Adds beautiful colors to log levels
            translateTime: 'SYS:dd-mm-yyyy hh:mm:ss', // Makes timestamps readable (e.g. 2026-06-02 10:22:39)
            //ignore: 'pid,hostname',        // Hides process ID and hostname to keep logs clean
            messageFormat: '{msg}'         // Customizes how the message is formatted
        }
    },
    level: process.env.LOG_LEVEL || 'info' // Allows changing log level via .env
});

module.exports = logger;
