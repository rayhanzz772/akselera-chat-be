"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("conversation_members", {
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

      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addConstraint("conversation_members", {
      fields: ["conversation_id", "user_id"],
      type: "unique",
      name: "uq_conversation_members_conversation_user",
    });

    await queryInterface.addIndex(
      "conversation_members",
      ["user_id", "conversation_id"],
      {
        name: "idx_conversation_members_user_conversation",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("conversation_members");
  },
};