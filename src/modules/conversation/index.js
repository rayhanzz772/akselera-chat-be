const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')
const conversationMiddleware = require('../../middleware/conversationMiddleware')

router.use(authMiddleware)
router.get('/', Controller.getConversations)
router.post('/', Controller.createConversation)
router.delete('/:conversationId', conversationMiddleware, Controller.deleteConversation)
router.patch('/:conversationId/read', conversationMiddleware, Controller.markConversationRead)
router.use('/:conversationId/messages', require('../message/index'))

module.exports = router