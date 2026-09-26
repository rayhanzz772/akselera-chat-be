const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')

router.use(authMiddleware)
router.get('/', Controller.getConversations)
router.post('/', Controller.createConversation)

module.exports = router