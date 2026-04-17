const addonService = require('./addon.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const listAddOns = asyncHandler(async (req, res) => {
  const addons = await addonService.listAddOns();
  ApiResponse.ok(addons).send(res);
});

const getByCategory = asyncHandler(async (req, res) => {
  const addons = await addonService.getByCategory(req.params.category);
  ApiResponse.ok(addons).send(res);
});

module.exports = { listAddOns, getByCategory };
