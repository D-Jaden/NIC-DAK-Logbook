const { isURLWhitelisted, getWhitelistedAPI } = require('../config/whitelistedAPIs');

async function safeFetch(apiType, options = {}) {
  const whitelist = getWhitelistedAPI(apiType);
  
  if (!whitelist) {
    throw new Error(`API type "${apiType}" not whitelisted`);
  }

  const targetURL = options.url || whitelist.url;

  // THIS IS THE KEY CHECK
  if (process.env.ENFORCE_WHITELIST === 'true') {
      if (!isURLWhitelisted(targetURL, apiType)) {
        throw new Error(`URL "${targetURL}" not whitelisted for ${apiType}`);
      }
  }

  console.log(`[EXTERNAL-REQUEST] ${new Date().toISOString()} | API: ${apiType} | URL: ${targetURL}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), whitelist.timeout);

  try {
    const response = await fetch(targetURL, {
      method: options.method || whitelist.method,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();

  } catch (error) {
    console.error(`[EXTERNAL-ERROR] ${apiType}:`, error.message);
    throw error;
  }
}

module.exports = { safeFetch };
