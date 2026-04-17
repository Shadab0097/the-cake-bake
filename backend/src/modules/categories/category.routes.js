const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');

router.get('/', categoryController.listCategories);
router.get('/:slug/products', categoryController.getProductsByCategory);
router.get('/:slug', categoryController.getCategory);

module.exports = router;
