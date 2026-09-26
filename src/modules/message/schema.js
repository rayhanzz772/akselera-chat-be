'use strict'

const { z } = require('zod')

const createMessageSchema = z.object({
  ciphertext: z.string().min(1, { message: 'Ciphertext is required' }),
  iv: z.string().min(1, { message: 'IV is required' }),
  auth_tag: z.string().min(1, { message: 'Auth tag is required' })
})

module.exports = {
  createMessageSchema
}