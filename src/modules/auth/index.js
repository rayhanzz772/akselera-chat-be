const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')

router.post('/login', Controller.login)
router.post('/register', Controller.register)
router.get('/me', authMiddleware, Controller.getMe)

module.exports = router
