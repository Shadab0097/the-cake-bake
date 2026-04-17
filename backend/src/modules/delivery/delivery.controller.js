const deliveryService = require('./delivery.service');
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

const getZones = asyncHandler(async (req, res) => {
  const zones = await deliveryService.getZones();
  ApiResponse.ok(zones).send(res);
});

module.exports = { getSlots, checkPincode, getZones };
