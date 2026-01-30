const Artwork = require('../models/Artwork');
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
    const { title, description, price, dimensions, medium, category } = req.body;

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