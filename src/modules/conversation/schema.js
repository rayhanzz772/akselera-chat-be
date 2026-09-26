'use strict'

const { z } = require('zod')

const createConversationSchema = z.object({
	member_email: z.string().email({ message: 'Invalid email address' })
})

module.exports = {
	createConversationSchema
}
