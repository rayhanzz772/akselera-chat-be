'use strict'

const { z } = require('zod')

const createConversationSchema = z.object({
	member_ids: z.array(z.string().uuid()).default([])
})

module.exports = {
	createConversationSchema
}
