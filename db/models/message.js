"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
      });

      Message.belongsTo(models.User, {
        foreignKey: "sender_id",
        as: "sender",
      });

      Message.belongsTo(models.Message, {
        foreignKey: "reply_to_message_id",
        as: "reply_to_message",
      });
    }
  }

  Message.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      reply_to_message_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      ciphertext: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      iv: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      auth_tag: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Message",
      tableName: "messages",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    }
  );

  return Message;
};