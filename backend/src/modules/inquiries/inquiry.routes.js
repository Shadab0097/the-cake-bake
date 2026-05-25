const express = require('express');
const router = express.Router();
const inquiryController = require('./inquiry.controller');
const validate = require('../../middleware/validate');
const inquiryValidation = require('./inquiry.validation');
const { auth, optionalAuth } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

router.post('/custom-cake', optionalAuth, upload.array('referenceImages', 5), validate(inquiryValidation.customCakeInquiry), inquiryController.submitCustomCake);
router.post('/corporate', upload.array('referenceImages', 5), validate(inquiryValidation.corporateInquiry), inquiryController.submitCorporate);
router.get('/quotes/:token', validate(inquiryValidation.getQuote), inquiryController.getQuote);
router.post('/quotes/:token/accept', validate(inquiryValidation.acceptQuote), inquiryController.acceptQuote);
router.post('/quotes/:token/payment/verify', validate(inquiryValidation.verifyQuotePayment), inquiryController.verifyQuotePayment);
router.get('/my', auth, inquiryController.getMyInquiries);

module.exports = router;
