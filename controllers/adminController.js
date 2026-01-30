const Artwork = require('../models/Artwork');
const User = require('../models/User');
const Order = require('../models/Order');
const Config = require('../models/Config');
const emailService = require('../utils/emailService');

exports.getDashboard = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const artistCount = await User.countDocuments({ role: 'Artist' });
        const customerCount = await User.countDocuments({ role: 'Customer' });
        const totalArtworks = await Artwork.countDocuments();
        const totalOrders = await Order.countDocuments();
        const pendingArtworks = await Artwork.find({ status: 'Pending' }).populate('artist');

        // FR-14: Financial Overview (Using Aggregation for Scalability)
        const financials = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } }, // Filter out cancelled orders
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalAmount' },
                    totalProfit: { $sum: '$commissionAmount' }
                }
            }
        ]);

        const totalRevenue = financials.length > 0 ? financials[0].totalRevenue : 0;
        const totalProfit = financials.length > 0 ? financials[0].totalProfit : 0;

        // FR-19: Monthly Sales Chart (Last 12 Months)
        const monthlySalesData = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    total: { $sum: '$totalAmount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Map aggregation result to array [Jan, Feb, ... Dec]
        let monthlySales = new Array(12).fill(0);
        monthlySalesData.forEach(item => {
            monthlySales[item._id - 1] = item.total;
        });

        // Get Current Commission Rate
        const currentCommission = await Config.get('commissionRate', 0.20);

        const operationalCosts = 0; // Placeholder for FR-18

        res.render('admin/dashboard', {
            pageTitle: 'Admin Dashboard',
            totalUsers,
            artistCount,
            customerCount,
            totalArtworks,
            totalOrders,
            pendingArtworks,
            totalRevenue: totalRevenue.toFixed(2),
            totalProfit: totalProfit.toFixed(2),
            monthlySales: JSON.stringify(monthlySales),
            currentCommission: (currentCommission * 100).toFixed(0),
            operationalCosts: operationalCosts
        });

    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

// FR-15: Export Report Logic (CSV)
exports.getReport = async (req, res) => {
    try {
        const orders = await Order.find().populate('user');
        let csv = 'OrderID,Date,Total,Commission,Status\n';
        orders.forEach(o => {
            csv += `${o._id},${o.createdAt.toDateString()},${o.totalAmount},${o.commissionAmount},${o.status}\n`;
        });
        res.header('Content-Type', 'text/csv');
        res.attachment('sales_report.csv');
        return res.send(csv);
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
};

// FR-11: Approve Artwork
exports.approveArtwork = async (req, res) => {
    try {
        const artwork = await Artwork.findByIdAndUpdate(req.params.id, { status: 'Approved' }, { new: true }).populate('artist');

        // Notify Artist
        if (artwork && artwork.artist) {
            emailService.sendArtistApprovalNotification(artwork.artist.email, artwork);
        }

        req.flash('success_msg', 'Artwork Approved and Live on Site');
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
};

// FR-11: Reject Artwork
exports.rejectArtwork = async (req, res) => {
    try {
        const { remarks } = req.body;
        const artwork = await Artwork.findByIdAndUpdate(req.params.id, {
            status: 'Rejected',
            adminRemarks: remarks
        }, { new: true }).populate('artist');

        // Notify Artist
        if (artwork && artwork.artist) {
            emailService.sendArtistRejectionNotification(artwork.artist.email, artwork, remarks);
        }

        req.flash('error_msg', 'Artwork Rejected');
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
};

// FR-12: Get Artist List
exports.getArtists = async (req, res) => {
    try {
        const artists = await User.find({ role: 'Artist' });
        res.render('admin/artists', { pageTitle: 'Manage Artists', artists });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
};

// FR-12: Suspend/Activate
exports.toggleArtistStatus = async (req, res) => {
    try {
        const artist = await User.findById(req.params.id);
        if (!artist) {
            req.flash('error_msg', 'Artist not found');
            return res.redirect('/admin/artists');
        }

        artist.isActive = !artist.isActive;
        await artist.save();

        const statusMsg = artist.isActive ? 'activated' : 'suspended';
        req.flash('success_msg', `Artist account has been ${statusMsg}`);
        res.redirect('/admin/artists');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating artist status');
        res.redirect('/admin/artists');
    }
};

// FR-13: All Orders
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find().populate('user').sort({ createdAt: -1 });
        res.render('admin/orders', { pageTitle: 'Platform Orders', orders });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
};

// FR-16: Update Commission Logic
exports.postUpdateCommission = async (req, res) => {
    try {
        const { commissionRate } = req.body; // Expecting integer (e.g., 20 for 20%)
        const rateDecimal = parseFloat(commissionRate) / 100;

        if (isNaN(rateDecimal) || rateDecimal < 0 || rateDecimal > 1) {
            req.flash('error_msg', 'Invalid Commission Rate');
            return res.redirect('/admin/dashboard');
        }

        await Config.set('commissionRate', rateDecimal);
        req.flash('success_msg', `Commission updated to ${commissionRate}%`);
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating commission');
        res.redirect('/admin/dashboard');
    }
};