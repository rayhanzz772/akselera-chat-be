const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
// const { listSchema } = require('./schema')
const { validateRequest } = require('../../../src/utils/validation')

const HTTP_OK = HttpStatusCode.Ok

class Controller {
  static async getUser(req, res) {
    try {
      const limit = req.query.per_page || 10
      const page = req.query.page || 1
      const offset = (page - 1) * limit
      const q = req.query.q || null

      const conditions = ['u.deleted_at IS NULL']
      const replacements = { limit, offset }

      if (q) {
        conditions.push(`
        (
          LOWER(u.username) LIKE LOWER(:search)
        )
      `)
        replacements.search = `%${q.toLowerCase()}%`
      }

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : ''

      const results = await db.sequelize.query(
        `
        SELECT
          u.id,
          u.username,
          u.email
        FROM users u
        ${whereClause}
        ORDER BY u.id DESC
        LIMIT :limit OFFSET :offset
      `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements,
        }
      )

      const countResult = await db.sequelize.query(
        `
        SELECT
          COUNT(*) AS total
        FROM users u
        ${whereClause}
      `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements,
        }
      )

      const result = {
        count: parseInt(countResult[0].total, 10),
        rows: results,
      }

      return res.status(HTTP_OK).json(api(result))
    }
    catch (err) {
      console.error(err)
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }
}

module.exports = Controller