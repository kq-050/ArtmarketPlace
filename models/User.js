const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Customer', 'Artist', 'Admin'], // Enforcing the 3 roles from SRS
        default: 'Customer'
    },
    // Artist specific fields
    bio: {
        type: String,
        default: ''
    },
    // Artist Suspension / Account Status (FR-12)
    isActive: {
        type: Boolean,
        default: true
    },
    // Password Reset Fields (Future Proofing)
    resetToken: String,
    resetTokenExpiration: Date,
    
    // Customer specific fields
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Artwork'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving (NFR-01)
// Hash password before saving (NFR-01)
userSchema.pre('save', async function() {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return;

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
        throw err; // This will stop the save and throw the error
    }
});

// Helper method to validate password during login
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);