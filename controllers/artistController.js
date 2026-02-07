const Artwork = require('../models/Artwork');
const User = require('../models/User');
const Order = require('../models/Order');
const Config = require('../models/Config');

exports.getDashboard = async (req, res) => {
    try {
        // 1. Fetch all artworks by this artist
        const artworks = await Artwork.find({ artist: req.session.user._id });

        // 2. Fetch all orders that contain this artist's artworks
        // We look for orders where the 'items.artwork' matches one of the artist's artwork IDs
        const artworkIds = artworks.map(a => a._id);
        const orders = await Order.find({ 'items.artwork': { $in: artworkIds } });

        // 3. Calculate Metrics (FR-09)
        const commissionRate = await Config.get('commissionRate', 0.20);
        let totalRevenue = 0;
        let totalSoldItems = 0;

        orders.forEach(order => {
            order.items.forEach(item => {
                if (artworkIds.map(id => id.toString()).includes(item.artwork.toString())) {
                    totalRevenue += item.price * (1 - commissionRate); // Dynamic Artist Payout
                    totalSoldItems += 1;
                }
            });
        });

        res.render('artist/dashboard', {
            pageTitle: 'Artist Studio - Dashboard',
            artworks: artworks,
            totalRevenue: totalRevenue.toFixed(2),
            totalSoldItems: totalSoldItems,
            totalOrders: orders.length
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

exports.getAddArtwork = (req, res) => {
    res.render('artist/add-artwork', { pageTitle: 'Add New Artwork' });
};

// FR-06: Artwork Submission
exports.postAddArtwork = async (req, res) => {
    const { title, description, price, dimensions, medium, category, style, orientation, sizeCategory } = req.body;

    // req.file is created by Multer (contains the image info)
    if (!req.file) {
        req.flash('error_msg', 'Please upload an image');
        return res.redirect('/artist/add-artwork');
    }

    try {
        const newArtwork = new Artwork({
            title,
            description,
            price,
            dimensions,
            medium,
            category,
            style: style || 'Abstract',
            orientation: orientation || 'Square',
            sizeCategory: sizeCategory || 'Medium',
            imagePath: `/uploads/${req.file.filename}`, // Save the path, not the file itself
            artist: req.session.user._id,
            status: 'Pending' // Default status
        });

        await newArtwork.save();
        req.flash('success_msg', 'Artwork submitted successfully! Awaiting Admin Approval.');
        res.redirect('/artist/dashboard');

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error uploading artwork');
        res.redirect('/artist/add-artwork');
    }
};

// FR-New: Get Profile Page
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id);
        res.render('artist/profile', {
            pageTitle: 'Artist Profile',
            user: user,
            csrfToken: req.csrfToken() // Ensure CSRF is passed
        });
    } catch (err) {
        console.error(err);
        res.redirect('/artist/dashboard');
    }
};

// FR-New: Update Profile
exports.postProfile = async (req, res) => {
    const { username, bio, newPassword, confirmPassword } = req.body;
    console.log('DEBUG: postProfile body:', req.body);
    console.log('DEBUG: postProfile file:', req.file);

    try {
        const user = await User.findById(req.session.user._id);
        console.log('DEBUG: User found:', user._id);

        // Update Basic Info
        user.username = username || user.username;
        user.bio = bio || user.bio;

        // Handle Profile Image Upload
        if (req.file) {
            user.profileImage = `/uploads/${req.file.filename}`;
        }

        // Handle Password Update
        if (newPassword && newPassword.length > 0) {
            if (newPassword !== confirmPassword) {
                req.flash('error_msg', 'Passwords do not match');
                return res.redirect('/artist/profile');
            }
            user.password = newPassword; // Will be hashed via pre-save hook
        }

        await user.save();

        req.session.user = user; // Update session
        req.flash('success_msg', 'Profile updated successfully');
        res.redirect('/artist/profile');

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating profile');
        res.redirect('/artist/profile');
    }
};