require('dotenv').config();
console.log('--- STARTUP: App Initializing (DEPLOY_ID: V3_FINAL_FIX) ---');
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
