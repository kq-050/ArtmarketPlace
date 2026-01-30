const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        artwork: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Artwork',
            required: true
        },
        price: Number, // Price at time of purchase
        title: String
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    commissionAmount: { // FR-25 (Platform earnings)
        type: Number,
        required: true
    },
    commissionRate: {   // Store the rate used Calculate (Historical Data)
        type: Number,
        required: true,
        default: 0.20
    },
    artistPayout: {     // FR-17 (Amount going to artist)
        type: Number,
        required: true
    },
    shippingAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        zip: { type: String, required: true },
        country: { type: String, required: true }
    },
    paymentId: {        // Stripe Transaction ID (or Payment Intent)
        type: String,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Pending'
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending' // Starts as Pending until Webhook confirms
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Order', orderSchema);