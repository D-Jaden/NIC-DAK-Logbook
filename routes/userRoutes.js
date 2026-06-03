//===============================
//LOGIN AND REGISTRATION ROUTES
//===============================

//================
//VARIABLES
//================

require('@dotenvx/dotenvx').config();
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const JWT = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const pool = require('/home/jaden-d-syiem/DAK Register /utils/db.js');
const argon2 = require('argon2');
const validate = require('../middleware/validate');
const { loginSchema, registerSchema } = require('../schemas/userSchemas');

//=====================
//JWT AUTHENTICATION
//=====================

function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        JWT.verify(token, JWT_SECRET, (err, user) => {
            if (err) return res.status(403).json({ error: 'Invalid token' });
            req.user = user;
            next();
        });
    } else {
        res.status(401).json({ error: 'No token provided' });
    }
}

//============================
//PHONE NO VERIFICATION
//============================

router.post("/login", validate(loginSchema), async (req, res) => {
  const { phone_no } = req.body;
  
  logger.info({ phone_no }, 'Login request received for:');
  try {
    const result = await pool.query('SELECT * FROM users WHERE phone_no = $1', [phone_no]);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      // If the user has a password_hash, verify it. Otherwise, deny access or handle legacy users.
      if (!user.password_hash) {
          return res.status(401).json({ success: false, error: 'Account requires security update. Please contact admin.' });
      }

      const isMatch = await argon2.verify(user.password_hash, phone_no);
      
      if (isMatch) {
          const token = JWT.sign({ user_id: user.user_id }, JWT_SECRET, { expiresIn: '1d' });
          req.session.token = token;
          res.json({ success: true, token, user_id: user.user_id, message: 'Number verified' });
      } else {
          res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
    } 
    else {
      res.status(404).json({ success: false, error: 'User not found' });
    }
  } catch (err) {
    logger.error(err, 'Database query error:');
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

//============================
//REGISTRATION
//============================

router.post("/register", validate(registerSchema), async (req, res) => {
  const { first_name, last_name, phone_no } = req.body;
  
  logger.info({ phone_no, first_name, last_name }, 'Registration request received for:');
  
  // Validate input
  if (!first_name || !last_name || !phone_no) {
    return res.status(400).json({ 
      success: false, 
      error: 'All fields are required' 
    });
  }
  
  // Capitalizing first alphabet for first and last name and lowering the rest 
  const normalizedFirstName = first_name.charAt(0).toUpperCase() + first_name.slice(1).toLowerCase();
  const normalizedLastName = last_name.charAt(0).toUpperCase() + last_name.slice(1).toLowerCase();

  try {
    // Check if phone number is already registered
    const checkResult = await pool.query(
      'SELECT * FROM users WHERE phone_no = $1',
      [phone_no]
    );

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number is already registered' 
      });
    }
    
    // Hash the phone number to act as the password
    const password_hash = await argon2.hash(phone_no);

    // Insert new user (user_id will be auto-generated)
    const insertResult = await pool.query(
      `INSERT INTO users (first_name, last_name, phone_no, password_hash) 
       VALUES ($1, $2, $3, $4) RETURNING user_id`,
      [normalizedFirstName, normalizedLastName, phone_no, password_hash]
    );
    
    if (insertResult.rows.length === 0) {
      throw new Error('Failed to create user');
    }

    const userId = insertResult.rows[0].user_id;
    const token = JWT.sign({ user_id: userId }, JWT_SECRET, { expiresIn: '1d' });
    req.session.token = token;

    logger.info({ user_id: userId, phone_no }, 'User registered successfully');

    // Send single response
    res.json({ 
      success: true,
      token,
      user_id: userId,
      user: insertResult.rows[0],
      message: 'Account created successfully'
    });
    
  } catch (err) {
    logger.error(err, 'Registration error:');
    res.status(500).json({ 
      success: false, 
      error: 'Database error: ' + err.message
    });
  }
});

//============================
//LOGOUT
//============================

router.post("/logout", authenticateJWT, async (req, res) => {
  const userId = req.user?.user_id;
  
  req.session.destroy((err) => {
    if (err) {
      logger.error(err, 'Failed to destroy session during logout');
      return res.status(500).json({ success: false, error: 'Could not log out' });
    }
    logger.info({ user_id: userId }, 'User logged out successfully');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

module.exports = router;