const express = require('express');
const router = express.Router();
const productController = require('./product.controller');

router.get('/', productController.listProducts);
router.get('/search', productController.searchProducts);
router.get('/featured', productController.getFeatured);
router.get('/bestsellers', productController.getBestsellers);
router.get('/trending', productController.getTrending);
router.get('/by-occasion/:occasion', productController.getByOccasion);
router.get('/:slug', productController.getProduct);

module.exports = router;
