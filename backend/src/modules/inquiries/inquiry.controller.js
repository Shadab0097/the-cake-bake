const inquiryService = require('./inquiry.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const submitCustomCake = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : null;
  const inquiry = await inquiryService.submitCustomCakeInquiry(req.body, userId);
  ApiResponse.created(inquiry, 'Custom cake inquiry submitted').send(res);
});

const submitCorporate = asyncHandler(async (req, res) => {
  const inquiry = await inquiryService.submitCorporateInquiry(req.body);
  ApiResponse.created(inquiry, 'Corporate inquiry submitted').send(res);
});

const getMyInquiries = asyncHandler(async (req, res) => {
  const inquiries = await inquiryService.getMyInquiries(req.user._id);
  ApiResponse.ok(inquiries).send(res);
});

module.exports = { submitCustomCake, submitCorporate, getMyInquiries };
