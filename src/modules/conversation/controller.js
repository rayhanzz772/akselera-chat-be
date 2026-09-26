const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { randomUUID } = require('node:crypto')
const { validateRequest } = require('../../../src/utils/validation')
const { createConversationSchema } = require('./schema')

const HTTP_OK = HttpStatusCode.Ok

class Controller {
  static async getConversations(req, res) {
    try {
      const limit = Math.min(Math.max(Number(req.query.per_page) || 10, 1), 100)
      const page = Math.max(Number(req.query.page) || 1, 1)
      const offset = (page - 1) * limit

      const queryType = db.Sequelize.QueryTypes.SELECT
      const replacements = {
        userId: req.user.id,
        limit,
        offset
      }

      const conversations = await db.sequelize.query(
        `
          SELECT c.id, c.created_at
          FROM conversations c
          INNER JOIN conversation_members cm
            ON cm.conversation_id = c.id
          WHERE cm.user_id = :userId
          ORDER BY c.created_at DESC
          LIMIT :limit OFFSET :offset
        `,
        { type: queryType, replacements }
      )

      const countResult = await db.sequelize.query(
        `
          SELECT COUNT(DISTINCT c.id) AS total
          FROM conversations c
          INNER JOIN conversation_members cm
            ON cm.conversation_id = c.id
          WHERE cm.user_id = :userId
        `,
        { type: queryType, replacements }
      )

      const conversationIds = conversations.map((conversation) => conversation.id)
      let members = []

      if (conversationIds.length > 0) {
        members = await db.sequelize.query(
          `
            SELECT
              cm.conversation_id,
              u.id,
              u.name,
              u.email
            FROM conversation_members cm
            INNER JOIN users u ON u.id = cm.user_id
            WHERE cm.conversation_id IN (:conversationIds)
            ORDER BY cm.created_at ASC
          `,
          {
            type: queryType,
            replacements: { conversationIds }
          }
        )
      }

      const rows = conversations.map((conversation) => ({
        id: conversation.id,
        created_at: conversation.created_at,
        members: members
          .filter((member) => member.conversation_id === conversation.id)
          .map(({ id, name, email }) => ({ id, name, email }))
      }))

      const result = {
        count: Number(countResult[0]?.total || 0),
        rows
      }

      return res.status(HTTP_OK).json(api(result))
    }
    catch (err) {
      console.error(err)
      const code = err?.code ?? HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async createConversation(req, res) {
    let transaction

    try {
      transaction = await db.sequelize.transaction()
      const { member_ids: requestedMemberIds } = validateRequest(
        createConversationSchema,
        req
      )
      const memberIds = [...new Set([req.user.id, ...requestedMemberIds])]

      const users = await db.sequelize.query(
        `
          SELECT id
          FROM users
          WHERE id IN (:memberIds)
        `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements: { memberIds },
          transaction
        }
      )

      if (users.length !== memberIds.length) {
        throw {
          code: HttpStatusCode.BadRequest,
          message: 'One or more members do not exist'
        }
      }

      const conversationId = randomUUID()

      await db.sequelize.query(
        `INSERT INTO conversations (id) VALUES (:conversationId)`,
        {
          replacements: { conversationId },
          transaction
        }
      )

      const memberValues = memberIds
        .map((userId, index) => `(:memberId${index}, :conversationId, :userId${index})`)
        .join(', ')
      const memberReplacements = { conversationId }

      memberIds.forEach((userId, index) => {
        memberReplacements[`memberId${index}`] = randomUUID()
        memberReplacements[`userId${index}`] = userId
      })

      await db.sequelize.query(
        `
          INSERT INTO conversation_members (id, conversation_id, user_id)
          VALUES ${memberValues}
        `,
        {
          replacements: memberReplacements,
          transaction
        }
      )

      await transaction.commit()

      return res.status(HttpStatusCode.Created).json(
        api(
          {
            id: conversationId,
            member_ids: memberIds,
            created_at: new Date()
          },
          HttpStatusCode.Created,
          { req }
        )
      )
    } catch (err) {
      if (transaction) {
        await transaction.rollback()
      }
      const code = typeof err?.code === 'number'
        ? err.code
        : HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }
}

module.exports = Controller