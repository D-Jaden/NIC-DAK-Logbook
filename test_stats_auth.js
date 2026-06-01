require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');

// Create a dummy token for testing using the same secret as the app
const token = jwt.sign({ username: 'testuser' }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/despatch/stats',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
