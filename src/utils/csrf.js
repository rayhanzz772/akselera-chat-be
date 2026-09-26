const csrf = require('csurf')

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 3600000
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  value: (req) => req.headers['x-csrf-token']
})

module.exports = csrfProtection
