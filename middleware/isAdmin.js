module.exports = function(req, res, next) {
    if (req.session.user && req.session.user.role === 'Admin') {
        return next();
    }
    req.flash('error_msg', 'Access Denied: Admins Only');
    res.redirect('/');
};