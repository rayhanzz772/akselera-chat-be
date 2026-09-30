"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("messages", "reply_to_message_id", {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: "messages",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("messages", ["reply_to_message_id"], {
      name: "idx_messages_reply_to_message_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "messages",
      "idx_messages_reply_to_message_id"
    );
    await queryInterface.removeColumn("messages", "reply_to_message_id");
  },
};