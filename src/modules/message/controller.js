const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { randomUUID } = require('node:crypto')
const { createMessageSchema } = require('./schema')
const {
  emitNewMessage,
  emitConversationUpdated,
  emitUnreadUpdated
} = require('../../../src/utils/socket')

const queryType = db.Sequelize.QueryTypes.SELECT

function encodeCursor(message) {
  return Buffer.from(JSON.stringify({
    created_at: message.created_at,
    id: message.id
  })).toString('base64url')
}

function decodeCursor(cursor) {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (!value.created_at || !value.id) throw new Error('Invalid cursor')
    return value
  } catch {
    throw { code: HttpStatusCode.BadRequest, message: 'Invalid cursor' }
  }
}

class Controller {
  static async createMessage(req, res) {
    try {
      const validation = createMessageSchema.safeParse(req.body)
      if (!validation.success) {
        throw {
          code: HttpStatusCode.BadRequest,
          message: validation.error.issues[0]?.message || 'Invalid message body'
        }
      }

      const messageId = randomUUID()
      const rows = await db.sequelize.query(
        `
          INSERT INTO messages
            (id, conversation_id, sender_id, ciphertext, iv, auth_tag)
          VALUES
            (:id, :conversationId, :senderId, :ciphertext, :iv, :authTag)
          RETURNING id, conversation_id, sender_id, ciphertext, iv, auth_tag, created_at
        `,
        {
          type: queryType,
          replacements: {
            id: messageId,
            conversationId: req.conversationId,
            senderId: req.user.id,
            ciphertext: validation.data.ciphertext,
            iv: validation.data.iv,
            authTag: validation.data.auth_tag
          }
        }
      )

      emitNewMessage(rows[0])
      await emitConversationUpdated(rows[0])

      const otherMembers = await db.sequelize.query(
        `
          SELECT user_id
          FROM conversation_members
          WHERE conversation_id = :conversationId
            AND user_id <> :senderId
        `,
        {
          type: queryType,
          replacements: {
            conversationId: req.conversationId,
            senderId: req.user.id
          }
        }
      )

      for (const { user_id: memberId } of otherMembers) {
        await emitUnreadUpdated(memberId)
      }

      return res
        .status(HttpStatusCode.Created)
        .json(api(rows[0], HttpStatusCode.Created, { req }))
    } catch (err) {
      const code = typeof err?.code === 'number'
        ? err.code
        : HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async getMessages(req, res) {
    try {
      const parsedLimit = Number(req.query.limit || 30)
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
        throw { code: HttpStatusCode.BadRequest, message: 'Invalid limit' }
      }

      const limit = Math.min(parsedLimit, 100)
      const replacements = {
        conversationId: req.conversationId,
        limit: limit + 1
      }
      let cursorClause = ''

      if (req.query.before) {
        const cursor = decodeCursor(req.query.before)
        cursorClause = 'AND (created_at, id) < (:beforeCreatedAt, :beforeId)'
        replacements.beforeCreatedAt = cursor.created_at
        replacements.beforeId = cursor.id
      }

      const rows = await db.sequelize.query(
        `
          SELECT id, conversation_id, sender_id, ciphertext, iv, auth_tag, created_at
          FROM messages
          WHERE conversation_id = :conversationId
          ${cursorClause}
          ORDER BY created_at DESC, id DESC
          LIMIT :limit
        `,
        { type: queryType, replacements }
      )

      const hasMore = rows.length > limit
      const messages = rows.slice(0, limit).reverse()
      const nextCursor = hasMore && messages.length > 0
        ? encodeCursor(messages[0])
        : null

      return res.json(api({ messages, next_cursor: nextCursor }, HttpStatusCode.Ok, { req }))
    } catch (err) {
      const code = typeof err?.code === 'number'
        ? err.code
        : HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }
}

module.exports = Controller