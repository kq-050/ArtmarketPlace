module.exports = {
    ensureAuthenticated: function(req, res, next) {
        if (req.session.user) {
            return next();
        }
        req.flash('error_msg', 'Please log in to view that resource');
        res.redirect('/auth/login');
    },
    ensureArtist: function(req, res, next) {
        if (req.session.user && req.session.user.role === 'Artist') {
            return next();
        }
        req.flash('error_msg', 'Access Denied: Artists Only');
        res.redirect('/');
    }
};