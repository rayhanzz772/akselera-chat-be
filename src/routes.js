const express = require('express')
const router = express.Router()

router.get('/health', (req, res) => {
  res.send('Running ⚡')
})

router.use('/auth', require('./modules/auth/index'))
router.use('/users', require('./modules/user/index'))
router.use('/conversations', require('./modules/conversation/index'))
router.use('/conversations/:conversationId/messages', require('./modules/message/index'))

module.exports = router
