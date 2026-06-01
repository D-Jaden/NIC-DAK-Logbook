const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
const fetch = require('node-fetch');
fetch('https://api.postalpincode.in/pincode/793003', { agent })
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
