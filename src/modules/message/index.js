const Controller = require('./controller')
const conversationMiddleware = require('../../middleware/conversationMiddleware')
const router = require('express').Router({ mergeParams: true })

router.use(conversationMiddleware)
router.post('/', Controller.createMessage)
router.get('/', Controller.getMessages)

module.exports = router