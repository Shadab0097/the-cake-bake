const productService = require('./product.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const listProducts = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query);
  ApiResponse.ok(result).send(res);
});

const searchProducts = asyncHandler(async (req, res) => {
  const result = await productService.searchProducts(req.query);
  ApiResponse.ok(result).send(res);
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductBySlug(req.params.slug);
  ApiResponse.ok(product).send(res);
});

const getFeatured = asyncHandler(async (req, res) => {
  const products = await productService.getFeaturedProducts(parseInt(req.query.limit, 10) || 12);
  ApiResponse.ok(products).send(res);
});

const getBestsellers = asyncHandler(async (req, res) => {
  const products = await productService.getBestsellers(parseInt(req.query.limit, 10) || 12);
  ApiResponse.ok(products).send(res);
});

const getTrending = asyncHandler(async (req, res) => {
  const products = await productService.getTrending(parseInt(req.query.limit, 10) || 12);
  ApiResponse.ok(products).send(res);
});

const getByOccasion = asyncHandler(async (req, res) => {
  const result = await productService.getByOccasion(req.params.occasion, req.query);
  ApiResponse.ok(result).send(res);
});

module.exports = { listProducts, searchProducts, getProduct, getFeatured, getBestsellers, getTrending, getByOccasion };
