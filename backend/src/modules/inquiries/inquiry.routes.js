const express = require('express');
const router = express.Router();
const inquiryController = require('./inquiry.controller');
const validate = require('../../middleware/validate');
const inquiryValidation = require('./inquiry.validation');
const { auth, optionalAuth } = require('../../middleware/auth');

router.post('/custom-cake', optionalAuth, validate(inquiryValidation.customCakeInquiry), inquiryController.submitCustomCake);
router.post('/corporate', validate(inquiryValidation.corporateInquiry), inquiryController.submitCorporate);
router.get('/my', auth, inquiryController.getMyInquiries);

module.exports = router;
