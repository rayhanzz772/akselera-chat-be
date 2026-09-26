require('dotenv').config({})

const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')
const route = require('./src/routes')
const { createServer } = require('node:http')
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const { initializeSocket } = require('./src/utils/socket')

const mode = process.env.NODE_ENV || 'development'
const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || ''
const allowAll = allowedOriginsRaw === '*'

const allowedOrigins = allowAll
  ? []
  : allowedOriginsRaw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)

app.use(
  helmet({
    hidePoweredBy: true
  })
)
app.disable('x-powered-by')

const corsOptions = (req, callback) => {
  const origin = req.headers.origin
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https'

  const isAllowed = () => {
    if (allowAll) return true
    if (!origin) return false
    return allowedOrigins.includes(origin)
  }

  if (mode === 'production') {
    if (isAllowed()) {
      return callback(null, { origin: true, credentials: true })
    }
    return callback(null, false)
  }

  if (isSecure) {
    if (isAllowed()) {
      return callback(null, { origin: true, credentials: true })
    }
    return callback(null, false)
  }

  return callback(null, { origin: true, credentials: true })
}

app.use(morgan('dev'))
app.use(cors(corsOptions))
app.use(cookieParser())

app.use(
  express.json({
    limit: '50mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString()
    }
  })
)

app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString()
    }
  })
)

app.use('/api/v1', route)

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    data: null
  })
})

const port = process.env.PORT || 8001
const server = createServer(app)
const socketCors = mode === 'production' && !allowAll
  ? { origin: allowedOrigins, credentials: true }
  : { origin: true, credentials: true }

initializeSocket(server, socketCors)

server.listen(port, () => {
  console.log(`Server Running ⚡ PORT : ${port}`)
})

module.exports = app
