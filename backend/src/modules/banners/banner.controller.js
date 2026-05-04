const bannerService = require('./banner.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const listBanners = asyncHandler(async (req, res) => {
  const banners = await bannerService.listPublicBanners(req.query);
  ApiResponse.ok(banners).send(res);
});

module.exports = { listBanners };
