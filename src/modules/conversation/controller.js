const { api } = require('../../../src/utils/api')
const db = require('../../../db/models')
const { HttpStatusCode } = require('axios')
const { randomUUID } = require('node:crypto')
const { validateRequest } = require('../../../src/utils/validation')
const { createConversationSchema } = require('./schema')
const { emitConversationDeleted } = require('../../../src/utils/socket')

const HTTP_OK = HttpStatusCode.Ok

class Controller {
  static async getConversations(req, res) {
    try {
      const limit = Math.min(Math.max(Number(req.query.per_page) || 10, 1), 100)
      const page = Math.max(Number(req.query.page) || 1, 1)
      const offset = (page - 1) * limit

      const replacements = {
        userId: req.user.id,
        limit,
        offset
      }

      const conversations = await db.sequelize.query(
        `
          SELECT
            c.id,
            c.created_at,
            CASE
              WHEN opponent.id IS NULL THEN NULL
              ELSE json_build_object(
                'id', opponent.id,
                'name', opponent.name,
                'email', opponent.email,
                'public_key', opponent.public_key
              )
            END AS opponent,
            last_message.data AS last_message,
            COALESCE(unread.total, 0)::int AS unread_count
          FROM conversations c
          LEFT JOIN LATERAL (
            SELECT u.id, u.name, u.email, u.public_key
            FROM conversation_members cm
            INNER JOIN users u ON u.id = cm.user_id
            WHERE cm.conversation_id = c.id
              AND cm.user_id <> :userId
            ORDER BY cm.created_at ASC, cm.user_id ASC
            LIMIT 1
          ) opponent ON true
          LEFT JOIN LATERAL (
            SELECT
              json_build_object(
              'id', m.id,
              'sender_id', m.sender_id,
              'ciphertext', m.ciphertext,
              'iv', m.iv,
              'auth_tag', m.auth_tag,
              'created_at', m.created_at
              ) AS data,
              m.created_at
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT 1
          ) last_message ON true
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS total
            FROM messages unread_message
            JOIN conversation_members read_state
              ON read_state.conversation_id = unread_message.conversation_id
             AND read_state.user_id = :userId
            WHERE unread_message.conversation_id = c.id
              AND unread_message.sender_id <> :userId
              AND (
                read_state.last_read_at IS NULL
                OR unread_message.created_at > read_state.last_read_at
              )
          ) unread ON true
          WHERE EXISTS (
            SELECT 1
            FROM conversation_members current_member
            WHERE current_member.conversation_id = c.id
              AND current_member.user_id = :userId
          )
          ORDER BY last_message.created_at DESC NULLS LAST, c.created_at DESC, c.id DESC
          LIMIT :limit OFFSET :offset
        `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements
        }
      )

      const countResult = await db.sequelize.query(
        `
          SELECT COUNT(*) AS total
          FROM conversations c
          WHERE EXISTS (
            SELECT 1
            FROM conversation_members cm
            WHERE cm.conversation_id = c.id
              AND cm.user_id = :userId
          )
        `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements
        }
      )

      const response = api({
        count: Number(countResult[0]?.total || 0),
        rows: conversations
      }, HTTP_OK, { req })
      response.message = 'Conversations retrieved successfully'

      return res.status(HTTP_OK).json(response)
    }
    catch (err) {
      const code = typeof err?.code === 'number'
        ? err.code
        : HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async markConversationRead(req, res) {
    try {
      await db.sequelize.query(
        `
          UPDATE conversation_members
          SET last_read_at = CURRENT_TIMESTAMP
          WHERE conversation_id = :conversationId
            AND user_id = :userId
        `,
        {
          replacements: {
            conversationId: req.conversationId,
            userId: req.user.id
          }
        }
      )

      return res.status(HTTP_OK).json(api({
        conversation_id: req.conversationId,
        unread_count: 0
      }, HTTP_OK, { req }))
    } catch (err) {
      const code = typeof err?.code === 'number'
        ? err.code
        : HttpStatusCode.InternalServerError
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async deleteConversation(req, res) {
    let transaction

    try {
      transaction = await db.sequelize.transaction()

      const members = await db.sequelize.query(
        `
          SELECT user_id
          FROM conversation_members
          WHERE conversation_id = :conversationId
        `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements: { conversationId: req.conversationId },
          transaction
        }
      )

      await db.sequelize.query(
        `DELETE FROM conversations WHERE id = :conversationId`,
        {
          replacements: { conversationId: req.conversationId },
          transaction
        }
      )

      await transaction.commit()
      await emitConversationDeleted(
        req.conversationId,
        members.map(({ user_id: userId }) => userId)
      )

      return res.status(HTTP_OK).json(api({
        conversation_id: req.conversationId,
        deleted: true
      }, HTTP_OK, { req }))
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

  static async createConversation(req, res) {
    let transaction

    try {
      transaction = await db.sequelize.transaction()
      const { member_email: requestedMemberEmail } = validateRequest(
        createConversationSchema,
        req
      )

      const users = await db.sequelize.query(
        `
          SELECT id, email
          FROM users
          WHERE email = :memberEmail
             OR id = :currentUserId
        `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements: {
            memberEmail: requestedMemberEmail,
            currentUserId: req.user.id
          },
          transaction
        }
      )

      const requestedUser = users.find(
        (user) => user.email === requestedMemberEmail
      )

      if (!requestedUser) {
        throw {
          code: HttpStatusCode.BadRequest,
          message: 'Member email does not exist'
        }
      }

      const memberIds = [...new Set([req.user.id, requestedUser.id])]

      const existingConversations = await db.sequelize.query(
        `
          SELECT c.id, c.created_at
          FROM conversations c
          INNER JOIN conversation_members cm
            ON cm.conversation_id = c.id
          WHERE cm.user_id IN (:memberIds)
          GROUP BY c.id, c.created_at
          HAVING COUNT(DISTINCT cm.user_id) = :memberCount
             AND COUNT(*) = :memberCount
          LIMIT 1
        `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements: {
            memberIds,
            memberCount: memberIds.length
          },
          transaction
        }
      )

      if (existingConversations.length > 0) {
        await transaction.commit()

        return res.status(HTTP_OK).json(
          api({
            id: existingConversations[0].id,
            member_ids: memberIds,
            created_at: existingConversations[0].created_at
          }, HTTP_OK, { req })
        )
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