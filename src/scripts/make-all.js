#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)

if (args.length === 0) {
  process.exit(1)
}

function generateMigrationId(migrationDir) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `${year}${month}`

  let sequence = 1

  if (fs.existsSync(migrationDir)) {
    const files = fs.readdirSync(migrationDir)

    const sameMonthFiles = files.filter((file) => file.startsWith(prefix))

    if (sameMonthFiles.length > 0) {
      const numbers = sameMonthFiles.map((file) => {
        const match = file.match(/^(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })

      const maxNumber = Math.max(...numbers)
      sequence = parseInt(String(maxNumber).slice(6)) + 1
    }
  }

  const seqStr = String(sequence).padStart(4, '0')

  return `${prefix}${seqStr}`
}

const name = args[0]

const rootDir = path.resolve(__dirname, '../..')

const migrationDir = path.join(rootDir, 'db', 'migrations')
const seederDir = path.join(rootDir, 'db', 'seeders')
const modelDir = path.join(rootDir, 'db', 'models')

const timestamp = generateMigrationId(migrationDir)

;[migrationDir, modelDir, seederDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

const migrationFile = path.join(
  migrationDir,
  `${timestamp}-create-${name.toLowerCase()}.js`
)
const modelFile = path.join(modelDir, `${name.toLowerCase()}.js`)
const seederFile = path.join(
  seederDir,
  `${timestamp}-demo-${name.toLowerCase()}-seeder.js`
)

const modelTemplate = `'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class ${name} extends Model {
      static associate(models) {
      // define association here
    }
  }

  ${name}.init(
    {
      id: {
        type: DataTypes.STRING,
        primaryKey: true
      },
    },
    {
      sequelize,
      modelName: '${name}',
      tableName: '${name.toLowerCase()}s',
      timestamps: true,
      underscored: true
    }
  )
  return ${name};
}
`

const migrationTemplate = `'use strict';
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('${name.toLowerCase()}s', {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true
      }
    })
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('${name.toLowerCase()}s')
  }
}`

const seederTemplate = `'use strict'
const cuid = require('cuid')
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('${name.toLowerCase()}s', [
      {
        id: cuid(),
        // other fields
      }
    ])
  },
  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('${name.toLowerCase()}s', null, {})
  }
};`

fs.writeFileSync(migrationFile, migrationTemplate)
fs.writeFileSync(modelFile, modelTemplate)
fs.writeFileSync(seederFile, seederTemplate)

console.log('Model, Migration and Seeder files created:')
console.log(`Model     → ${modelFile}`)
console.log(`Migration → ${migrationFile}`)
console.log(`Seeder    → ${seederFile}`)
