const db = require('../../db/models')

// userId -> Set<socketId>. A user stays online until their last socket disconnects.
const connections = new Map()

function addConnection(userId, socketId) {
  const sockets = connections.get(userId)

  if (!sockets) {
    connections.set(userId, new Set([socketId]))
    return true
  }

  const wasOffline = sockets.size === 0
  sockets.add(socketId)

  return wasOffline
}

function removeConnection(userId, socketId) {
  const sockets = connections.get(userId)

  if (!sockets) return false

  sockets.delete(socketId)

  if (sockets.size > 0) return false

  connections.delete(userId)
  return true
}

function isOnline(userId) {
  const sockets = connections.get(userId)
  return Boolean(sockets && sockets.size > 0)
}

async function findConversationPartnerIds(userId) {
  const rows = await db.sequelize.query(
    `
      SELECT DISTINCT partner.user_id
      FROM conversation_members mine
      INNER JOIN conversation_members partner
        ON partner.conversation_id = mine.conversation_id
      WHERE mine.user_id = :userId
        AND partner.user_id <> :userId
    `,
    {
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: { userId }
    }
  )

  return rows.map(({ user_id: partnerId }) => partnerId)
}

/**
 * Resolve presence for a list of users in a single query.
 * `last_seen_at` is null while the user is online: read `is_online` first.
 */
async function buildPresenceFor(userIds) {
  const uniqueIds = [...new Set(userIds)]

  if (uniqueIds.length === 0) return []

  const rows = await db.sequelize.query(
    `
      SELECT id, last_seen_at
      FROM users
      WHERE id IN (:userIds)
        AND deleted_at IS NULL
    `,
    {
      type: db.Sequelize.QueryTypes.SELECT,
      replacements: { userIds: uniqueIds }
    }
  )

  const lastSeenById = new Map(
    rows.map(({ id, last_seen_at: lastSeenAt }) => [id, lastSeenAt])
  )

  return uniqueIds.map((userId) => {
    const online = isOnline(userId)

    return {
      user_id: userId,
      is_online: online,
      last_seen_at: online ? null : (lastSeenById.get(userId) ?? null)
    }
  })
}

async function presenceMapFor(userIds) {
  const presence = await buildPresenceFor(userIds)

  return new Map(presence.map((item) => [item.user_id, item]))
}

module.exports = {
  addConnection,
  removeConnection,
  isOnline,
  findConversationPartnerIds,
  buildPresenceFor,
  presenceMapFor
}
