const jwt = require('jsonwebtoken')
const { hashPassword, compare } = require('../../utils/bcrypt')
const db = require('../../../db/models')
const { api } = require('../../utils/api')
const { HttpStatusCode } = require('axios')
const { registerSchema, loginSchema } = require('./schema')
const { validateRequest } = require('../../utils/validation')

const User = db.User

class Controller {
  static async login(req, res) {
    try {
      const validateData = validateRequest(loginSchema, req)

      const user = await User.findOne({
        where: {
          email: validateData.email
        }
      })

      if (!user) {
        throw { code: 400, message: 'User not found' }
      }

      const isValid = await compare(validateData.password, user.password_hash)

      if (!isValid) {
        throw { code: 400, message: 'Invalid Password' }
      }

      const jwtKey = process.env.JWT_KEY || process.env.JWT_SECRET
      if (!jwtKey) {
        throw { code: 500, message: 'JWT secret is not configured' }
      }

      const payload = {
        userId: user.id
      }

      const token = jwt.sign(payload, jwtKey, {
        expiresIn: '7d'
      })

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      })

      const userSafe = {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      }

      return res
        .status(HttpStatusCode.Ok)
        .json(api(userSafe, HttpStatusCode.Ok, { req }))
    } catch (err) {
      const code = typeof err?.code === 'number' ? err.code : (err?.status || HttpStatusCode.InternalServerError)
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async logout(req, res) {
    try {
      res.clearCookie('token')
      return res
        .status(HttpStatusCode.Ok)
        .json(api(null, HttpStatusCode.Ok, { req }))
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(HttpStatusCode.BadRequest).json(api(null, HttpStatusCode.BadRequest, { err }))
      }
      const code = typeof err?.code === 'number' ? err.code : (err?.status || HttpStatusCode.InternalServerError)
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async getMe(req, res) {
    try {
      const userId = req.user.id

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password_hash'] }
      })

      if (!user) throw new Error('User not found')

      const result = {
        id: user.id,
        name: user.name,
        email: user.email,
      }

      return res
        .status(HttpStatusCode.Ok)
        .json(api(result, HttpStatusCode.Ok, { req }))
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(HttpStatusCode.BadRequest).json(api(null, HttpStatusCode.BadRequest, { err }))
      }
      const code = typeof err?.code === 'number' ? err.code : (err?.status || HttpStatusCode.InternalServerError)
      return res.status(code).json(api(null, code, { err }))
    }
  }

  static async register(req, res){
    try {
      const validateData = validateRequest(registerSchema, req)
      const hashedPassword = await hashPassword(validateData.password)
      const userExists = await User.findOne({
        where: {
          email: validateData.email
        }
      })
      if (userExists) {
        throw { code: 400, message: 'Email already exists' }
      }
      await User.create({
        name: validateData.name,
        email: validateData.email,
        password_hash: hashedPassword
      })
      return res.status(HttpStatusCode.Created).json(api(null, HttpStatusCode.Created, { req }))
    } catch (err) {
      const code = typeof err?.code === 'number' ? err.code : (err?.status || HttpStatusCode.InternalServerError)
      return res.status(code).json(api(null, code, { err }))
    }
  }
}

module.exports = Controller
