const notificationService = require('./notification.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const getUserNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.getUserNotifications(req.user._id, req.query);
  ApiResponse.ok(result).send(res);
});

module.exports = { getUserNotifications };
