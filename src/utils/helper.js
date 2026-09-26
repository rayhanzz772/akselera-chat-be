const rateLimit = require('express-rate-limit')
const { RedisStore } = require('rate-limit-redis')
const redis = require('../../config/redis')
const { ipKeyGenerator } = require('express-rate-limit')

function createRateLimiter(
  max = 5,
  windowMs = 1 * 60 * 1000,
  customMessage = 'Too many requests, please try again later.'
) {
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args)
    }),
    windowMs,
    max,
    message: {
      code: 429,
      message: customMessage
    },
    keyGenerator: (req, res) => {
      const ip = ipKeyGenerator(req, res)
      const agent = req.headers['user-agent'] || 'unknown-agent'
      const path = req.baseUrl + req.path
      const method = req.method.toLowerCase()
      return `rl:${ip}:${agent}:${method}:${path}`
    },
    standardHeaders: true,
    legacyHeaders: false
  })
}

module.exports = { createRateLimiter }
