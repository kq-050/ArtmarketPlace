const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' or SMTP settings from env
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendOrderConfirmation = async (toEmail, order, invoicePath) => {
    try {
        await transporter.sendMail({
            from: '"Art Marketplace" <no-reply@artmarketplace.com>',
            to: toEmail,
            subject: `Order Confirmation #${order._id}`,
            html: `<h1>Thank you for your order!</h1><p>Your order ID is <strong>${order._id}</strong>.</p><p>Please find your invoice attached.</p>`,
            attachments: invoicePath ? [{ path: invoicePath }] : []
        });
        console.log(`Order confirmation sent to ${toEmail}`);
    } catch (err) {
        console.error('Email Error:', err);
    }
};

exports.sendArtistNotification = async (artistEmail, artworkTitle) => {
    try {
        await transporter.sendMail({
            from: '"Art Marketplace" <no-reply@artmarketplace.com>',
            to: artistEmail,
            subject: 'Good news! Your Artwork Has Sold',
            html: `<h1>Congratulations!</h1><p>Your artwork <strong>${artworkTitle}</strong> has just been sold.</p><p>Check your dashboard for details.</p>`
        });
        console.log(`Artist notification sent to ${artistEmail}`);
    } catch (err) {
        console.error('Email Error:', err);
    }
};

exports.sendAdminNewOrderNotification = async (order) => {
    try {
        await transporter.sendMail({
            from: '"Art Marketplace" <no-reply@artmarketplace.com>',
            to: process.env.ADMIN_EMAIL || 'admin@artmarketplace.com',
            subject: `New Order Received #${order._id}`,
            html: `<h1>New Order Received</h1><p>Order ID: <strong>${order._id}</strong></p><p>Total Amount: $${order.totalAmount}</p>`
        });
        console.log(`Admin order notification sent`);
    } catch (err) {
        console.error('Email Error:', err);
    }
};

exports.sendArtistApprovalNotification = async (email, artwork) => {
    try {
        await transporter.sendMail({
            from: '"Art Marketplace" <no-reply@artmarketplace.com>',
            to: email,
            subject: 'Artwork Approved',
            html: `<h1>Artwork Approved</h1><p>Your artwork <strong>${artwork.title}</strong> has been approved and is now live on the marketplace.</p>`
        });
        console.log(`Approval email sent to ${email}`);
    } catch (err) {
        console.error('Email Error:', err);
    }
};

exports.sendArtistRejectionNotification = async (email, artwork, remarks) => {
    try {
        await transporter.sendMail({
            from: '"Art Marketplace" <no-reply@artmarketplace.com>',
            to: email,
            subject: 'Artwork Review Update',
            html: `<h1>Artwork Status Update</h1><p>We reviewed your artwork <strong>${artwork.title}</strong>.</p><p>Unfortunately, it was not approved for listing at this time.</p><p><strong>Admin Remarks:</strong> ${remarks}</p>`
        });
        console.log(`Rejection email sent to ${email}`);
    } catch (err) {
        console.error('Email Error:', err);
    }
};
