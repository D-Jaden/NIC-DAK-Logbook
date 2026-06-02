require('@dotenvx/dotenvx').config();

const WHITELISTED_APIS = {
  translation: {
    name: 'HuggingFace Translator',
    url: process.env.HF_TRANSLATE_URL || 'https://d-jaden02-pys-deep-transalator.hf.space/translate',
    method: 'POST',
    timeout: 30000
  },
  pincode: {
    name: 'India Post Pincode',
    url: process.env.PINCODE_API_BASE || 'https://api.postalpincode.in/pincode/',
    method: 'GET',
    timeout: 10000
  }
};

function getWhitelistedAPI(apiType) {
    return WHITELISTED_APIS[apiType];
}

function isURLWhitelisted(targetURL, apiType) {
  const whitelist = getWhitelistedAPI(apiType);
  if (!whitelist) return false;
  
  const whitelistedBase = new URL(whitelist.url).origin;
  const targetBase = new URL(targetURL).origin;
  
  return targetBase === whitelistedBase;
}

module.exports = { WHITELISTED_APIS, getWhitelistedAPI, isURLWhitelisted };
