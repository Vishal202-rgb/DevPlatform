const ApiError = require('../utils/ApiError');

// Handles requests to routes that don't exist
const notFound = (req, _res, next) => {
  next(new ApiError(404, `Route not found - ${req.originalUrl}`));
};

// Centralized error handler - must be the last middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field '${err.path}'`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `${field} already in use` : 'Duplicate field value';
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    details = Object.values(err.errors).map((e) => e.message);
    message = 'Validation failed';
  }

  // JWT errors (fallback, most are caught earlier in authMiddleware)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(`[error] ${statusCode} - ${message}`);
    if (process.env.NODE_ENV === 'development' && !err.isOperational) {
      // eslint-disable-next-line no-console
      console.error(err.stack);
    }
  }

  const sanitize = (val) => {
    if (typeof val === 'string') {
      return val
        .replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED]')
        .replace(/AIza[a-zA-Z0-9_\-]{35}/g, '[REDACTED_API_KEY]');
    }
    return val;
  };

  res.status(statusCode).json({
    success: false,
    message: sanitize(message),
    ...(details ? { details: Array.isArray(details) ? details.map(sanitize) : sanitize(details) } : {}),
  });
};

module.exports = { notFound, errorHandler };
