require('dotenv').config();
console.log('--- STARTUP: App Initializing ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const csrf = require('csurf');
const webhookController = require('./controllers/webhookController');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const artistRoutes = require('./routes/artistRoutes');
const shopRoutes = require('./routes/shopRoutes');

const app = express();
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('CRITICAL ERROR: MONGODB_URI is not defined in environment variables.');
    // In serverless, we don't want to process.exit(1) as it kills the instance, 
    // but the app won't work anyway. We'll let it throw so Vercel captures the log.
}

// --- DATABASE CONNECTION ---
console.log('Attempting to connect to MongoDB...');
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Database Connected Successfully'))
    .catch(err => {
        console.error('DATABASE CONNECTION ERROR:', err.message);
        console.error(err.stack);
    });

// --- VIEW ENGINE ---
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// --- STRIPE WEBHOOK ---
app.post('/webhook', express.raw({ type: 'application/json' }), webhookController.handleWebhook);

// --- SECURITY MIDDLEWARE ---
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// --- SESSION, CSRF & FLASH HANDLING ---
const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'fallbackSecretKey',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // true if on HTTPS (Vercel)
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
};

app.use(session(sessionOptions));
app.use(flash());

const csrfProtection = csrf();
app.use((req, res, next) => {
    // Skip CSRF for webhook & specific POST routes
    const skipRoutes = ['/webhook', '/artist/add-artwork'];
    if (skipRoutes.includes(req.path) && req.method === 'POST') {
        return next();
    }
    csrfProtection(req, res, next);
});

// --- GLOBAL VARIABLES & DATA INITIALIZATION ---
app.use((req, res, next) => {
    // 1. Safe access to session-based data
    const session = req.session || {};

    // 2. Initialize isLoggedIn if undefined
    if (typeof session.isLoggedIn === 'undefined') {
        session.isLoggedIn = false;
    }

    // 3. Set locals for views
    res.locals.isAuthenticated = session.isLoggedIn || false;
    res.locals.currentUser = session.user || null;

    // 4. Safe CSRF token injection
    res.locals.csrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : null;

    // 5. Shared data safely
    res.locals.cartCount = Array.isArray(session.cart?.items) ? session.cart.items.length : 0;
    res.locals.searchQuery = req.query.search || '';
    res.locals.selectedCategory = req.query.category || 'All';

    // 6. Flash messages safely
    res.locals.success_msg = (typeof req.flash === 'function') ? req.flash('success_msg') : [];
    res.locals.error_msg = (typeof req.flash === 'function') ? req.flash('error_msg') : [];

    next();
});

// --- ROUTES ---
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/artist', artistRoutes);
app.use('/', shopRoutes);

// --- DEBUG ROUTE FOR VERCEL ---
app.get('/debug-paths', (req, res) => {
    const fs = require('fs');
    const viewsPath = app.get('views');
    const exists = fs.existsSync(viewsPath);
    const files = exists ? fs.readdirSync(viewsPath) : [];
    res.json({
        cwd: process.cwd(),
        dirname: __dirname,
        viewsPath: viewsPath,
        viewsExist: exists,
        viewsFiles: files,
        env: process.env.NODE_ENV
    });
});

// --- ERROR HANDLING MIDDLEWARE ---
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);

    const errorData = {
        message: 'Something went wrong on our end.',
        error: process.env.NODE_ENV !== 'production' ? err : {},
        pageTitle: 'Error'
    };

    // Try to render the error page
    res.status(500).render('error', errorData, (renderErr, html) => {
        if (renderErr) {
            // If the view lookup fails again, send as JSON/Text so we can see the REAL error
            console.error('View Render Failed:', renderErr);
            return res.status(500).send(`
                <h1>Internal Server Error</h1>
                <p>The error page failed to load, but here is the original error:</p>
                <pre>${err.message}</pre>
                <p>View Lookup Error: ${renderErr.message}</p>
            `);
        }
        res.send(html);
    });
});

// --- EXPORT APP FOR SERVERLESS OR LOCAL ---
module.exports = app;

// --- LOCAL DEVELOPMENT SERVER ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
