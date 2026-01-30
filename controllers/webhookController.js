const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Artwork = require('../models/Artwork');
const User = require('../models/User');
const { createInvoice } = require('../utils/invoiceGenerator');
const emailService = require('../utils/emailService');
const AuditLog = require('../models/AuditLog');
const Config = require('../models/Config');
const fs = require('fs');
const path = require('path');

exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        await handleCheckoutSessionCompleted(session);
    }

    res.json({ received: true });
};

async function handleCheckoutSessionCompleted(session) {
    try {
        // 1. Retrieve Line Items to get Artwork details
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const artworkIds = JSON.parse(session.metadata.artworkIds); // Passed during checkout creation
        const userId = session.metadata.userId;

        // 2. Mark Artworks as Sold & Get Details
        const soldArtworks = await Artwork.find({ _id: { $in: artworkIds } }).populate('artist');

        await Artwork.updateMany(
            { _id: { $in: artworkIds } },
            { $set: { status: 'Sold' } }
        );

        // 3. Create Order
        const totalAmount = session.amount_total / 100;
        const commissionRate = await Config.get('commissionRate', 0.20);
        const commissionAmount = totalAmount * commissionRate;
        const artistPayout = totalAmount - commissionAmount;

        const order = new Order({
            user: userId,
            items: soldArtworks.map(art => ({
                artwork: art._id,
                price: art.price,
                title: art.title
            })),
            totalAmount: totalAmount,
            commissionAmount: commissionAmount,
            commissionRate: commissionRate,
            artistPayout: artistPayout,
            shippingAddress: {
                street: session.shipping_details.address.line1,
                city: session.shipping_details.address.city,
                zip: session.shipping_details.address.postal_code,
                country: session.shipping_details.address.country
            },
            paymentId: session.payment_intent,
            paymentStatus: 'Completed',
            status: 'Paid'
        });

        const savedOrder = await order.save();

        // 4. Generate Invoice
        const invoiceData = {
            shipping: {
                name: session.shipping_details.name,
                address: session.shipping_details.address.line1,
                city: session.shipping_details.address.city,
                state: session.shipping_details.address.state,
                country: session.shipping_details.address.country,
                postal_code: session.shipping_details.address.postal_code
            },
            items: lineItems.data.map(item => ({
                title: item.description,
                quantity: item.quantity,
                price: (item.amount_total / 100).toFixed(2)
            })),
            subtotal: totalAmount,
            total: totalAmount,
            invoice_nr: savedOrder._id
        };

        const invoiceDir = path.join(__dirname, '..', 'public', 'invoices');

        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }

        const invoicePath = path.join(invoiceDir, `invoice-${savedOrder._id}.pdf`);
        createInvoice(invoiceData, invoicePath);

        // 5. Send Emails (Async - don't block)
        const user = await User.findById(userId);
        emailService.sendOrderConfirmation(user.email, savedOrder, invoicePath);
        emailService.sendAdminNewOrderNotification(savedOrder);

        // Notify Artists
        const uniqueArtists = [...new Set(soldArtworks.map(a => a.artist))];

        uniqueArtists.forEach(artist => {
            // Find artworks by this artist in the order
            const artistArtworks = soldArtworks.filter(a => a.artist._id.equals(artist._id));
            artistArtworks.forEach(artwork => {
                emailService.sendArtistNotification(artist.email, artwork.title);
            });
        });

        // 6. Audit Log
        await AuditLog.create({
            action: 'PAYMENT_SUCCESS',
            user: userId,
            details: `Order ${savedOrder._id} created via Stripe Webhook`,
            ip: 'Stripe-Webhook'
        });

        console.log(`Order ${savedOrder._id} processed successfully`);

    } catch (err) {
        console.error('Error handling checkout session:', err);
        // Log failure to AuditLog
        await AuditLog.create({
            action: 'PAYMENT_PROCESSING_ERROR',
            details: err.message,
            ip: 'Stripe-Webhook'
        });
    }
}
