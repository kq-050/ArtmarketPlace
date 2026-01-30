const mongoose = require('mongoose');

const artworkSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    dimensions: String, // e.g., "12x16 inches"
    medium: String,     // e.g., "Oil on Canvas"
    category: {
        type: String,
        enum: ['Painting', 'Sculpture', 'Digital', 'Photography', 'Other'],
        required: true
    },
    imagePath: {
        type: String,   // URL to the uploaded image
        required: true
    },
    artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Sold'], // FR-07
        default: 'Pending'
    },
    adminRemarks: {
        type: String, // FR-08 (Reason for rejection)
        default: ''
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Artwork', artworkSchema);