const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuthenticated } = require('../middleware/isAuth');
const isAdmin = require('../middleware/isAdmin');


// Protect all routes
router.get('/dashboard', ensureAuthenticated, isAdmin, adminController.getDashboard);
router.get('/report/export', ensureAuthenticated, isAdmin, adminController.getReport);
router.get('/orders', ensureAuthenticated, isAdmin, adminController.getAllOrders);


// Actions
router.get('/artists', ensureAuthenticated, isAdmin, adminController.getArtists);
router.post('/artists/toggle/:id', ensureAuthenticated, isAdmin, adminController.toggleArtistStatus);
router.post('/approve/:id', ensureAuthenticated, isAdmin, adminController.approveArtwork);
router.post('/reject/:id', ensureAuthenticated, isAdmin, adminController.rejectArtwork);
router.post('/update-commission', ensureAuthenticated, isAdmin, adminController.postUpdateCommission);

module.exports = router;