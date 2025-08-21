const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    
    if (!['admin', 'manager', 'staff'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

// Permission-based middleware
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      // Admin has all permissions
      if (user.role === 'admin') {
        return next();
      }
      
      // Check if user has the required permission
      // Handle backward compatibility - if permissions array doesn't exist, grant access for existing admin users
      if (!user.permissions || !Array.isArray(user.permissions)) {
        if (user.role === 'admin') {
          return next(); // Grant access to existing admin users without permissions array
        }
        return res.status(403).json({ 
          message: `Access denied. Required permission: ${permission}` 
        });
      }
      
      if (!user.permissions.includes(permission)) {
        return res.status(403).json({ 
          message: `Access denied. Required permission: ${permission}` 
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ message: 'Permission check failed.' });
    }
  };
};

module.exports = { adminAuth, requirePermission };
