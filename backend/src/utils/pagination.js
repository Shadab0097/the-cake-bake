/**
 * Build pagination metadata for list responses
 * Supports both offset-based and cursor-based pagination
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parse pagination params from query
 */
const parsePagination = (query) => {
  let page = parseInt(query.page, 10) || DEFAULT_PAGE;
  let limit = parseInt(query.limit, 10) || DEFAULT_LIMIT;

  if (page < 1) page = 1;
  if (limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Build paginated response
 */
const paginatedResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);

  return {
    items: data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

module.exports = { parsePagination, paginatedResponse };
