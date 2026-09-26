const { ZodError } = require('zod')
const { HttpStatusCode } = require('axios')

const validateRequest = (schema, req) => {
  try {
    return schema.parse(req.body)
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues || error.errors || []

      if (!Array.isArray(issues) || issues.length === 0) {
        throw {
          code: HttpStatusCode.UnprocessableEntity,
          message: 'Invalid request body'
        }
      }

      const messages = issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))

      if (!messages[0] || messages[0].path === '') {
        throw {
          code: HttpStatusCode.UnprocessableEntity,
          message: messages[0]?.message || 'Invalid request body'
        }
      }

      throw {
        code: HttpStatusCode.UnprocessableEntity,
        message: `${messages[0].path}: ${messages[0].message}`
      }
    }

    throw error
  }
}

const validationFiles = (files, validationRules) => {
  try {
    if (!files || Object.keys(files).length === 0) {
      return true
    }

    for (const rule of validationRules) {
      const { name, allowed_mimes, max_size } = rule

      if (files[name]) {
        const fileArray = Array.isArray(files[name])
          ? files[name]
          : [files[name]]

        for (const file of fileArray) {
          if (allowed_mimes && allowed_mimes.length > 0) {
            const fileMime = file.mimetype.split('/')[1]
            const isValidMime = allowed_mimes.some((mime) => {
              if (mime.includes('/')) {
                return file.mimetype === mime
              } else {
                return (
                  fileMime === mime || (mime === 'jpg' && fileMime === 'jpeg')
                )
              }
            })

            if (!isValidMime) {
              throw {
                code: HttpStatusCode.BadRequest,
                message: `The file format ${name} must be ${allowed_mimes.join(
                  ', '
                )}`
              }
            }
          }

          if (max_size && file.size > max_size) {
            const maxSizeMB = (max_size / (1024 * 1024)).toFixed(1)
            throw {
              code: HttpStatusCode.BadRequest,
              message: `The maximum file size for ${name} is ${maxSizeMB}MB.`
            }
          }
        }
      }
    }

    return true
  } catch (error) {
    throw error
  }
}

module.exports = {
  validateRequest,
  validationFiles
}
