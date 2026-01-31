module.exports = {
    ensureAuthenticated: function (req, res, next) {
        if (req.session && req.session.user) {
            return next();
        }
        if (typeof req.flash === 'function') {
            req.flash('error_msg', 'Please log in to view that resource');
        }
        res.redirect('/auth/login');
    },
    ensureArtist: function (req, res, next) {
        if (req.session && req.session.user && req.session.user.role === 'Artist') {
            return next();
        }
        if (typeof req.flash === 'function') {
            req.flash('error_msg', 'Access Denied: Artists Only');
        }
        res.redirect('/');
    }
};