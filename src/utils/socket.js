const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')
const { z } = require('zod')
const db = require('../../db/models')
const {
  addConnection,
  removeConnection,
  isOnline,
  findConversationPartnerIds,
  buildPresenceFor
} = require('./presence')

let io
const conversationIdSchema = z.string().uuid()
const presenceUserIdsSchema = z.array(z.string().uuid()).min(1).max(100)

function getCookieToken(cookieHeader) {
  const token = cookieHeader?.match(/(?:^|;\s*)token=([^;]+)/)?.[1]
  return token ? decodeURIComponent(token) : null
}

function getHandshakeToken(socket) {
  return socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.split(' ')[1] ||
    getCookieToken(socket.handshake.headers?.cookie)
}

function roomName(conversationId) {
  return `conversation:${conversationId}`
}

function userRoomName(userId) {
  return `user:${userId}`
}

async function isConversationMember(conversationId, userId) {
  const rows = await db.sequelize.query(
    `
      SELECT 1
      FROM conversation_members
      WHERE conversation_id = :conversationId
        AND user_id = :userId
      LIMIT 1
    `,
    {
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: { conversationId, userId }
    }
  )

  return rows.length > 0
}

async function broadcastPresence(userId, online, partnerIds) {
  if (!io) return

  // A reconnect can land between removeConnection() and this call.
  if (!online && isOnline(userId)) return

  try {
    const recipients = partnerIds ?? await findConversationPartnerIds(userId)
    if (recipients.length === 0) return

    let lastSeenAt = null

    if (!online) {
      const rows = await db.sequelize.query(
        `
          UPDATE users
          SET last_seen_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = :userId
            AND deleted_at IS NULL
          RETURNING last_seen_at
        `,
        {
          type: db.Sequelize.QueryTypes.SELECT,
          replacements: { userId }
        }
      )

      lastSeenAt = rows[0]?.last_seen_at ?? null
    }

    const payload = {
      user_id: userId,
      is_online: online,
      last_seen_at: lastSeenAt
    }

    recipients.forEach((partnerId) => {
      io.to(userRoomName(partnerId)).emit('presence:update', payload)
    })
  } catch (error) {
    console.error('Socket presence broadcast error:', error.message)
  }
}

async function syncPresenceOnConnect(socket, userId, becameOnline) {
  try {
    const partnerIds = await findConversationPartnerIds(userId)

    if (becameOnline) {
      await broadcastPresence(userId, true, partnerIds)
    }

    socket.emit('presence:sync', {
      presence: await buildPresenceFor(partnerIds)
    })
  } catch (error) {
    console.error('Socket presence sync error:', error.message)
  }
}

function initializeSocket(server, corsOptions) {
  io = new Server(server, {
    cors: corsOptions
  })

  io.use((socket, next) => {
    try {
      const token = getHandshakeToken(socket)
      const jwtKey = process.env.JWT_KEY || process.env.JWT_SECRET

      if (!token) return next(new Error('Authentication required'))
      if (!jwtKey) return next(new Error('JWT secret is not configured'))

      socket.user = jwt.verify(token, jwtKey)
      next()
    } catch {
      next(new Error('Invalid or expired token'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.user.userId

    socket.join(userRoomName(userId))

    const becameOnline = addConnection(userId, socket.id)
    syncPresenceOnConnect(socket, userId, becameOnline)

    socket.on('presence:get', async (userIds, callback = () => {}) => {
      const validation = presenceUserIdsSchema.safeParse(userIds)
      if (!validation.success) {
        return callback({
          success: false,
          message: 'user_ids must be an array of 1 to 100 valid user IDs'
        })
      }

      try {
        const presence = await buildPresenceFor(validation.data)
        callback({ success: true, presence })
      } catch {
        callback({ success: false, message: 'Unable to retrieve presence' })
      }
    })

    socket.on('disconnect', () => {
      if (removeConnection(userId, socket.id)) {
        broadcastPresence(userId, false)
      }
    })

    socket.on('conversation:join', async (conversationId, callback = () => {}) => {
      const validation = conversationIdSchema.safeParse(conversationId)
      if (!validation.success) return callback({ success: false, message: 'Invalid conversation ID' })

      try {
        const isMember = await isConversationMember(conversationId, socket.user.userId)
        if (!isMember) return callback({ success: false, message: 'You are not a member of this conversation' })

        await socket.join(roomName(conversationId))
        callback({ success: true, conversation_id: conversationId })
      } catch {
        callback({ success: false, message: 'Unable to join conversation' })
      }
    })

    socket.on('conversation:leave', async (conversationId, callback = () => {}) => {
      const validation = conversationIdSchema.safeParse(conversationId)
      if (!validation.success) return callback({ success: false, message: 'Invalid conversation ID' })

      await socket.leave(roomName(conversationId))
      callback({ success: true, conversation_id: conversationId })
    })
  })

  return io
}

function emitNewMessage(message) {
  if (!io || !message?.conversation_id) return
  io.to(roomName(message.conversation_id)).emit('message:new', message)
}

async function emitConversationUpdated(message) {
  if (!io || !message?.conversation_id) return

  try {
    const members = await db.sequelize.query(
      `
        SELECT
          cm.user_id,
          COUNT(unread_message.id)::int AS unread_count
        FROM conversation_members cm
        LEFT JOIN messages unread_message
          ON unread_message.conversation_id = cm.conversation_id
         AND unread_message.sender_id <> cm.user_id
         AND (
           cm.last_read_at IS NULL
           OR unread_message.created_at > cm.last_read_at
         )
        WHERE cm.conversation_id = :conversationId
        GROUP BY cm.user_id
      `,
      {
        type: db.Sequelize.QueryTypes.SELECT,
        replacements: { conversationId: message.conversation_id }
      }
    )

    const payload = {
      conversation_id: message.conversation_id,
      last_message: message,
      updated_at: message.created_at
    }

    members.forEach(({ user_id: userId, unread_count: unreadCount }) => {
      io.to(userRoomName(userId)).emit('conversation:updated', {
        ...payload,
        unread_count: unreadCount
      })
    })
  } catch (error) {
    console.error('Socket conversation update error:', error.message)
  }
}

async function emitConversationDeleted(conversationId, userIds) {
  if (!io) return

  userIds.forEach((userId) => {
    io.to(userRoomName(userId)).emit('conversation:deleted', {
      conversation_id: conversationId
    })
  })
}

module.exports = {
  initializeSocket,
  emitNewMessage,
  emitConversationUpdated,
  emitConversationDeleted,
  roomName
}
