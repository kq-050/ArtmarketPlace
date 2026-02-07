module.exports = {
    ensureAuthenticated: function (req, res, next) {
        if ((req.session && req.session.user) || (req.signedCookies && req.signedCookies.auth_user)) {
            return next();
        }
        if (typeof req.flash === 'function') {
            req.flash('error_msg', 'Please log in to view that resource');
        }
        res.redirect('/auth/login');
    },
    ensureArtist: function (req, res, next) {
        const user = (req.session && req.session.user) || (req.signedCookies && req.signedCookies.auth_user);
        if (user && user.role === 'Artist') {
            return next();
        }
        if (typeof req.flash === 'function') {
            req.flash('error_msg', 'Access Denied: Artists Only');
        }
        res.redirect('/');
    },
    restrictArtist: function (req, res, next) {
        const user = (req.session && req.session.user) || (req.signedCookies && req.signedCookies.auth_user);
        if (user && user.role === 'Artist') {
            if (typeof req.flash === 'function') {
                req.flash('error_msg', 'Artists cannot access the public marketplace while logged in.');
            }
            return res.redirect('/artist/dashboard');
        }
        next();
    }
};