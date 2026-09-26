'use strict'

const { z } = require('zod')

const registerSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
  public_key: z.string().min(1, { message: 'Public key is required' }),
  encrypted_private_key: z.string().min(1, { message: 'Encrypted private key is required' }),
  key_derivation_salt: z.string().min(1, { message: 'Key derivation salt is required' })
})

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(1, { message: 'Password is required' })
})

module.exports = {
    registerSchema,
    loginSchema
}