"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ConversationKey extends Model {
    static associate(models) {
      ConversationKey.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
      });

      ConversationKey.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });
    }
  }

  ConversationKey.init(
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

      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      encrypted_key: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "ConversationKey",
      tableName: "conversation_keys",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    }
  );

  return ConversationKey;
};