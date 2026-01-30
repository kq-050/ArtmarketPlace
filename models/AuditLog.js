const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true, // e.g., 'LOGIN', 'PAYMENT_FAILURE', 'ARTIST_SUSPEND'
        uppercase: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Action might be anonymous (e.g., failed login)
    },
    details: {
        type: String,
        required: true
    },
    ip: {
        type: String,
        default: 'unknown'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        immutable: true // Logs should not be tampered with
    }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
