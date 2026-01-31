module.exports = function (req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'Admin') {
        return next();
    }
    if (typeof req.flash === 'function') {
        req.flash('error_msg', 'Access Denied: Admins Only');
    }
    res.redirect('/');
};