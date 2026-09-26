const Controller = require('./controller')
const router = require('express').Router()
const authMiddleware = require('../../middleware/authMiddleware')

router.use(authMiddleware)
router.get('/', Controller.getUser)

module.exports = router