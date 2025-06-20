const jwt = require('jsonwebtoken');

/**
 * @desc Generate a JWT token for user authentication
 * @param {string} id - The user ID to be included in the token payload
 * @returns {string} The generated JWT token
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '1h', // Token expires in 1 hour
  });
};

module.exports = generateToken;