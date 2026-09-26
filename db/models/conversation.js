"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    static associate(models) {
      Conversation.hasMany(models.ConversationMember, {
        foreignKey: "conversation_id",
        as: "members",
      });

      Conversation.hasMany(models.ConversationKey, {
        foreignKey: "conversation_id",
        as: "keys",
      });

      Conversation.hasMany(models.Message, {
        foreignKey: "conversation_id",
        as: "messages",
      });
    }
  }

  Conversation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
    },
    {
      sequelize,
      modelName: "Conversation",
      tableName: "conversations",
      underscored: true,
      timestamps: true,
    }
  );

  return Conversation;
};