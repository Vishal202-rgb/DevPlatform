class ApiError extends Error {
  constructor(statusCode, message, details = undefined, code = undefined, model = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.model = model;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;

