const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const webhookController = require('../controllers/webhookController');

router.get('/', shopController.getIndex);
router.get('/artwork/:id', shopController.getArtworkDetails);
router.get('/cart', shopController.getCart);
router.post('/cart/add', shopController.addToCart);
router.post('/cart/remove/:artworkId', shopController.removeFromCart);
router.post('/cart/clear', shopController.clearCart);
router.post('/create-checkout-session', shopController.postCheckout);
router.post('/create-checkout-session', shopController.postCheckout);
router.get('/checkout/success', shopController.getSuccess);
router.get('/checkout/cancel', shopController.getCheckoutCancel);

// Stripe Webhook (Handled in app.js for raw body, but route defined here for consistency or direct use if app.js delegates)
// Actually, it's better to define it in app.js directly or ensure body parsing is skipped for this route.
// For this structure, we'll keep it simple and handle it in app.js for middleware reasons.
// router.post('/webhook', webhookController.handleWebhook);

const { ensureAuthenticated } = require('../middleware/isAuth');
router.post('/wishlist', ensureAuthenticated, shopController.toggleWishlist);
router.post('/wishlist/move-to-cart', ensureAuthenticated, shopController.moveToCart);
router.get('/wishlist', ensureAuthenticated, shopController.getWishlist);
router.get('/orders', ensureAuthenticated, shopController.getOrders);

module.exports = router;