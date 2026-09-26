const express = require('express')
const router = express.Router()

router.get('/health', (req, res) => {
  res.send('Running ⚡')
})

router.use('/auth', require('./modules/auth/index'))
router.use('/users', require('./modules/user/index'))

module.exports = router
