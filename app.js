const express = require('express');
const createHttpError = require('http-errors');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();
const session = require('express-session');
const connectFlash = require('connect-flash');
const passport = require('passport');
const MongoStore = require('connect-mongo');
const { ensureLoggedIn } = require('connect-ensure-login');
const { roles } = require('./utils/constants');
const menuRoute = require('./routes/menu.route');
const adminRoute = require('./routes/admin.route');
const ordersRoute = require('./routes/orders.route');
const moderatorRoutes = require('./routes/moderator.route');


// Initialization
const app = express();
app.use(morgan('dev'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Init Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // secure: true, // Uncomment this in production with HTTPS
      httpOnly: true,
    },
    store: new MongoStore({
      mongoUrl: process.env.MONGODB_URI,  // Use the connection string from environment
      collectionName: 'sessions',         // Optionally set collection name for sessions
    }),
  })
);

// For Passport JS Authentication
app.use(passport.initialize());
app.use(passport.session());
require('./utils/passport.auth');

// Set user information globally
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

// Connect Flash
app.use(connectFlash());
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});


// Routes
app.use('/', require('./routes/index.route'));
app.use('/auth', require('./routes/auth.route'));
app.use(
  '/user',
  ensureLoggedIn({ redirectTo: '/auth/login' }),
  require('./routes/user.route')
);

// Routes for admin and menu
app.use(
  '/admin',
  ensureLoggedIn({ redirectTo: '/auth/login' }),
  ensureAdmin,
  adminRoute
);
app.use('/menu', menuRoute);
app.use('/orders', ordersRoute);
app.use('/moderator', moderatorRoutes);

// 404 Handler
app.use((req, res, next) => {
  next(createHttpError.NotFound());
});

// Error Handler
app.use((error, req, res, next) => {
  error.status = error.status || 500;
  res.status(error.status);
  res.render('error_40x', { error });
});

// Setting the PORT
const PORT = process.env.PORT || 3000;

// Making a connection to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('💾 connected...');
    // Listening for connections on the defined PORT
    app.listen(PORT, () => console.log(`🚀 Server is live at ${process.env.BASE_URL || 'http://localhost'}:${PORT}`));

  })
  .catch((err) => console.log(err.message));

// Middleware to ensure the user is an admin
function ensureAdmin(req, res, next) {
  if (req.user.role === roles.admin) {
    next();
  } else {
    req.flash('warning', 'You are not authorized to see this route');
    res.redirect('/');
  }
}

// Middleware to ensure the user is a moderator
function ensureModerator(req, res, next) {
  if (req.user.role === roles.moderator) {
    next();
  } else {
    req.flash('warning', 'You are not authorized to see this route');
    res.redirect('/');
  }
}