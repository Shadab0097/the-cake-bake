const categoryService = require('./category.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const listCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.listCategories();
  ApiResponse.ok(categories).send(res);
});

const getCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryBySlug(req.params.slug);
  ApiResponse.ok(category).send(res);
});

const getProductsByCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.getProductsByCategory(req.params.slug, req.query);
  ApiResponse.ok(result).send(res);
});

module.exports = { listCategories, getCategory, getProductsByCategory };
