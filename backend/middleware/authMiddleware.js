const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

/**
 * @desc Middleware to protect routes, ensuring only authenticated users can access them.
 *       Attaches the authenticated user object to the request.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        res.status(401);
        throw new Error('Not authorized, user not found.');
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, invalid or expired token.');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided.');
  }
});

/**
 * @desc Middleware to authorize users based on their roles.
 * @param {Array<string>} roles - An array of roles that are allowed to access the route.
 */
const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized, user not authenticated.');
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error('Not authorized to access this route. Insufficient role permissions.');
    }
    next();
  };
};

module.exports = { protect, authorize };
