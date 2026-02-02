module.exports = function (req, res, next) {
    const user = (req.session && req.session.user) || (req.signedCookies && req.signedCookies.auth_user);
    if (user && user.role === 'Admin') {
        return next();
    }
    if (typeof req.flash === 'function') {
        req.flash('error_msg', 'Access Denied: Admins Only');
    }
    res.redirect('/');
};