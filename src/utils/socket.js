const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')
const { z } = require('zod')
const db = require('../../db/models')

let io
const conversationIdSchema = z.string().uuid()

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
    socket.join(userRoomName(socket.user.userId))

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
