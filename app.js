require('dotenv').config();
console.log('--- VERCEL DIAGNOSTICS START ---');
console.log('CWD:', process.cwd());
console.log('NODE_VERSION:', process.version);
console.log('ENV: MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('ENV: SESSION_SECRET exists:', !!process.env.SESSION_SECRET);

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

let doubleCsrf;
try {
    const csrfModule = require('csrf-csrf');
    doubleCsrf = csrfModule.doubleCsrf;
    console.log('CSRF-CSRF module loaded successfully');
} catch (e) {
    console.error('CRITICAL: Failed to load csrf-csrf:', e.message);
}

const webhookController = require('./controllers/webhookController');
console.log('Controllers loaded');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const artistRoutes = require('./routes/artistRoutes');
const shopRoutes = require('./routes/shopRoutes');
console.log('Routes loaded');

const app = express();
// VERIFICATION MIDDLEWARE - Check if this shows up at your-site.com/?check=1
app.use((req, res, next) => {
    if (req.query.check === '1') {
        return res.send('DEPLOYMENT_VERIFIED_V4_LINE_112_FIX');
    }
    next();
});
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
const resolvedViewsPath = path.join(process.cwd(), 'views');
console.log('Setting views to:', resolvedViewsPath);
app.set('views', resolvedViewsPath);

// --- STRIPE WEBHOOK ---
app.post('/webhook', express.raw({ type: 'application/json' }), webhookController.handleWebhook);

// --- SECURITY MIDDLEWARE ---
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || 'fallbackSecretKey'));
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

// --- CSRF PROTECTION ---
let doubleCsrfProtection = (req, res, next) => next();
let generateToken = () => null;

if (doubleCsrf) {
    try {
        const csrfConfig = doubleCsrf({
            getSecret: (req) => process.env.SESSION_SECRET || 'fallbackSecretKey',
            cookieName: 'x-csrf-token',
            cookieOptions: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
            size: 64,
            ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
        });
        doubleCsrfProtection = csrfConfig.doubleCsrfProtection;
        generateToken = csrfConfig.generateToken;
        console.log('CSRF protection initialized');
    } catch (e) {
        console.error('Failed to initialize CSRF protection:', e.message);
    }
} else {
    console.warn('CSRF protection skipped due to missing module');
}

app.use((req, res, next) => {
    // Skip CSRF for webhook & specific POST routes
    const skipRoutes = ['/webhook', '/artist/add-artwork'];
    if (skipRoutes.includes(req.path) && req.method === 'POST') {
        return next();
    }
    doubleCsrfProtection(req, res, next);
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
    res.locals.csrfToken = (typeof generateToken === 'function') ? generateToken(req, res) : null;

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

    // Check if headers are already sent to avoid double response
    if (res.headersSent) {
        return next(err);
    }

    const isProduction = process.env.NODE_ENV === 'production';

    res.status(500).format({
        // 1. JSON response for API or AJAX
        'application/json': () => {
            res.json({
                error: 'Internal Server Error',
                message: isProduction ? 'Something went wrong.' : err.message
            });
        },
        // 2. Simple HTML string for browsers to avoid view lookup issues
        'text/html': () => {
            res.send(`
                <div style="font-family: sans-serif; padding: 20px; text-align: center;">
                    <h1 style="color: #dc3545;">Oops! Something went wrong.</h1>
                    <p>${isProduction ? 'A server error occurred. Please try again later.' : err.message}</p>
                    ${!isProduction ? `<pre style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 5px;">${err.stack}</pre>` : ''}
                    <hr>
                    <a href="/" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Return to Gallery</a>
                </div>
            `);
        },
        // 3. Fallback
        'default': () => {
            res.type('txt').send('Internal Server Error');
        }
    });
});

// --- EXPORT APP FOR SERVERLESS OR LOCAL ---
module.exports = app;

// --- LOCAL DEVELOPMENT SERVER ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
