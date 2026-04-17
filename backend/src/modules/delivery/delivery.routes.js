const express = require('express');
const router = express.Router();
const deliveryController = require('./delivery.controller');
const validate = require('../../middleware/validate');
const deliveryValidation = require('./delivery.validation');

router.get('/slots', deliveryController.getSlots);
router.post('/check-pincode', validate(deliveryValidation.checkPincode), deliveryController.checkPincode);
router.get('/zones', deliveryController.getZones);

module.exports = router;
