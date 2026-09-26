const { z } = require('zod')
const { HttpStatusCode } = require('axios')
const db = require('../../db/models')
const { api } = require('../utils/api')

const conversationIdSchema = z.string().uuid()

const conversationMiddleware = async (req, res, next) => {
  const validation = conversationIdSchema.safeParse(req.params.conversationId)

  if (!validation.success) {
    return res
      .status(HttpStatusCode.BadRequest)
      .json(api(null, HttpStatusCode.BadRequest, {
        err: { message: 'Invalid conversation ID' }
      }))
  }

  try {
    const rows = await db.sequelize.query(
      `
        SELECT c.id, cm.user_id
        FROM conversations c
        LEFT JOIN conversation_members cm
          ON cm.conversation_id = c.id
          AND cm.user_id = :userId
        WHERE c.id = :conversationId
      `,
      {
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: {
          conversationId: validation.data,
          userId: req.user.id
        }
      }
    )

    if (rows.length === 0) {
      return res
        .status(HttpStatusCode.NotFound)
        .json(api(null, HttpStatusCode.NotFound, {
          err: { message: 'Conversation not found' }
        }))
    }

    if (!rows[0].user_id) {
      return res
        .status(HttpStatusCode.Forbidden)
        .json(api(null, HttpStatusCode.Forbidden, {
          err: { message: 'You are not a member of this conversation' }
        }))
    }

    req.conversationId = validation.data
    next()
  } catch (err) {
    const code = typeof err?.code === 'number'
      ? err.code
      : HttpStatusCode.InternalServerError
    return res.status(code).json(api(null, code, { err }))
  }
}

module.exports = conversationMiddleware