"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("messages", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },

      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "conversations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      ciphertext: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      iv: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      auth_tag: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex(
      "messages",
      ["conversation_id", "created_at"],
      {
        name: "idx_messages_conversation_created_at",
      }
    );

    await queryInterface.addIndex(
      "messages",
      ["sender_id", "created_at"],
      {
        name: "idx_messages_sender_created_at",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("messages");
  },
};