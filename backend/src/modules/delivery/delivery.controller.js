const deliveryService = require('./delivery.service');
const locationiqService = require('./locationiq.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const getSlots = asyncHandler(async (req, res) => {
  const slots = await deliveryService.getSlots(req.query);
  ApiResponse.ok(slots).send(res);
});

const checkPincode = asyncHandler(async (req, res) => {
  const result = await deliveryService.checkPincode(req.body.pincode);
  ApiResponse.ok(result).send(res);
});

// Reverse-geocode browser GPS coordinates into a pincode/city. The storefront
// then runs the pincode through the existing check-pincode serviceability flow,
// keeping a single source of truth for what is deliverable.
const reverseGeocode = asyncHandler(async (req, res) => {
  const result = await locationiqService.reverseGeocode({
    lat: req.body.lat,
    lng: req.body.lng,
  });
  ApiResponse.ok(result).send(res);
});

const getZones = asyncHandler(async (req, res) => {
  const zones = await deliveryService.getZones();
  ApiResponse.ok(zones).send(res);
});

module.exports = { getSlots, checkPincode, reverseGeocode, getZones };
