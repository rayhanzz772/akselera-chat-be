const Controller = require('./controller')
const router = require('express').Router()

router.get('/', Controller.getUser)

module.exports = router