const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
// const { listSchema } = require('./schema')
const { validateRequest } = require('../../../src/utils/validation')
const { presenceMapFor } = require('../../../src/utils/presence')

const HTTP_OK = HttpStatusCode.Ok

class Controller {
  static async getUser(req, res) {
    try {
      const limit = req.query.per_page || 10
      const page = req.query.page || 1
      const offset = (page - 1) * limit
      const q = req.query.q || null

      const userId = req.user.id
      const conditions = [
        'u.deleted_at IS NULL',
        'u.id <> :userId'
      ];
      const replacements = { limit, offset, userId }

      if (q) {
        conditions.push(`
        (
          LOWER(u.name) LIKE LOWER(:search)
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
          u.name,
          u.email,
          u.last_seen_at
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

      const presence = await presenceMapFor(results.map((row) => row.id))

      const rows = results.map((row) => ({
        ...row,
        is_online: presence.get(row.id)?.is_online ?? false,
        last_seen_at: presence.get(row.id)?.last_seen_at ?? null
      }))

      const result = {
        count: parseInt(countResult[0].total, 10),
        rows,
      }

      return res.status(HTTP_OK).json(api(result))
    }
    catch (err) {
      const code = typeof err?.code === 'number'
        ? err.code
        : HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }
}

module.exports = Controller