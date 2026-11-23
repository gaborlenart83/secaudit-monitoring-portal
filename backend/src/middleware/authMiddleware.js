'use strict';

const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (typeof authorization !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'JWT_SECRET is not configured' });
  }

  try {
    const payload = jwt.verify(match[1], secret);
    if (!payload || typeof payload !== 'object') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return next();
}

module.exports = {
  authenticateToken,
  authMiddleware: authenticateToken,
  requireAdmin,
};
