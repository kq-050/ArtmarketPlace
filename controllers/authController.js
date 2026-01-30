const User = require('../models/User');

exports.getSignup = (req, res) => {
    res.render('auth/signup', { pageTitle: 'Sign Up' });
};

exports.postSignup = async (req, res) => {
    const { username, email, password, role, bio } = req.body;
    let errors = [];
    console.log('Signup attempt:', { username, email, role });

    // Basic validation
    if (!username || !email || !password) {
        errors.push({ msg: 'Please enter all required fields' });
    }

    if (password.length < 6) {
        errors.push({ msg: 'Password must be at least 6 characters' });
    }

    if (errors.length > 0) {
        console.log('Signup validation failed:', errors);
        return res.render('auth/signup', {
            errors,
            username,
            email,
            password,
            pageTitle: 'Sign Up',
            csrfToken: req.csrfToken() // Ensure token is passed back if rendering directly
        });
    } else {
        try {
            // Check if user exists
            let user = await User.findOne({ email: email });
            if (user) {
                console.log('Signup failed: Email already exists');
                errors.push({ msg: 'Email already exists' });
                return res.render('auth/signup', {
                    errors,
                    username,
                    email,
                    password,
                    pageTitle: 'Sign Up',
                    csrfToken: req.csrfToken()
                });
            }

            // Create new User
            const newUser = new User({
                username,
                email,
                password,
                role: role || 'Customer',
                bio: role === 'Artist' ? bio : ''
            });

            await newUser.save();
            console.log('User registered successfully:', email);

            req.flash('success_msg', 'You are now registered and can log in');
            res.redirect('/auth/login');

        } catch (err) {
            console.error('Signup Error:', err);
            req.flash('error_msg', 'Registration failed. Please try again.');
            res.redirect('/auth/signup');
        }
    }
};

exports.getLogin = (req, res) => {
    res.render('auth/login', { pageTitle: 'Login' });
};

exports.postLogin = async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', email);

    try {
        // 1. Find User
        const user = await User.findOne({ email });
        if (!user) {
            console.log('User not found');
            req.flash('error_msg', 'Email not registered');
            return res.redirect('/auth/login');
        }

        // 2. Check Password (using method from User model)
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            console.log('Password mismatch');
            req.flash('error_msg', 'Password incorrect');
            return res.redirect('/auth/login');
        }

        // 3. Create Session (Log user in)
        req.session.user = {
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role
        };
        req.session.isLoggedIn = true; // Explicitly set this too
        console.log('Session created for:', user.role);

        // 4. Redirect based on Role (RBAC)
        let targetUrl = '/';
        if (user.role === 'Admin') {
            targetUrl = '/admin/dashboard';
        } else if (user.role === 'Artist') {
            targetUrl = '/artist/dashboard';
        }

        // FORCE SAVE SESSION BEFORE REDIRECT
        req.session.save(err => {
            if (err) {
                console.error('Session save error:', err);
                return res.redirect('/auth/login');
            }
            console.log('Session saved, redirecting to:', targetUrl);
            return res.redirect(targetUrl);
        });

    } catch (err) {
        console.error(err);
        res.redirect('/auth/login');
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log(err);
        res.redirect('/auth/login');
    });
};