const Artwork = require('../models/Artwork');
const Order = require('../models/Order');
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// FR-01: Display Artwork on Homepage
exports.getIndex = async (req, res) => {
    try {
        const { search, category, sort, page = 1, limit = 9 } = req.query;
        const currentPage = parseInt(page);
        const limitSize = parseInt(limit);
        const skip = (currentPage - 1) * limitSize;

        let dbQuery = { status: 'Approved' };

        if (search) {
            const matchingArtists = await User.find({
                username: { $regex: search, $options: 'i' },
                role: 'Artist'
            }).select('_id');

            const artistIds = matchingArtists.map(a => a._id);

            dbQuery.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { artist: { $in: artistIds } }
            ];
        }

        if (category && category !== 'All') {
            dbQuery.category = category;
        }

        // Sorting Logic
        let sortOptions = { uploadedAt: -1 }; // Default: Latest
        if (sort === 'price_asc') sortOptions = { price: 1 };
        if (sort === 'price_desc') sortOptions = { price: -1 };
        if (sort === 'latest') sortOptions = { uploadedAt: -1 };

        // Pagination and Fetching
        const totalArtworks = await Artwork.countDocuments(dbQuery);
        const totalPages = Math.ceil(totalArtworks / limitSize);

        const artworks = await Artwork.find(dbQuery)
            .populate('artist')
            .sort(sortOptions)
            .skip(skip)
            .limit(limitSize);

        res.render('shop/index', {
            pageTitle: 'ArtMarket',
            artworks: artworks,
            searchQuery: search || '',
            selectedCategory: category || 'All',
            currentSort: sort || 'latest',
            currentPage: currentPage,
            totalPages: totalPages,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1,
            totalArtworks: totalArtworks,
            limit: limitSize
        });

    } catch (err) {
        console.error(err);
        res.status(500).render('error', {
            message: 'Something went wrong while loading the gallery.',
            error: err,
            pageTitle: 'Error'
        });
    }
};

// FR-02: Product Details
exports.getArtworkDetails = async (req, res) => {
    try {
        const artwork = await Artwork.findById(req.params.id).populate('artist');
        if (!artwork) return res.redirect('/');

        res.render('shop/product-detail', {
            pageTitle: artwork.title,
            artwork: artwork
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

// FR-20: Add to Cart
exports.addToCart = async (req, res) => {
    const artworkId = req.body.artworkId;
    try {
        const artwork = await Artwork.findById(artworkId).populate('artist');
        if (!artwork) return res.redirect('/');

        if (artwork.status === 'Sold') {
            req.flash('error_msg', 'Sorry, this item is already sold.');
            return res.redirect('/');
        }

        if (!req.session.cart) {
            req.session.cart = { items: [], total: 0 };
        }

        const existingItem = req.session.cart.items.find(item => item._id.toString() === artworkId.toString());
        if (!existingItem) {
            req.session.cart.items.push(artwork);
            req.session.cart.total += artwork.price;
        }

        res.redirect('/cart');
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

// FR-20: Remove from Cart
exports.removeFromCart = (req, res) => {
    const artworkId = req.params.artworkId;
    if (!req.session.cart) return res.redirect('/cart');

    const itemIndex = req.session.cart.items.findIndex(item => item._id.toString() === artworkId.toString());
    if (itemIndex > -1) {
        const item = req.session.cart.items[itemIndex];
        req.session.cart.total -= item.price;
        req.session.cart.items.splice(itemIndex, 1);
    }

    if (req.session.cart.items.length === 0) {
        req.session.cart.total = 0;
    }

    res.redirect('/cart');
};

// FR-20: Clear Cart
exports.clearCart = (req, res) => {
    req.session.cart = { items: [], total: 0 };
    res.redirect('/cart');
};

// FR-20: View Cart
exports.getCart = (req, res) => {
    const cart = req.session.cart || { items: [], total: 0 };
    res.render('shop/cart', {
        pageTitle: 'Your Cart',
        cart: cart
    });
};

// Stripe Checkout
exports.postCheckout = async (req, res) => {
    const cart = req.session.cart;
    if (!cart || cart.items.length === 0) return res.redirect('/');

    try {
        const lineItems = cart.items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: { name: item.title },
                unit_amount: item.price * 100,
            },
            quantity: 1,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/checkout/cancel`,
            client_reference_id: req.session.user ? req.session.user._id.toString() : 'guest',
            metadata: {
                userId: req.session.user ? req.session.user._id.toString() : null,
                artworkIds: JSON.stringify(cart.items.map(i => i._id))
            },
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB'],
            }
        });

        res.redirect(303, session.url);
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Checkout Error');
        res.redirect('/cart');
    }
};

// FR-22 & FR-26: Success Page & Invoice Generation
// Note: Actual Order Creation is now handled by Stripe Webhooks!
exports.getSuccess = async (req, res) => {
    // Clear Cart (Webhook processes it, verifying here ensures UX is clean)
    req.session.cart = null;

    res.render('shop/success', {
        pageTitle: 'Payment Successful!',
        invoiceLink: '#' // In a real app, link to Order History where invoice is stored
    });
};

exports.getCheckoutCancel = (req, res) => {
    res.render('shop/checkout-cancel', {
        pageTitle: 'Checkout Cancelled'
    });
};

// FR-24: Toggle Wishlist
exports.toggleWishlist = async (req, res) => {
    try {
        const artworkId = req.body.artworkId;
        const user = await User.findById(req.session.user._id);

        // Fix: Convert ObjectIds to strings for comparison
        const index = user.wishlist.findIndex(id => id.toString() === artworkId.toString());

        if (index === -1) {
            user.wishlist.push(artworkId); // Add
            req.flash('success_msg', 'Added to Wishlist');
        } else {
            user.wishlist.splice(index, 1); // Remove
            req.flash('success_msg', 'Removed from Wishlist');
        }
        await user.save();

        req.session.user = user;
        res.redirect(req.get('Referer') || '/');
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

// FR-24: Move from Wishlist to Cart
exports.moveToCart = async (req, res) => {
    try {
        const artworkId = req.body.artworkId;
        const artwork = await Artwork.findById(artworkId);
        if (!artwork) return res.redirect('/wishlist');

        // Add to Cart Logic (reuse)
        if (!req.session.cart) {
            req.session.cart = { items: [], total: 0 };
        }
        const existingItem = req.session.cart.items.find(item => item._id.toString() === artworkId.toString());
        if (!existingItem) {
            req.session.cart.items.push(artwork);
            req.session.cart.total += artwork.price;
        }

        // Remove from Wishlist Logic (reuse)
        const user = await User.findById(req.session.user._id);
        const index = user.wishlist.findIndex(id => id.toString() === artworkId.toString());
        if (index > -1) {
            user.wishlist.splice(index, 1);
            await user.save();
            req.session.user = user;
        }

        req.flash('success_msg', 'Moved to Cart');
        res.redirect('/cart');
    } catch (err) {
        console.error(err);
        res.redirect('/wishlist');
    }
};

// FR-24: Get Wishlist Page
exports.getWishlist = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id).populate({
            path: 'wishlist',
            populate: { path: 'artist' }
        });
        res.render('shop/wishlist', {
            pageTitle: 'My Wishlist',
            artworks: user.wishlist
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};

// FR-27: Order History
exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.session.user._id }).sort({ createdAt: -1 });
        res.render('shop/orders', {
            pageTitle: 'My Orders',
            orders: orders
        });
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
};