const express = require('express');
const router = express.Router();
const wishlistController = require('./wishlist.controller');
const { auth } = require('../../middleware/auth');

router.use(auth);
router.get('/', wishlistController.getWishlist);
router.post('/:productId', wishlistController.addToWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);

module.exports = router;
