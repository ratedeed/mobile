const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Contractor = require('../models/Contractor');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to the request object
      // Find the user by ID from the token payload
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      req.user = user; // Attach the user object to the request
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized, user not authenticated');
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error('Not authorized to access this route');
    }
    next();
  };
};

module.exports = { protect, authorize };