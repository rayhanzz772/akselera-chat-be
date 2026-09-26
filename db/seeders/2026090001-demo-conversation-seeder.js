'use strict'
const cuid = require('cuid')
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('conversations', [
      {
        id: cuid(),
        // other fields
      }
    ])
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('conversations', null, {})
  }
};