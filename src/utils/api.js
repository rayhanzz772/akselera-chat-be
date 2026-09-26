const { HttpStatusCode } = require('axios')
const {
  ValidationError,
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError
} = require('sequelize')
const { ZodError } = require('zod')

/**
 * Format API response
 * @param {any} res - Response data
 * @param {number} code - HTTP status code
 * @param {object} options - Options object
 * @param {Error|null} options.err - Error object
 * @param {object|null} options.req - Request object
 * @returns {object} Formatted response
 */
function api(res, code, { err = null, req = null } = {}) {
  let metadata = {}
  let message = 'success'

  if (err && code !== HttpStatusCode.Ok) {
    message = err.message

    // Handle Sequelize errors
    if (err instanceof ValidationError) {
      message = `Validation error: ${err.errors[0].message}`
    } else if (err instanceof DatabaseError) {
      const debugMode = ['local', 'development', 'staging']
      message = debugMode.includes(process.env.NODE_ENV)
        ? `Database error: ${err.original?.message || err.message}`
        : 'Database error occurred'
    } else if (err instanceof ForeignKeyConstraintError) {
      message = 'Foreign key constraint violation'
    } else if (err instanceof UniqueConstraintError) {
      message = `Duplicate entry: ${
        err.errors[0]?.path || 'unique constraint violated'
      }`
    } else if (err instanceof ZodError) {
      // Handle Zod validation errors
      const firstError = err.errors[0]
      message =
        firstError.path.length > 0
          ? `${firstError.path.join('.')}: ${firstError.message}`
          : firstError.message
    } else if (err.name === 'schema-validator' && Array.isArray(err)) {
      // Handle custom validation errors
      message = err[0].msg
    }
  } else if (res && typeof res === 'object' && 'data' in res) {
    if (res.per_page && res.page) {
      const perPage = Number(res.per_page) || 10
      const page = Number(res.page) || 1

      metadata = {
        per_page: perPage,
        current_page: page,
        total_row: res.count,
        total_page: Math.ceil(res.count / perPage)
      }
    }

    res = res.data
  } else if (
    res &&
    typeof res === 'object' &&
    'rows' in res &&
    'count' in res
  ) {
    // Handle Sequelize pagination format
    const perPage = parseInt(req?.query?.per_page) || 10
    const page = parseInt(req?.query?.page) || 1

    metadata = {
      per_page: perPage,
      current_page: page,
      total_row: res.count,
      total_page: Math.ceil(res.count / perPage)
    }

    res = res.rows
  }

  return {
    success: code >= 200 && code < 300,
    message: message,
    metadata: metadata,
    data: res
  }
}

/**
 * Generate Sequelize pagination options
 * @param {number} page - Page number
 * @param {number} perPage - Items per page
 * @returns {object} Sequelize pagination options
 */
function sequelizePaginate(page, perPage) {
  return {
    offset: (page - 1) * perPage,
    limit: perPage
  }
}

/**
 * Paginate array data
 * @param {Array} array - Array to paginate
 * @param {number} pageSize - Items per page
 * @param {number} pageNumber - Page number
 * @returns {Array} Paginated array
 */
function paginateArray(array, pageSize, pageNumber) {
  const perPage = pageSize || 10
  const page = pageNumber || 1

  return array.slice((page - 1) * perPage, page * perPage)
}

module.exports = {
  api,
  results: api,
  sequelizePaginate,
  paginateArray
}
