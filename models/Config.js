const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true, // e.g., 'commissionRate'
        trim: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Helper to get a config value, with a default fallback
configSchema.statics.get = async function (key, defaultValue) {
    const config = await this.findOne({ key });
    return config ? config.value : defaultValue;
};

// Helper to set a config value
configSchema.statics.set = async function (key, value) {
    return await this.findOneAndUpdate(
        { key },
        { value, updatedAt: Date.now() },
        { upsert: true, new: true }
    );
};

module.exports = mongoose.model('Config', configSchema);
