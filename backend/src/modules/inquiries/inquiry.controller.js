const inquiryService = require('./inquiry.service');
const inquiryQuoteService = require('./inquiryQuote.service');
const uploadService = require('../media/upload.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const normalizeArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const removeEmptyOptionalFields = (data) => {
  const payload = { ...data };
  if (payload.deliveryDate === '') delete payload.deliveryDate;
  return payload;
};

const submitCustomCake = asyncHandler(async (req, res) => {
  const userId = req.user ? req.user._id : null;
  const files = req.files || [];
  const uploaded = files.length > 0
    ? await uploadService.uploadImages(files, { context: 'custom_inquiries', maxFiles: 5 })
    : [];

  const payload = removeEmptyOptionalFields({
    ...req.body,
    referenceImages: [
      ...normalizeArray(req.body.referenceImages),
      ...uploaded.map((image) => image.url),
    ],
    referenceImagePublicIds: [
      ...normalizeArray(req.body.referenceImagePublicIds),
      ...uploaded.map((image) => image.publicId),
    ],
  });

  try {
    const inquiry = await inquiryService.submitCustomCakeInquiry(payload, userId);
    ApiResponse.created(inquiry, 'Custom cake inquiry submitted').send(res);
  } catch (err) {
    await uploadService.deleteImages(uploaded.map((image) => image.publicId));
    throw err;
  }
});

const submitCorporate = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const uploaded = files.length > 0
    ? await uploadService.uploadImages(files, { context: 'corporate_inquiries', maxFiles: 5 })
    : [];

  const payload = removeEmptyOptionalFields({
    ...req.body,
    referenceImages: [
      ...normalizeArray(req.body.referenceImages),
      ...uploaded.map((image) => image.url),
    ],
    referenceImagePublicIds: [
      ...normalizeArray(req.body.referenceImagePublicIds),
      ...uploaded.map((image) => image.publicId),
    ],
  });

  try {
    const inquiry = await inquiryService.submitCorporateInquiry(payload);
    ApiResponse.created(inquiry, 'Corporate inquiry submitted').send(res);
  } catch (err) {
    await uploadService.deleteImages(uploaded.map((image) => image.publicId));
    throw err;
  }
});

const getMyInquiries = asyncHandler(async (req, res) => {
  const inquiries = await inquiryService.getMyInquiries(req.user._id);
  ApiResponse.ok(inquiries).send(res);
});

const getQuote = asyncHandler(async (req, res) => {
  const quote = await inquiryQuoteService.getPublicQuote(req.params.token);
  ApiResponse.ok(quote).send(res);
});

const acceptQuote = asyncHandler(async (req, res) => {
  const result = await inquiryQuoteService.acceptQuote(req.params.token, req.body);
  ApiResponse.ok(result, 'Quote accepted').send(res);
});

const verifyQuotePayment = asyncHandler(async (req, res) => {
  const result = await inquiryQuoteService.verifyQuotePayment(req.params.token, req.body);
  ApiResponse.ok(result, 'Payment verified').send(res);
});

module.exports = { submitCustomCake, submitCorporate, getMyInquiries, getQuote, acceptQuote, verifyQuotePayment };
