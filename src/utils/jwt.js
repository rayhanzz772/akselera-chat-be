require('dotenv').config({})

const jwt = require('jsonwebtoken')
const key = process.env.JWT_SECRET

function generateToken(payload, expiresIn = process.env.JWT_EXPIRED || '15m') {
  return jwt.sign(payload, key, { expiresIn })
}

function verifyToken(token) {
  return jwt.verify(token, key)
}

function decodeToken(token) {
  return jwt.decode(token)
}

module.exports = { generateToken, verifyToken, decodeToken }
