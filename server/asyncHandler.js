// Express 4 doesn't catch errors thrown from async route handlers.
// Wrapping a handler forwards them to the error middleware instead of
// leaving the request hanging.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
