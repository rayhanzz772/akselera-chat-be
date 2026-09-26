"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ConversationMember extends Model {
    static associate(models) {
      ConversationMember.belongsTo(models.Conversation, {
        foreignKey: "conversation_id",
        as: "conversation",
      });

      ConversationMember.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });
    }
  }

  ConversationMember.init(
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

      last_read_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "ConversationMember",
      tableName: "conversation_members",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    }
  );

  return ConversationMember;
};