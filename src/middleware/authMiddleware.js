const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    })
  }

  try {
    const jwtKey = process.env.JWT_KEY || process.env.JWT_SECRET
    if (!jwtKey) {
      return res.status(500).json({
        success: false,
        message: 'JWT secret is not configured'
      })
    }

    const decoded = jwt.verify(token, jwtKey)

    req.user = {
      id: decoded.userId,
      role: decoded.role,
      type: decoded.type,
      status: decoded.status
    }

    if (req.user.status === false) {
      return res.status(403).json({
        success: false,
        message: 'User is inactive or suspended'
      })
    }

    next()
  } catch (err) {
    console.error('❌ JWT verification error:', err.message)
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    })
  }
}

module.exports = authMiddleware
