const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
// const Contractor = require('../models/Contractor'); // Not directly used in protect, can be removed if not needed elsewhere

/**
 * @desc Middleware to protect routes, ensuring only authenticated users can access them.
 *       Attaches the authenticated user object to the request.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('Auth Middleware: Token received (first 10 chars):', token ? token.substring(0, 10) + '...' : 'No');
      console.log('Auth Middleware: Full Authorization header:', req.headers.authorization);

      // Verify token
      console.log('Auth Middleware: Verifying token...');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Auth Middleware: Decoded token payload (ID):', decoded.id);

      // Find the user by ID from the token payload and exclude password
      const user = await User.findById(decoded.id).select('-password');
      console.log('Auth Middleware: User found:', user ? `ID=${user._id}, Email=${user.email}` : 'None');

      if (!user) {
        res.status(401);
        throw new Error('Not authorized, user not found.'); // More specific error
      }

      // Attach the user object to the request
      req.user = user;
      console.log('Auth Middleware: User attached to request:', req.user ? `ID=${req.user._id}, Email=${req.user.email}, Role=${req.user.role}` : 'None');
      next();
    } catch (error) {
      console.error('Authentication middleware error:', error.message); // Log specific error message
      res.status(401);
      // Provide a generic message to avoid leaking information about token validity issues
      throw new Error('Not authorized, invalid or expired token.');
    }
  }

  if (!token) {
    console.log('Auth Middleware: No token provided in request.');
    res.status(401);
    throw new Error('Not authorized, no token provided.'); // More specific error
  }
});

/**
 * @desc Middleware to authorize users based on their roles.
 * @param {Array<string>} roles - An array of roles that are allowed to access the route.
 */
const authorize = (roles = []) => {
  // Ensure roles is an array
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    // Check if user is authenticated (protect middleware should run before this)
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized, user not authenticated.');
    }

    // Check if the user's role is included in the allowed roles
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      res.status(403); // Forbidden
      throw new Error('Not authorized to access this route. Insufficient role permissions.');
    }
    next();
  };
};

module.exports = { protect, authorize };