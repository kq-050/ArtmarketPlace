const express = require('express');
const router = express.Router();
const artistController = require('../controllers/artistController');
const { ensureAuthenticated, ensureArtist } = require('../middleware/isAuth');
const upload = require('../middleware/upload');
const csrf = require('csurf');
const csrfProtection = csrf();

// Protect all routes: User must be Logged In AND be an Artist
router.get('/dashboard', ensureAuthenticated, ensureArtist, artistController.getDashboard);

router.get('/add-artwork', ensureAuthenticated, ensureArtist, artistController.getAddArtwork);

// Note: upload.single('image') processes the file from the form field named "image"
router.post('/add-artwork', ensureAuthenticated, ensureArtist, upload.single('image'), csrfProtection, artistController.postAddArtwork);

module.exports = router;