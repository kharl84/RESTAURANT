// /utils/middleware.js

const { roles } = require('./constants'); // Assuming roles are in the constants.js file

function ensureAdmin(req, res, next) {
  if (req.user && req.user.role === roles.admin) {
    next();
  } else {
    req.flash('warning', 'You are not authorized to see this route');
    res.redirect('/');
  }
}

function ensureModerator(req, res, next) {
  console.log('req.user:', req.user);
  if (req.user && req.user.role === 'MODERATOR') {
      return next();
  } else {
      res.status(403).send('Moderator access denied');
  }
}

module.exports = {
  ensureAdmin,
  ensureModerator,
};
