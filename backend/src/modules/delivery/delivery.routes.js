const express = require('express');
const router = express.Router();
const deliveryController = require('./delivery.controller');
const validate = require('../../middleware/validate');
const { geocodeLimiter } = require('../../middleware/rateLimiter');
const deliveryValidation = require('./delivery.validation');

router.get('/slots', deliveryController.getSlots);
router.post('/check-pincode', validate(deliveryValidation.checkPincode), deliveryController.checkPincode);
router.post(
  '/reverse-geocode',
  geocodeLimiter,
  validate(deliveryValidation.reverseGeocode),
  deliveryController.reverseGeocode
);
router.get('/zones', deliveryController.getZones);

module.exports = router;
