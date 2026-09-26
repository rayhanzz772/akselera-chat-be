'use strict'
const cuid = require('cuid')
const argon2 = require('argon2')

module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await argon2.hash('Password123!', {
      type: argon2.argon2id
    })
    await queryInterface.bulkInsert(
      'users',
      [
        {
          id: cuid(),
          role_id: 'role_super_admin_id_001',
          name: 'Super Administrator',
          username: 'superadmin',
          email: 'admin@example.com',
          password_hash: hashedPassword,
          status: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: cuid(),
          role_id: 'role_super_admin_id_001',
          name: 'John Doe',
          username: 'john_doe',
          email: 'john@example.com',
          password_hash: hashedPassword,
          status: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ],
      { ignoreDuplicates: true }
    )
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      'users',
      { username: ['superadmin', 'john_doe'] },
      {}
    )
  }
}
