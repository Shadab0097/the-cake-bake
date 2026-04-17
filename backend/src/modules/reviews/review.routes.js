const express = require('express');
const router = express.Router();
const reviewController = require('./review.controller');
const validate = require('../../middleware/validate');
const reviewValidation = require('./review.validation');
const { auth } = require('../../middleware/auth');

router.get('/product/:productId', reviewController.getProductReviews);
router.post('/', auth, validate(reviewValidation.createReview), reviewController.createReview);
router.put('/:id', auth, validate(reviewValidation.updateReview), reviewController.updateReview);
router.delete('/:id', auth, reviewController.deleteReview);

module.exports = router;
