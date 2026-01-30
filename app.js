require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose'); // <-- Make sure mongoose is required
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet'); // Security Headers
const csrf = require('csurf'); // CSRF Protection
const webhookController = require('./controllers/webhookController'); // Direct import for raw styling
const MONGODB_URI = process.env.MONGODB_URI;

// 1. IMPORT ROUTES
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const artistRoutes = require('./routes/artistRoutes');
const shopRoutes = require('./routes/shopRoutes');

// 2. INITIALIZE APP & MODELS
const app = express();
const User = require('./models/User');

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Database Connected Successfully'))
    .catch(err => console.error('Database Connection Error:', err));

// 4. VIEW ENGINE SETUP
app.set('view engine', 'ejs');
app.set('views', 'views');

// --- CRITICAL: STRIPE WEBHOOK MUST BE BEFORE BODY PARSERS ---
// Use express.raw({ type: 'application/json' }) for the webhook route only
app.post('/webhook', express.raw({ type: 'application/json' }), webhookController.handleWebhook);

// 5. MIDDLEWARE CONFIGURATION
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for simplicity with inline scripts/Stripe
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 6. SESSION & FLASH
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallbackSecretKey',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: false, // Force false for localhost debugging
        maxAge: 1000 * 60 * 60 * 24 // 1 Day
    }
}));

// 7. CSRF PROTECTION (Initialize after session)
// 7. CSRF PROTECTION (Initialize after session)
const csrfProtection = csrf();
app.use((req, res, next) => {
    // Skip CSRF for multipart upload route (will handle manually in route)
    if (req.path === '/artist/add-artwork' && req.method === 'POST') {
        return next();
    }
    csrfProtection(req, res, next);
});

app.use(flash());

// GLOBAL VARIABLES MIDDLEWARE
app.use(async (req, res, next) => {
    // 1. Auth Status
    res.locals.isAuthenticated = req.session.isLoggedIn || false;
    res.locals.currentUser = req.session.user || null;

    // 2. CSRF Token
    // Check if function exists (it won't on excluded routes)
    res.locals.csrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : '';

    // 3. Cart Count
    let cartCount = 0;
    if (req.session.cart && Array.isArray(req.session.cart.items)) {
        cartCount = req.session.cart.items.length;
    }
    res.locals.cartCount = cartCount;

    // 4. Search Defaults
    res.locals.searchQuery = req.query.search || '';
    res.locals.selectedCategory = req.query.category || 'All';

    // 5. Flash Messages
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');

    next();
});

// 8. USE ROUTES
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/artist', artistRoutes);
app.use('/', shopRoutes);

// 9. START SERVER
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

module.exports = app;
